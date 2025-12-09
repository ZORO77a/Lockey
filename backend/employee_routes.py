# backend/employee_routes.py
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from datetime import datetime
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from db import db
from auth import decode_token

router = APIRouter(prefix="/employee", tags=["employee"])
bearer = HTTPBearer()


def require_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> Dict[str, Any]:
    token = creds.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="invalid token")
    return payload


@router.post("/request-wfh")
async def request_wfh(payload: Dict[str, Any], token_data: Dict[str, Any] = Depends(require_user)):
    """
    Employee requests WFH. Payload:
      { "start_date": "YYYY-MM-DD HH:mm:ss", "end_date": "YYYY-MM-DD HH:mm:ss", "reason": "..." }
    Stored as strings (end_date used by admin approval).
    """
    email = token_data.get("sub")
    start = payload.get("start_date")
    end = payload.get("end_date")
    reason = payload.get("reason", "")

    if not start or not end:
        raise HTTPException(status_code=400, detail="start_date and end_date required")

    await db["wfh_requests"].insert_one({
        "requested_by": email,
        "start_date": start,
        "end_date": end,
        "reason": reason,
        "status": "pending",
        "created_at": datetime.utcnow()
    })
    await db["logs"].insert_one({
        "email": email,
        "action": "wfh_requested",
        "time": datetime.utcnow()
    })
    return {"detail": "requested"}


@router.get("/my-logs")
async def my_logs(token_data: Dict[str, Any] = Depends(require_user)):
    email = token_data.get("sub")
    cursor = db["logs"].find({"email": email}).sort("time", -1).limit(100)
    out = []
    async for l in cursor:
        l["_id"] = str(l["_id"])
        out.append(l)
    return out
