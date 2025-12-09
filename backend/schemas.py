# schemas.py - Pydantic request/response schemas
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

class LoginForm(BaseModel):
    email: EmailStr
    password: str

class OTPVerifyForm(BaseModel):
    email: EmailStr
    code: str

class AccessRequest(BaseModel):
    file_id: str
    lat: float
    lon: float
    client_network_hint: Optional[str] = None

class WFHRequestIn(BaseModel):
    start_date: datetime
    end_date: datetime
    reason: Optional[str] = None

class ApproveWFHIn(BaseModel):
    request_id: str
