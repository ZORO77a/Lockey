// src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import API from "../api";
import FileUpload from "../components/FileUpload";
import WFHRequests from "../components/WFHRequests";
import Modal from "../components/Modal";
import EmployeeForm from "../components/EmployeeForm";
import { formatDateISOString } from "../utils";

/**
 * Admin dashboard page
 *
 * Responsibilities:
 *  - List employees (edit / delete)
 *  - Upload files
 *  - Show recent logs
 *  - Show WFH requests (uses WFHRequests component)
 *
 * Integration:
 *  - WFHRequests will call onChange() when something changed (approve/reject/revoke).
 *  - This page passes load() to reload employees/files/logs after such changes.
 */

export default function AdminDashboard() {
  const [employees, setEmployees] = useState([]);
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

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
    let mounted = true;
    // initial load
    (async () => {
      if (!mounted) return;
      await load();
    })();
    return () => { mounted = false; };
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
      alert("Deleted");
      await load(); // reload lists after deletion
    } catch (err) {
      console.error("deleteEmployee error", err);
      alert(err?.response?.data?.detail || "Delete failed");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0 }}>Admin Dashboard</h2>
          <div className="small">Manage employees, files and logs</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
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
                    {employees.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: 12, color: "var(--muted)" }}>No employees</td></tr>
                    )}
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

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {files.length === 0 && <div style={{ color: "var(--muted)" }}>No files uploaded</div>}
              {files.map((f) => (
                <div key={f._id} className="file-item" style={{ padding: 8 }}>
                  <div style={{ fontWeight: 700 }}>{f.filename}</div>
                  <div className="small">{f.uploaded_by} • {f.uploaded_at ? formatDateISOString(f.uploaded_at) : ""}</div>
                </div>
              ))}
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

            {/* Use onChange so WFHRequests tells the parent to reload data after actions */}
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
    </div>
  );
}
