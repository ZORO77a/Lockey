# main.py - Geocrypt Backend Entrypoint (rewritten, includes /auth/me)
import os
from datetime import datetime
from dotenv import load_dotenv
from bson.objectid import ObjectId

from fastapi import FastAPI, HTTPException, Depends, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import uvicorn

from db import db
from auth import (
    decode_token,
    generate_and_store_otp,
    verify_password,
    hash_password,
    create_access_token,
    verify_otp,
)
from email_utils import send_email
from schemas import LoginForm
from models import make_user_doc
from files import get_decrypted_file, store_encrypted_file
from utils import is_within_geofence, is_within_work_hours

# Routers
from admin_routes import router as admin_router
from employee_routes import router as employee_router

load_dotenv()

# ---------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------
app = FastAPI(title="Geocrypt Access Control Backend")

# ---------------------------------------------------------------------
# CORS configuration
# ---------------------------------------------------------------------
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------
# Security helper (HTTP Bearer)
# ---------------------------------------------------------------------
bearer = HTTPBearer()

async def get_current_user(token: HTTPAuthorizationCredentials = Depends(bearer)):
    """
    Extract user data from JWT token.
    Returns: {"sub": email, "role": role, "exp": timestamp}
    """
    payload = decode_token(token.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="invalid token")
    return payload

# ---------------------------------------------------------------------
# Startup bootstrap – ensure admin exists
# ---------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    admin = await db["users"].find_one({"role": "admin"})
    if not admin:
        admin_email = os.getenv("BOOTSTRAP_ADMIN_EMAIL")
        admin_pass = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "admin")
        await db["users"].insert_one(
            make_user_doc(admin_email, hash_password(admin_pass), "Bootstrap Admin", "admin")
        )
        print(f"Bootstrap admin created: {admin_email}")


# ---------------------------------------------------------------------
# Authentication endpoints
# ---------------------------------------------------------------------
@app.post("/auth/login")
async def login(form: LoginForm):
    """
    Validate email+password and send OTP to that email.
    """
    user = await db["users"].find_one({"email": form.email})
    if not user:
        raise HTTPException(status_code=401, detail="invalid credentials")

    if not verify_password(form.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="invalid credentials")

    otp = await generate_and_store_otp(form.email)
    try:
        send_email(user["email"], "Your Geocrypt OTP", f"Your OTP code is: {otp}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OTP email failed: {str(e)}")

    return {"detail": "OTP sent to email"}


@app.post("/auth/verify-otp")
async def verify_otp_endpoint(email: str = Form(...), code: str = Form(...)):
    """
    Verify OTP -> issue JWT access token.
    """
    ok = await verify_otp(email, code)
    if not ok:
        raise HTTPException(status_code=401, detail="invalid otp")

    user = await db["users"].find_one({"email": email})
    token = create_access_token(email, user["role"])

    return {"access_token": token, "role": user["role"]}


# ---------------------------------------------------------------------
# Auth "me" endpoint used by frontend to validate session on refresh
# ---------------------------------------------------------------------
@app.get("/auth/me")
async def auth_me(token: HTTPAuthorizationCredentials = Depends(bearer)):
    """
    Returns authenticated user details (email, role, name).
    Frontend calls this to validate the JWT on page refresh.
    """
    data = decode_token(token.credentials)
    if not data:
        raise HTTPException(status_code=401, detail="invalid token")

    email = data.get("sub")
    user = await db["users"].find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="user not found")

    return {
        "email": user["email"],
        "role": user["role"],
        "name": user.get("name", "")
    }


# ---------------------------------------------------------------------
# FILE STREAM ENDPOINT (used for internal admin/employee flows)
# ---------------------------------------------------------------------
@app.post("/stream-file")
async def stream_file_endpoint(file_id: str = Form(...), current_user=Depends(get_current_user)):
    """
    Stream decrypted file (raw download). Assumes access checks already done upstream.
    """
    try:
        fname, data = await get_decrypted_file(file_id)
    except Exception:
        raise HTTPException(status_code=404, detail="file not found")

    return StreamingResponse(
        iter([data]),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'}
    )


