# backend/admin_routes.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any
from datetime import datetime
from bson import ObjectId

from db import db
from auth import hash_password, decode_token
from models import make_user_doc
from files import store_encrypted_file

router = APIRouter(prefix="/admin", tags=["admin"])
bearer = HTTPBearer()


def require_admin(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> Dict[str, Any]:
    token = creds.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin only")
    return payload


@router.post("/create-employee")
async def create_employee(payload: Dict[str, Any], token_data: Dict[str, Any] = Depends(require_admin)):
    email = payload.get("email")
    password = payload.get("password")
    name = payload.get("name", "")

    if not email or not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email and password required")

    existing = await db["users"].find_one({"email": email})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email already exists")

    hashed = hash_password(password)
    doc = make_user_doc(email, hashed, name, "employee")
    await db["users"].insert_one(doc)
    await db["logs"].insert_one({
        "email": token_data.get("sub"),
        "action": "created_employee",
        "target": email,
        "time": datetime.utcnow()
    })
    return {"detail": "employee created"}


@router.get("/employees")
async def list_employees(token_data: Dict[str, Any] = Depends(require_admin)):
    cursor = db["users"].find({"role": "employee"}, {"hashed_password": 0})
    res = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        res.append(doc)
    return res


@router.put("/update-employee")
async def update_employee(payload: Dict[str, Any], token_data: Dict[str, Any] = Depends(require_admin)):
    """
    JSON body:
      { "email": "<existing>", "new_email": "<optional>", "name": "<optional>", "password": "<optional>" }
    """
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email required")

    update = {}
    if payload.get("new_email"):
        update["email"] = payload.get("new_email")
    if "name" in payload:
        update["name"] = payload.get("name")
    if payload.get("password"):
        update["hashed_password"] = hash_password(payload.get("password"))

    if not update:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="no changes supplied")

    result = await db["users"].update_one({"email": email, "role": "employee"}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="employee not found")

    await db["logs"].insert_one({
        "email": token_data.get("sub"),
        "action": "updated_employee",
        "target": email,
        "changes": update,
        "time": datetime.utcnow()
    })
    return {"detail": "updated"}


@router.post("/delete-employee")
async def delete_employee(email: str = Form(...), token_data: Dict[str, Any] = Depends(require_admin)):
    """
    Form-encoded POST expecting 'email' (frontend uses URLSearchParams).
    """
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="email required")

    res = await db["users"].delete_one({"email": email, "role": "employee"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="employee not found")

    await db["logs"].insert_one({
        "email": token_data.get("sub"),
        "action": "deleted_employee",
        "target": email,
        "time": datetime.utcnow()
    })
    return {"detail": "deleted"}


@router.post("/upload-file")
async def upload_file(file: UploadFile = File(...), token_data: Dict[str, Any] = Depends(require_admin)):
    content = await file.read()
    metadata = {"uploaded_by": token_data.get("sub")}
    oid = await store_encrypted_file(file.filename, content, metadata=metadata)
    file_doc = {
        "file_id": str(oid),
        "filename": file.filename,
        "uploaded_by": token_data.get("sub"),
        "uploaded_at": datetime.utcnow()
    }
    await db["files"].insert_one(file_doc)
    await db["logs"].insert_one({
        "email": token_data.get("sub"),
        "action": "uploaded_file",
        "file_id": str(oid),
        "filename": file.filename,
        "time": datetime.utcnow()
    })
    return {"file_id": str(oid)}


@router.get("/files")
async def list_files(token_data: Dict[str, Any] = Depends(require_admin)):
    cursor = db["files"].find({})
    res = []
    async for f in cursor:
        f["_id"] = str(f["_id"])
        res.append(f)
    return res


@router.get("/logs")
async def get_logs(limit: int = 100, token_data: Dict[str, Any] = Depends(require_admin)):
    cursor = db["logs"].find({}).sort("time", -1).limit(limit)
    res = []
    async for l in cursor:
        l["_id"] = str(l["_id"])
        res.append(l)
    return res


@router.get("/wfh_requests")
async def list_wfh_requests(token_data: Dict[str, Any] = Depends(require_admin)):
    cursor = db["wfh_requests"].find({}).sort("created_at", -1)
    out = []
    async for r in cursor:
        r["_id"] = str(r["_id"])
        # Normalize missing status → pending
        if "status" not in r:
            r["status"] = "pending"
        out.append(r)
    return out


@router.post("/approve-wfh")
async def approve_wfh(request_id: str = Form(...), token_data: Dict[str, Any] = Depends(require_admin)):
    try:
        oid = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="invalid request id")

    req = await db["wfh_requests"].find_one({"_id": oid})
    if not req:
        raise HTTPException(status_code=404, detail="request not found")

    await db["wfh_requests"].update_one(
        {"_id": oid},
        {
            "$set": {
                "status": "approved",
                "approved_at": datetime.utcnow()
            }
        }
    )
    await db["users"].update_one(
        {"email": req["requested_by"]},
        {"$set": {"wfh_allowed_until": req["end_date"]}}
    )
    await db["logs"].insert_one({
        "email": token_data["sub"],
        "action": "wfh_approved",
        "request_id": request_id,
        "requested_by": req["requested_by"],
        "time": datetime.utcnow()
    })
    return {"detail": "approved"}


