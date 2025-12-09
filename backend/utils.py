# utils.py - geofence, time checks, haversine
import os
import math
from datetime import datetime, time
from dotenv import load_dotenv

load_dotenv()

CENTER_LAT = float(os.getenv("GEOFENCE_CENTER_LAT", "9.35866726100274"))
CENTER_LON = float(os.getenv("GEOFENCE_CENTER_LON", "76.67729687183018"))
RADIUS_M = float(os.getenv("GEOFENCE_RADIUS_M", "1000"))
WORKDAY_START = os.getenv("WORKDAY_START", "09:00")
WORKDAY_END = os.getenv("WORKDAY_END", "17:00")
ALLOWED_WIFI_SSID = os.getenv("ALLOWED_WIFI_SSID", None)

def haversine_meters(lat1, lon1, lat2, lon2):
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def is_within_geofence(lat: float, lon: float) -> bool:
    dist = haversine_meters(lat, lon, CENTER_LAT, CENTER_LON)
    return dist <= RADIUS_M

def is_within_work_hours(now: datetime = None) -> bool:
    now = now or datetime.now()
    start_h, start_m = map(int, WORKDAY_START.split(":"))
    end_h, end_m = map(int, WORKDAY_END.split(":"))
    start = time(start_h, start_m)
    end = time(end_h, end_m)
    return start <= now.time() <= end
