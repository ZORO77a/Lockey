// src/pages/EmployeeDashboard.jsx
import React, { useEffect, useState } from "react";
import API from "../api";
import Modal from "../components/Modal";

export default function EmployeeDashboard() {
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [wfhModalOpen, setWfhModalOpen] = useState(false);
  const [wfhStart, setWfhStart] = useState("");
  const [wfhEnd, setWfhEnd] = useState("");
  const [wfhReason, setWfhReason] = useState("");

  async function load() {
    try {
      const [f, l] = await Promise.all([API.get("/admin/files"), API.get("/employee/my-logs")]);
      setFiles(f.data || []);
      setLogs(l.data || []);
    } catch (e) {
      console.warn(e);
    }
  }

  useEffect(() => { load(); }, []);

  async function previewFile(file) {
    try {
      const form = new URLSearchParams({ file_id: file.file_id, lat: 0, lon: 0, client_network_hint: "" });
      const res = await API.post("/employee/request-and-download", form, { responseType: "blob" });
      const blob = res.data;
      const text = await blob.text();
      openTextPreview(file.filename, text);
    } catch (err) {
      alert(err?.response?.data?.detail || "preview failed");
    }
  }

  function openTextPreview(filename, text) {
    const w = window.open("", "_blank");
    w.document.title = filename;
    w.document.body.style.background = "white";
    const pre = w.document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.textContent = text;
    w.document.body.appendChild(pre);
  }

  async function requestAndDownload(file) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const hint = prompt("Enter network hint (SSID or IP) or leave blank");
      try {
        const form = new URLSearchParams({ file_id: file.file_id, lat: String(lat), lon: String(lon), client_network_hint: hint || "" });
        const res = await API.post("/employee/request-and-download", form, { responseType: "blob" });
        const url = URL.createObjectURL(res.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.filename;
        a.click();
      } catch (e) { alert(e?.response?.data?.detail || "download failed"); }
    }, () => { alert("geolocation failed or denied"); });
  }

  async function openWfhModal() {
    setWfhStart("");
    setWfhEnd("");
    setWfhReason("");
    setWfhModalOpen(true);
  }

  async function submitWfh(e) {
    e && e.preventDefault();
    try {
      await API.post("/employee/request-wfh", { start_date: wfhStart, end_date: wfhEnd, reason: wfhReason });
      alert("WFH requested");
      setWfhModalOpen(false);
    } catch (err) {
      alert(err?.response?.data?.detail || "request failed");
    }
  }

  return (
    <div>
      <div className="header">
        <div><h2>Employee Dashboard</h2><div className="small">Access files and request WFH</div></div>
        <div>
          <button className="btn force-visible-btn" onClick={openWfhModal}>Request WFH</button>
        </div>
      </div>

      <div className="grid">
        <div>
          <div className="card">
            <h3>Available Files</h3>
            <div style={{ maxHeight: 420, overflow: "auto" }}>
              {files.map(f => (
                <div key={f._id} className="file-item">
                  <div>
                    <div>{f.filename}</div>
                    <div className="small">Uploaded: {f.uploaded_by}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn ghost force-ghost" onClick={() => previewFile(f)}>Preview</button>
                    <button className="btn force-visible-btn" onClick={() => requestAndDownload(f)}>Download</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3>My Logs</h3>
            <div style={{ maxHeight: 240, overflow: "auto" }}>
              {logs.map(l => (
                <div key={l._id} style={{ padding: 8, borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                  <div className="small">{l.time ? new Date(l.time).toLocaleString() : ""}</div>
                  <div>{l.action}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside>
          <div className="card">
            <h3>Quick Info</h3>
            <div className="small">Files are encrypted at rest; access is controlled by geofence, network hint and time window.</div>
          </div>
        </aside>
      </div>

      <Modal open={wfhModalOpen} onClose={() => setWfhModalOpen(false)} title="Request Work From Home">
        <form onSubmit={submitWfh}>
          <div className="form-row">
            <label>Start (YYYY-MM-DD HH:mm:ss)</label>
            <input className="input" value={wfhStart} onChange={e => setWfhStart(e.target.value)} placeholder="2025-12-09 09:00:00" required />
          </div>
          <div className="form-row">
            <label>End (YYYY-MM-DD HH:mm:ss)</label>
            <input className="input" value={wfhEnd} onChange={e => setWfhEnd(e.target.value)} placeholder="2025-12-09 17:00:00" required />
          </div>
          <div className="form-row">
            <label>Reason</label>
            <textarea className="input" value={wfhReason} onChange={e => setWfhReason(e.target.value)} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn ghost force-ghost" onClick={() => setWfhModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn force-visible-btn">Send Request</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