@router.post("/reject-wfh")
async def reject_wfh(request_id: str = Form(...), token_data: Dict[str, Any] = Depends(require_admin)):
    try:
        oid = ObjectId(request_id)
    except:
        raise HTTPException(status_code=400, detail="invalid request id")

    req = await db["wfh_requests"].find_one({"_id": oid})
    if not req:
        raise HTTPException(status_code=404, detail="request not found")

    await db["wfh_requests"].update_one(
        {"_id": oid},
        {
            "$set": {
                "status": "rejected",
                "rejected_at": datetime.utcnow()
            }
        }
    )
    await db["logs"].insert_one({
        "email": token_data["sub"],
        "action": "wfh_rejected",
        "request_id": request_id,
        "requested_by": req["requested_by"],
        "time": datetime.utcnow()
    })
    return {"detail": "rejected"}



@router.post("/revoke-wfh")
async def revoke_wfh(user_email: str = Form(...), token_data: Dict[str, Any] = Depends(require_admin)):
    """
    Revoke WFH access for a given user_email.

    - Clears users.wfh_allowed_until
    - Marks any approved wfh_requests for that user as 'revoked' (and sets revoked_at)
    - Logs the action
    """
    if not user_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_email required")

    # Clear the user's WFH flag/expiry
    await db["users"].update_one({"email": user_email}, {"$set": {"wfh_allowed_until": None}})

    # Update any approved requests for that user to 'revoked'
    result = await db["wfh_requests"].update_many(
        {"requested_by": user_email, "status": "approved"},
        {"$set": {"status": "revoked", "revoked_at": datetime.utcnow()}}
    )

    # Log the revoke action
    await db["logs"].insert_one({
        "email": token_data.get("sub"),
        "action": "wfh_revoked",
        "target": user_email,
        "revoked_count": result.modified_count,
        "time": datetime.utcnow()
    })

    return {"detail": "revoked", "revoked_count": result.modified_count}



# --- paste into backend/admin_routes.py (append) ---
from fastapi import Body

# Settings document key used in DB
_SETTINGS_DOC_ID = "global_policy_v1"

def _normalize_settings(payload: dict) -> dict:
    """
    Validate and normalize incoming settings payload.
    Expected keys:
      - latitude (float)
      - longitude (float)
      - radius_m (int)
      - allowed_ssid (str)
      - start_time (str, "HH:MM")  (local office start)
      - end_time   (str, "HH:MM")  (local office end)
    """
    out = {}
    # latitude / longitude
    try:
        lat = float(payload.get("latitude", payload.get("lat", 0)))
        lon = float(payload.get("longitude", payload.get("lon", 0)))
        out["latitude"] = lat
        out["longitude"] = lon
    except Exception:
        raise HTTPException(status_code=400, detail="invalid latitude/longitude")

    # radius
    try:
        r = int(payload.get("radius_m", payload.get("radius", 1000)))
        if r < 0:
            raise ValueError()
        out["radius_m"] = r
    except Exception:
        raise HTTPException(status_code=400, detail="invalid radius")

    # ssid
    ssid = payload.get("allowed_ssid", "")
    if ssid is None:
        ssid = ""
    out["allowed_ssid"] = str(ssid)

    # start_time / end_time (HH:MM)
    def _validate_hhmm(v, name):
        if not v or not isinstance(v, str):
            return "00:00" if name == "start_time" else "23:59"
        parts = v.split(":")
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail=f"invalid {name} format")
        hh, mm = parts
        try:
            hh_i = int(hh); mm_i = int(mm)
            if not (0 <= hh_i < 24 and 0 <= mm_i < 60):
                raise ValueError()
        except Exception:
            raise HTTPException(status_code=400, detail=f"invalid {name}")
        return f"{hh_i:02d}:{mm_i:02d}"

    out["start_time"] = _validate_hhmm(payload.get("start_time", "09:00"), "start_time")
    out["end_time"] = _validate_hhmm(payload.get("end_time", "17:00"), "end_time")

    # timestamp for auditing
    out["updated_at"] = datetime.utcnow()
    return out

@router.get("/settings")
async def get_settings(token_data: Dict[str, Any] = Depends(require_admin)):
    """
    Return the admin policy settings document.
    If missing, return sensible defaults.
    """
    doc = await db["settings"].find_one({"_id": _SETTINGS_DOC_ID})
    if not doc:
        # defaults (use values you showed earlier)
        default = {
            "_id": _SETTINGS_DOC_ID,
            "latitude": 9.35866726100274,
            "longitude": 76.67729687183018,
            "radius_m": 1000,
            "allowed_ssid": "GNXS-92f598",
            "start_time": "09:00",
            "end_time": "17:00",
            "updated_at": datetime.utcnow()
        }
        # do not insert automatically to save DB writes; but return defaults
        return default
    # convert ObjectId or datetime to JSON serializable forms if needed (FastAPI will handle datetimes)
    doc["_id"] = str(doc["_id"]) if "_id" in doc and not isinstance(doc["_id"], str) else doc.get("_id")
    return doc

@router.put("/settings")
async def update_settings(payload: dict = Body(...), token_data: Dict[str, Any] = Depends(require_admin)):
    """
    Update admin policy settings.
    Accepts JSON body with keys: latitude, longitude, radius_m, allowed_ssid, start_time, end_time.
    """
    cleaned = _normalize_settings(payload)
    # Upsert the single settings doc
    await db["settings"].update_one({"_id": _SETTINGS_DOC_ID}, {"$set": cleaned}, upsert=True)
    # Log the change
    await db["logs"].insert_one({
        "email": token_data.get("sub"),
        "action": "updated_settings",
        "changes": cleaned,
        "time": datetime.utcnow()
    })
    return {"detail": "settings updated", "settings": cleaned}
# --- end paste ---
