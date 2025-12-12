// src/pages/AdminDashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import FileUpload from "../components/FileUpload";
import WFHRequests from "../components/WFHRequests";
import Modal from "../components/Modal";
import EmployeeForm from "../components/EmployeeForm";
import { formatDateISOString } from "../utils";

/**
 * Small internal FilePreview component.
 * Props:
 *  - open (bool), fileId (string), filename (string), onClose (fn)
 * Uses your /stream-file endpoint and expects API to attach Authorization header.
 */
function FilePreview({ open, fileId, filename, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [mime, setMime] = useState(null);
  const [textPreview, setTextPreview] = useState(null);
  const urlRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (!fileId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    setMime(null);
    setTextPreview(null);

    async function load() {
      try {
        const form = new URLSearchParams();
        form.set("file_id", fileId);

        // responseType arraybuffer to get raw bytes
        const res = await API.post("/stream-file", form, { responseType: "arraybuffer" });

        // infer mime from response header if present, fallback to filename extension
        const headerMime = res.headers && res.headers["content-type"];
        let inferred = headerMime || inferMimeFromFilename(filename);

        const ab = res.data;
        const blob = new Blob([ab], { type: inferred });
        const url = URL.createObjectURL(blob);
        urlRef.current = url;

        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        setMime(inferred);
        setBlobUrl(url);

        // if text, decode and keep preview
        if (inferred.startsWith("text/")) {
          try {
            const dec = new TextDecoder("utf-8");
            const txt = dec.decode(ab);
            setTextPreview(txt.slice(0, 200000)); // limit for performance
          } catch (e) {
            // ignore decoding errors
          }
        }
      } catch (err) {
        console.error("File preview load error:", err);
        setError(err?.response?.data?.detail || err.message || "Failed to load file preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [open, fileId, filename]);

  function inferMimeFromFilename(name = "") {
    const ext = (name || "").split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "bmp", "webp"].includes(ext)) return ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    if (ext === "pdf") return "application/pdf";
    if (["txt", "log", "md", "csv", "json", "xml"].includes(ext)) return "text/plain";
    if (["mp4", "webm", "ogg"].includes(ext)) return `video/${ext}`;
    return "application/octet-stream";
  }

  function renderBody() {
    if (loading) return <div style={{ padding: 18 }}>Loading preview…</div>;
    if (error) return <div style={{ padding: 18, color: "#c0392b" }}>{error}</div>;
    if (!blobUrl) return <div style={{ padding: 18 }}>No preview available.</div>;

    if (mime?.startsWith("image/")) {
      return (
        <div style={{ padding: 12, display: "flex", justifyContent: "center" }}>
          <img src={blobUrl} alt={filename} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 8 }} />
        </div>
      );
    }

    if (mime === "application/pdf") {
      return (
        <div style={{ height: "70vh" }}>
          <iframe title={filename} src={blobUrl} style={{ width: "100%", height: "100%", border: "none" }} />
        </div>
      );
    }

    if (mime?.startsWith("video/")) {
      return (
        <div style={{ padding: 12 }}>
          <video controls style={{ width: "100%", maxHeight: "70vh" }}>
            <source src={blobUrl} type={mime} />
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (mime?.startsWith("text/") || textPreview !== null) {
      return (
        <div style={{ padding: 12, maxHeight: "70vh", overflow: "auto", background: "#0b1220", color: "#e8eef8", borderRadius: 8 }}>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{textPreview || "Empty file"}</pre>
        </div>
      );
    }

    // fallback: show download and open links
    return (
      <div style={{ padding: 18 }}>
        <div style={{ marginBottom: 12 }}>No inline preview available for this file type.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn" href={blobUrl} download={filename}>Download</a>
          <a className="btn ghost" href={blobUrl} target="_blank" rel="noreferrer">Open in new tab</a>
        </div>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Preview: ${filename || ""}`} wide>
      <div style={{ minHeight: 120 }}>{renderBody()}</div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        {blobUrl && <a className="btn" href={blobUrl} download={filename}>Download</a>}
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  // preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState({ fileId: null, filename: null });

  async function load() {
    setLoading(true);
    try {
      const [e, f, l] = await Promise.all([
        API.get("/admin/employees"),
        API.get("/admin/files"),
        API.get("/admin/logs"),
      ]);
      setEmployees(e.data || []);
      setFiles(f.data || []);
      setLogs(l.data || []);
    } catch (err) {
      console.error("Failed to load admin data", err);
      alert("Failed to load admin data — check console");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openNewEmployee() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEditEmployee(emp) {
    setEditing(emp);
    setModalOpen(true);
  }

  async function deleteEmployee(email) {
    if (!confirm(`Delete ${email}?`)) return;
    try {
      await API.post("/admin/delete-employee", new URLSearchParams({ email }));
      await load();
    } catch (err) {
      console.error("deleteEmployee error", err);
      alert(err?.response?.data?.detail || "Delete failed");
    }
  }

  // open preview modal for file
  function openPreview(file) {
    // backend stores file_id as string; some records might have file_id or _id
    const fid = file.file_id || file.fileId || file._id;
    setPreviewFile({ fileId: String(fid), filename: file.filename || file.name || "file" });
    setPreviewOpen(true);
  }

  function closePreview() {
    setPreviewOpen(false);
    setPreviewFile({ fileId: null, filename: null });
  }

  // download helper using stream-file
  async function downloadFile(file) {
    try {
      const fid = file.file_id || file.fileId || file._id;
      const form = new URLSearchParams();
      form.set("file_id", String(fid));
      const res = await API.post("/stream-file", form, { responseType: "arraybuffer" });
      const contentType = res.headers && res.headers["content-type"] ? res.headers["content-type"] : "application/octet-stream";
      const blob = new Blob([res.data], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename || `download`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("downloadFile error", err);
      alert("Download failed — check console");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header: title + controls (Settings button added) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0 }}>Admin Dashboard</h2>
          <div className="small">Manage employees, files and logs</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => navigate("/admin/settings")}>Settings</button>
          <button className="btn force-visible-btn" onClick={openNewEmployee}>+ New Employee</button>
        </div>
      </div>

      <div className="grid" style={{ gap: 20 }}>
        <div style={{ flex: 1 }}>
          <div className="card">
            <h3>Employees</h3>
            {loading ? (
              <div style={{ padding: 12 }}>Loading employees…</div>
            ) : (
              <div style={{ maxHeight: 380, overflow: "auto" }}>
                <table className="table" style={{ width: "100%" }}>
                  <thead>
                    <tr><th>Email</th><th>Name</th><th>Created</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {employees.map((u) => (
                      <tr key={u._id}>
                        <td>{u.email}</td>
                        <td>{u.name}</td>
                        <td>{u.created_at ? formatDateISOString(u.created_at) : ""}</td>
                        <td>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn ghost force-ghost" onClick={() => openEditEmployee(u)}>Edit</button>
                            <button className="btn danger force-delete-btn" onClick={() => deleteEmployee(u.email)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {employees.length === 0 && <tr><td colSpan={4} style={{ padding: 12, color: "var(--muted)" }}>No employees</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3>Files</h3>
            <div style={{ marginBottom: 12 }}>
              <FileUpload onUploaded={() => load()} />
            </div>
            <div>
              {files.map((f) => (
                <div key={f._id || f.file_id} className="file-item" style={{ padding: 8, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{f.filename}</div>
                    <div className="small">{f.uploaded_by} • {f.uploaded_at ? formatDateISOString(f.uploaded_at) : ""}</div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn ghost" onClick={() => openPreview(f)}>Preview</button>
                    <button className="btn" onClick={() => downloadFile(f)}>Download</button>
                  </div>
                </div>
              ))}
              {files.length === 0 && <div style={{ color: "var(--muted)", padding: 8 }}>No files</div>}
            </div>
          </div>
        </div>

        <aside style={{ width: 420, minWidth: 320 }}>
          <div className="card">
            <h3>Recent Logs</h3>
            <div style={{ maxHeight: 360, overflow: "auto" }}>
              {logs.length === 0 && <div style={{ padding: 12, color: "var(--muted)" }}>No logs</div>}
              {logs.map((l) => (
                <div key={l._id} style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                  <div className="small">{formatDateISOString(l.time)} — {l.email}</div>
                  <div className="small">Action: {l.action}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3>WFH Requests</h3>
            <WFHRequests onChange={() => load()} />
          </div>
        </aside>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Employee" : "New Employee"}>
        <EmployeeForm
          initial={editing}
          onSaved={async () => { setModalOpen(false); await load(); }}
          onClose={() => setModalOpen(false)}
        />
      </Modal>

      <FilePreview
        open={previewOpen}
        fileId={previewFile.fileId}
        filename={previewFile.filename}
        onClose={closePreview}
      />
    </div>
  );
}
