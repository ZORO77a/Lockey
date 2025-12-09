# auth.py - password hashing, JWT, OTP management
import os
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
import random
from db import db
from dotenv import load_dotenv

load_dotenv()

# use PBKDF2 to avoid native bcrypt dependency (good for quick dev)
pwd_ctx = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
JWT_SECRET = os.getenv("JWT_SECRET", "dev_jwt_secret")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXP_MINUTES = int(os.getenv("JWT_EXP_MINUTES", "60"))

def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_access_token(subject: str, role: str, minutes: int = None):
    expire = datetime.utcnow() + timedelta(minutes=(minutes or JWT_EXP_MINUTES))
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None

# OTP management (stored in collection 'otps' temporarily)
async def generate_and_store_otp(email: str, ttl_minutes: int = 10) -> str:
    code = "{:06d}".format(random.randint(0, 999999))
    expires_at = datetime.utcnow() + timedelta(minutes=ttl_minutes)
    await db["otps"].update_one(
        {"email": email},
        {"$set": {"code": code, "expires_at": expires_at}},
        upsert=True
    )
    return code

async def verify_otp(email: str, code: str) -> bool:
    doc = await db["otps"].find_one({"email": email})
    if not doc:
        return False
    if doc.get("code") == code and doc.get("expires_at") and doc["expires_at"] > datetime.utcnow():
        await db["otps"].delete_one({"email": email})
        return True
    return False
