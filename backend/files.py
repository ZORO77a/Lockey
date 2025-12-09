# files.py - GridFS encrypt/decrypt helpers (Fernet)
# Rewritten to avoid import-time failures and give clear runtime errors.
import os
from typing import Tuple
from dotenv import load_dotenv
from cryptography.fernet import Fernet, InvalidToken
from db import db
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from bson.objectid import ObjectId

load_dotenv()

def _get_fernet() -> Fernet:
    """
    Lazily obtain a Fernet instance. Raises RuntimeError if FERNET_KEY is not configured.
    """
    key = os.getenv("FERNET_KEY")
    if not key:
        raise RuntimeError(
            "FERNET_KEY is not set in the environment. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\" "
            "and add it to your .env as FERNET_KEY"
        )
    # ensure bytes
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)

async def store_encrypted_file(filename: str, content_bytes: bytes, metadata: dict = None):
    """
    Encrypt content_bytes with Fernet and store in GridFS.
    Returns the ObjectId (as a string) of the stored file.
    """
    fernet = _get_fernet()
    enc = fernet.encrypt(content_bytes)
    fs = AsyncIOMotorGridFSBucket(db)
    oid = await fs.upload_from_stream(filename, enc, metadata=metadata or {})
    # oid is an ObjectId; return string representation for convenience
    return str(oid)

async def get_decrypted_file(oid_value: str) -> Tuple[str, bytes]:
    """
    Retrieve file by ObjectId (string) from GridFS, decrypt and return (filename, bytes).
    Raises RuntimeError if decryption fails or file not found.
    """
    fernet = _get_fernet()
    fs = AsyncIOMotorGridFSBucket(db)
    try:
        oid = ObjectId(oid_value)
    except Exception as e:
        raise RuntimeError(f"Invalid file id format: {oid_value}") from e

    try:
        grid_out = await fs.open_download_stream(oid)
    except Exception as e:
        raise RuntimeError(f"Failed to open GridFS stream for id {oid_value}: {e}") from e

    try:
        data = await grid_out.read()
    except Exception as e:
        raise RuntimeError(f"Failed to read GridFS stream for id {oid_value}: {e}") from e

    try:
        dec = fernet.decrypt(data)
    except InvalidToken as e:
        raise RuntimeError("Decryption failed. Is FERNET_KEY correct for this file?") from e
    except Exception as e:
        raise RuntimeError(f"Unexpected decryption error: {e}") from e

    return grid_out.filename, dec
