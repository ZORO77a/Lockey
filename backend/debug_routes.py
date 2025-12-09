# backend/debug_routes.py
import asyncio
from main import app

def list_routes():
    out = []
    for r in app.routes:
        methods = ",".join(sorted(getattr(r, "methods", []))) if hasattr(r, "methods") else ""
        out.append(f"{r.path}  {methods}")
    return out

if __name__ == "__main__":
    for line in list_routes():
        print(line)
