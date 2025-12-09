// src/pages/AdminSettings.jsx
import React, { useEffect, useState } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";

/**
 * Visible, debug-friendly Admin Settings page.
 * - Will attempt GET /admin/settings and show result (or error)
 * - Allows updating via PUT /admin/settings
 *
 * If the page stays blank, open DevTools -> Console to see the logged error.
 */

function isValidHHMM(v) {
  return typeof v === "string" && /^([01]?\d|2[0-3]):([0-5]\d)$/.test(v);
}

export default function AdminSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    latitude: "9.35866726100274",
    longitude: "76.67729687183018",
    radius_m: 1000,
    allowed_ssid: "GNXS-92f598",
    start_time: "09:00",
    end_time: "17:00",
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      console.log("[AdminSettings] fetching /admin/settings ...");
      try {
        const res = await API.get("/admin/settings");
        console.log("[AdminSettings] GET /admin/settings response:", res);
        const data = res?.data ?? res;
        if (!mounted) return;
        setForm({
          latitude: data.latitude ?? form.latitude,
          longitude: data.longitude ?? form.longitude,
          radius_m: data.radius_m ?? form.radius_m,
          allowed_ssid: data.allowed_ssid ?? form.allowed_ssid,
          start_time: data.start_time ?? form.start_time,
          end_time: data.end_time ?? form.end_time,
        });
      } catch (err) {
        console.error("[AdminSettings] load error:", err);
        setError(err?.response?.data?.detail || err.message || "Failed to load settings");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    if (isNaN(Number(form.latitude)) || isNaN(Number(form.longitude))) {
      setError("Latitude and longitude must be numbers");
      return false;
    }
    if (!Number.isInteger(Number(form.radius_m)) || Number(form.radius_m) < 0) {
      setError("Radius must be a non-negative integer");
      return false;
    }
    if (!isValidHHMM(form.start_time) || !isValidHHMM(form.end_time)) {
      setError("Start/End time must be HH:MM format");
      return false;
    }
    setError(null);
    return true;
  }

  async function onSave(e) {
    e?.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setError(null);
    console.log("[AdminSettings] saving", form);
    try {
      const payload = {
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius_m: Number(form.radius_m),
        allowed_ssid: String(form.allowed_ssid ?? ""),
        start_time: form.start_time,
        end_time: form.end_time,
      };
      const res = await API.put("/admin/settings", payload);
      console.log("[AdminSettings] PUT response:", res);
      alert("Settings saved");
    } catch (err) {
      console.error("[AdminSettings] save error:", err);
      setError(err?.response?.data?.detail || err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // clear visible layout so nothing looks empty
  return (
    <div style={{
      padding: 28,
      minHeight: "60vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      background: "transparent"
    }}>
      <div style={{
        width: 980,
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,250,255,0.96))",
        padding: 28,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0 }}>Geofence Configuration</h2>
            <div style={{ color: "#555", marginTop: 6, fontSize: 13 }}>Set location, radius, wifi and office time window.</div>
          </div>
          <div>
            <button className="btn" onClick={() => navigate("/admin")} style={{ marginRight: 12 }}>Back to Overview</button>
            <button className="btn" onClick={() => { setForm({
              latitude: "9.35866726100274",
              longitude: "76.67729687183018",
              radius_m: 1000,
              allowed_ssid: "GNXS-92f598",
              start_time: "09:00",
              end_time: "17:00",
            }); }}>Reset defaults</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 20, color: "#444" }}>Loading settings...</div>
        ) : (
          <form onSubmit={onSave} style={{ display: "grid", gap: 14 }}>
            {error && <div style={{ color: "#a00", padding: 8, borderRadius: 6, background: "#fff0f0" }}>Error: {String(error)}</div>}

            <label>
              <div style={{ fontSize: 13, color: "#444", marginBottom: 6 }}>Latitude</div>
              <input className="input" value={form.latitude} onChange={(e) => updateField("latitude", e.target.value)} />
            </label>

            <label>
              <div style={{ fontSize: 13, color: "#444", marginBottom: 6 }}>Longitude</div>
              <input className="input" value={form.longitude} onChange={(e) => updateField("longitude", e.target.value)} />
            </label>

            <label>
              <div style={{ fontSize: 13, color: "#444", marginBottom: 6 }}>Radius (meters)</div>
              <input className="input" type="number" min="0" value={form.radius_m} onChange={(e) => updateField("radius_m", e.target.value)} />
            </label>

            <label>
              <div style={{ fontSize: 13, color: "#444", marginBottom: 6 }}>Allowed WiFi SSID</div>
              <input className="input" value={form.allowed_ssid} onChange={(e) => updateField("allowed_ssid", e.target.value)} />
            </label>

            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#444", marginBottom: 6 }}>Start Time (HH:MM)</div>
                <input className="input" value={form.start_time} onChange={(e) => updateField("start_time", e.target.value)} />
              </label>

              <label style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#444", marginBottom: 6 }}>End Time (HH:MM)</div>
                <input className="input" value={form.end_time} onChange={(e) => updateField("end_time", e.target.value)} />
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 6 }}>
              <button className="btn" type="button" onClick={() => navigate("/admin")}>Cancel</button>
              <button className="btn primary" disabled={saving} type="submit">
                {saving ? "Saving…" : "Save Configuration"}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: 18, color: "#666", fontSize: 12 }}>
          Debug: open console to see GET/PUT logs. If you see network / auth / CORS errors there, copy them and paste here.
        </div>
      </div>
    </div>
  );
}