# ---------------------------------------------------------------------
# EMPLOYEE FILE ACCESS (with geofence, time, wifi + WFH bypass)
# ---------------------------------------------------------------------
@app.post("/employee/request-and-download")
async def employee_request_and_download(
    file_id: str = Form(...),
    lat: float = Form(...),
    lon: float = Form(...),
    client_network_hint: str = Form(""),
    current_user=Depends(get_current_user),
):
    """
    Employee attempts to download + decrypt a file.
    Checks:
     - WFH bypass window
     - Geofence
     - Working hours
     - Network SSID hint
    """

    email = current_user.get("sub")

    # Fetch employee info
    user = await db["users"].find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="user not found")

    # -------------------------
    # WFH bypass logic
    # -------------------------
    wfh_until = user.get("wfh_allowed_until")
    bypass = False

    if wfh_until:
        # if stored as string parse; if stored as datetime, compare directly
        if isinstance(wfh_until, str):
            try:
                wfh_until = datetime.fromisoformat(wfh_until)
            except Exception:
                wfh_until = None

        if wfh_until and wfh_until > datetime.utcnow():
            bypass = True

    # -------------------------
    # Policy checks (if not bypass)
    # -------------------------
    if not bypass:
        # geofence check
        if not is_within_geofence(lat, lon):
            await db["logs"].insert_one(
                {"email": email, "file": file_id, "action": "denied_geofence",
                 "lat": lat, "lon": lon, "time": datetime.utcnow()}
            )
            raise HTTPException(status_code=403, detail="not within allowed geofence")

        # working hours check
        if not is_within_work_hours():
            await db["logs"].insert_one(
                {"email": email, "file": file_id, "action": "denied_time", "time": datetime.utcnow()}
            )
            raise HTTPException(status_code=403, detail="outside allowed working hours")

        # wifi SSID check
        allowed_ssid = os.getenv("ALLOWED_WIFI_SSID")
        if allowed_ssid and client_network_hint and (allowed_ssid not in client_network_hint):
            await db["logs"].insert_one(
                {"email": email, "file": file_id, "action": "denied_network",
                 "hint": client_network_hint, "time": datetime.utcnow()}
            )
            raise HTTPException(status_code=403, detail="not connected to allowed wifi")

    # -------------------------
    # Load encrypted file metadata
    # -------------------------
    fdoc = await db["files"].find_one({"file_id": file_id})
    if not fdoc:
        await db["logs"].insert_one({"email": email, "file": file_id,
                                     "action": "denied_file_not_found", "time": datetime.utcnow()})
        raise HTTPException(status_code=404, detail="file not found")

    # -------------------------
    # Decrypt the file
    # -------------------------
    try:
        fname, data = await get_decrypted_file(file_id)
    except Exception as e:
        await db["logs"].insert_one(
            {"email": email, "file": file_id, "action": "decrypt_error",
             "error": str(e), "time": datetime.utcnow()}
        )
        raise HTTPException(status_code=500, detail="decrypt or read error")

    # log granted access
    await db["logs"].insert_one(
        {"email": email, "file": file_id, "action": "access_granted", "time": datetime.utcnow()}
    )

    return StreamingResponse(
        iter([data]),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'}
    )


# ---------------------------------------------------------------------
# MOUNT ADMIN + EMPLOYEE ROUTES
# ---------------------------------------------------------------------
# These routers already perform their own internal auth/role checks using current_user where needed.
app.include_router(admin_router)
app.include_router(employee_router)


# ---------------------------------------------------------------------
# Run server
# ---------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.getenv("APP_HOST", "0.0.0.0"),
        port=int(os.getenv("APP_PORT", 8000)),
        reload=True,
    )
