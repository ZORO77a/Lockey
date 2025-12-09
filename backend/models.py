# models.py
"""
Simple helper functions to create MongoDB document shapes used by the app.
Keep these minimal and free of side effects so they are safe to import at startup.
"""

from typing import Optional, Dict
from datetime import datetime

def make_user_doc(email: str, hashed_password: str, name: Optional[str], role: str) -> Dict:
    """
    Create a new user document for insertion into MongoDB.
    role should be 'admin' or 'employee'.
    """
    return {
        "email": email,
        "hashed_password": hashed_password,
        "name": name,
        "role": role,
        "created_at": datetime.utcnow(),
        "wfh_allowed_until": None
    }

def make_file_metadata(filename: str, uploaded_by: str) -> Dict:
    """
    Create a small metadata dict for file records.
    """
    return {
        "filename": filename,
        "uploaded_by": uploaded_by,
        "uploaded_at": datetime.utcnow()
    }
