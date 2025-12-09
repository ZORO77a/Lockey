#!/usr/bin/env python3
"""
End-to-end test script for Geocrypt backend (dev-only).
- Reads OTPs directly from Mongo for testing (bypasses SMTP).
- Uploads a small file, then requests and downloads it.

Run inside the project venv:
    source .venv/bin/activate
    python e2e_test.py
"""

import os, time, json
import requests
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId

load_dotenv()

BASE = os.getenv("BASE_URL", "http://localhost:8000")  # override with env if needed
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/geocrypt")
ADMIN_EMAIL = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "ananthakrishnan272004@gmail.com")
ADMIN_PASSWORD = os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "admin")

# test employee details
EMP_EMAIL = "employee_test@example.com"
EMP_PASSWORD = "EmpTestPass123"
EMP_NAME = "Employee Test"

# File to upload (create a small sample)
SAMPLE_FILE_PATH = "sample_upload.txt"
with open(SAMPLE_FILE_PATH, "w") as f:
    f.write("This is a test file for Geocrypt.\n")

# helper: read OTP for given email from Mongo
def read_otp_from_mongo(email):
    client = MongoClient(MONGO_URI)
    # Use an explicit database name for robustness
    # If your MONGO_URI already encodes a DB name, get_database("geocrypt") will still work.
    db = client.get_database("geocrypt")
    doc = db.otps.find_one({"email": email}, sort=[("expires_at", -1)])
    client.close()
    if not doc:
        return None
    return doc.get("code")

def do_login_request(email, password):
    url = f"{BASE}/auth/login"
    payload = {"email": email, "password": password}
    r = requests.post(url, json=payload)
    r.raise_for_status()
    print(f"[login] OTP request response: {r.json()}")
    # wait a short moment for OTP to be written to DB
    time.sleep(0.7)
    otp = read_otp_from_mongo(email)
    print(f"[login] OTP for {email} read from DB: {otp}")
    return otp

def verify_otp(email, code):
    url = f"{BASE}/auth/verify-otp"
    data = {"email": email, "code": code}
    r = requests.post(url, data=data)
    r.raise_for_status()
    return r.json()["access_token"], r.json().get("role")

def create_employee(admin_token, email, password, name):
    url = f"{BASE}/admin/create-employee"
    payload = {"email": email, "password": password, "name": name}
    headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    r = requests.post(url, json=payload, headers=headers)
    if r.status_code == 200:
        return r.json()
    if r.status_code == 400:
        # print backend message for debugging and continue
        try:
            print("create_employee: backend 400:", r.json())
        except Exception:
            print("create_employee: backend 400 (no json):", r.text)
        return {"detail": "employee already exists (skipped)"}
    r.raise_for_status()


def upload_file(admin_token, filepath):
    url = f"{BASE}/admin/upload-file"
    headers = {"Authorization": f"Bearer {admin_token}"}
    with open(filepath, "rb") as fh:
        files = {"file": (os.path.basename(filepath), fh)}
        r = requests.post(url, files=files, headers=headers)
    r.raise_for_status()
    return r.json()["file_id"]

def employee_request_and_download(emp_token, file_id, out_path):
    url = f"{BASE}/employee/request-and-download"
    headers = {"Authorization": f"Bearer {emp_token}"}
    # use geofence coords from your .env
    lat = float(os.getenv("GEOFENCE_CENTER_LAT", 9.35866726100274))
    lon = float(os.getenv("GEOFENCE_CENTER_LON", 76.67729687183018))
    data = {"file_id": file_id, "lat": str(lat), "lon": str(lon), "client_network_hint": os.getenv("ALLOWED_WIFI_SSID","GNXS-92f598")}
    r = requests.post(url, data=data, headers=headers, stream=True)
    if r.status_code != 200:
        print("[download] request returned status", r.status_code, r.text)
        r.raise_for_status()
    # stream to file
    with open(out_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
    print(f"[download] saved to {out_path}")

def show_recent_logs(limit=10):
    client = MongoClient(MONGO_URI)
    db = client.get_database("geocrypt")
    docs = list(db.logs.find().sort("time", -1).limit(limit))
    client.close()
    print("Recent logs:")
    for d in docs:
        print(d)

def main():
    print("== Admin login (request OTP) ==")
    otp = do_login_request(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not otp:
        raise SystemExit("OTP not found in DB for admin; ensure server wrote otp.")
    admin_token, role = verify_otp(ADMIN_EMAIL, otp)
    print("Admin token acquired. role=", role)

    print("== Create employee via admin API ==")
    res = create_employee(admin_token, EMP_EMAIL, EMP_PASSWORD, EMP_NAME)
    print("create_employee:", res)

    print("== Employee login (request OTP) ==")
    emp_otp = do_login_request(EMP_EMAIL, EMP_PASSWORD)
    if not emp_otp:
        raise SystemExit("Employee OTP not found")
    emp_token, emp_role = verify_otp(EMP_EMAIL, emp_otp)
    print("Employee token acquired. role=", emp_role)

    print("== Admin uploads a sample file ==")
    file_id = upload_file(admin_token, SAMPLE_FILE_PATH)
    print("Uploaded file_id:", file_id)

    print("== Employee requests and downloads file ==")
    out_path = "downloaded_sample.bin"
    employee_request_and_download(emp_token, file_id, out_path)

    print("== Validate file contents ==")
    with open(out_path, "rb") as f:
        data = f.read()
    print("Downloaded bytes length:", len(data))
    print("First bytes preview:", data[:200])

    print("== Recent logs from DB ==")
    show_recent_logs()

if __name__ == "__main__":
    main()
