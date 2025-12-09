// src/components/WFHRequests.jsx
import React, { useEffect, useState } from "react";
import API from "../api";
import Modal from "./Modal"; // assumes Modal is at src/components/Modal.jsx

/**
 * Admin WFH Requests component (full replacement)
 *
 * Calls:
 *  GET  /admin/wfh_requests
 *  POST /admin/approve-wfh    (form request_id)
 *  POST /admin/reject-wfh     (form request_id)
 *  POST /admin/revoke-wfh     (form user_email)
 *
 * Props:
 *  - onChange(optional): function called with { type, requestId, email } after actions
 */

function fmt(dt) {
  if (!dt) return "";
  try {
    const d = typeof dt === "string" ? new Date(dt) : dt;
    if (Number.isNaN(d.getTime())) return dt;
    return d.toLocaleString();
  } catch {
    return dt;
  }
}

export default function WFHRequests({ onChange }) {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await API.get("/admin/wfh_requests");
      const all = Array.isArray(res.data) ? res.data : [];
      // normalize status
      const normalized = all.map((r) => ({ ...r, status: (r.status || "pending").toLowerCase() }));
      const pend = normalized.filter((r) => r.status === "pending");
      const appr = normalized.filter((r) => r.status === "approved");
      // sort
      pend.sort((a, b) => (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0));
      appr.sort((a, b) => (b.approved_at ? new Date(b.approved_at).getTime() : 0) - (a.approved_at ? new Date(a.approved_at).getTime() : 0));
      setPending(pend);
      setApproved(appr);
    } catch (err) {
      console.error("Failed to load WFH requests:", err);
      setPending([]);
      setApproved([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function doApprove(req) {
    if (!confirm(`Approve WFH for ${req.requested_by}?\n${req.start_date} → ${req.end_date}`)) return;
    setActionLoading(req._id);
    try {
      const form = new URLSearchParams({ request_id: req._id });
      await API.post("/admin/approve-wfh", form);
      // update local state
      setPending((p) => p.filter((x) => x._id !== req._id));
      setApproved((a) => [{ ...req, status: "approved", approved_at: new Date().toISOString() }, ...a]);
      if (onChange) onChange({ type: "approved", requestId: req._id, email: req.requested_by });
    } catch (err) {
      console.error("Approve failed:", err);
      alert(err?.response?.data?.detail || "Approve failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function doReject(req) {
    if (!confirm(`Reject WFH for ${req.requested_by}?`)) return;
    setActionLoading(req._id);
    try {
      const form = new URLSearchParams({ request_id: req._id });
      await API.post("/admin/reject-wfh", form);
      setPending((p) => p.filter((x) => x._id !== req._id));
      if (onChange) onChange({ type: "rejected", requestId: req._id, email: req.requested_by });
    } catch (err) {
      console.error("Reject failed:", err);
      alert(err?.response?.data?.detail || "Reject failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function doRevoke(approvedReq) {
    if (!confirm(`Revoke WFH access for ${approvedReq.requested_by}?`)) return;
    const email = approvedReq.requested_by;
    setActionLoading(email);
    try {
      const form = new URLSearchParams({ user_email: email });
      const res = await API.post("/admin/revoke-wfh", form);
      // server will mark corresponding requests as 'revoked'
      // remove locally
      setApproved((a) => a.filter((x) => x._id !== approvedReq._id));
      if (onChange) onChange({ type: "revoked", requestId: approvedReq._id, email });
      alert("WFH access revoked");
    } catch (err) {
      console.error("Revoke failed:", err);
      alert(err?.response?.data?.detail || "Revoke failed");
    } finally {
      setActionLoading(null);
    }
  }

  function openView(req) {
    setViewData(req);
    setViewOpen(true);
  }

  return (
    <div style={{ padding: 6 }}>
      <h4 style={{ marginTop: 0 }}>Pending Requests</h4>

      {loading && <div style={{ padding: 8 }}>Loading requests…</div>}
      {!loading && pending.length === 0 && <div style={{ color: "var(--muted)", padding: 8 }}>No pending requests</div>}

      {pending.map((r) => (
        <div key={r._id} style={{
          marginBottom: 12, padding: 12, borderRadius: 10, display: "flex",
          justifyContent: "space-between", alignItems: "center",
          background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))"
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{r.requested_by}</div>
            <div className="small" style={{ marginTop: 6 }}>{r.start_date} → {r.end_date}</div>
            {r.reason && <div style={{ marginTop: 6 }}>{r.reason}</div>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <button className="btn" disabled={actionLoading !== null} onClick={() => doApprove(r)} style={{ minWidth: 110 }}>
              {actionLoading === r._id ? "…" : "Approve"}
            </button>
            <button className="btn danger" disabled={actionLoading !== null} onClick={() => doReject(r)} style={{ minWidth: 110 }}>
              {actionLoading === r._id ? "…" : "Reject"}
            </button>
          </div>
        </div>
      ))}

      <hr style={{ margin: "18px 0", border: "none", borderTop: "1px solid rgba(0,0,0,0.03)" }} />

      <h4 style={{ marginTop: 0 }}>Approved Requests</h4>
      {approved.length === 0 && <div style={{ color: "var(--muted)", padding: 8 }}>No approved requests</div>}

      {approved.map((a) => (
        <div key={a._id} style={{
          marginBottom: 12, padding: 12, borderRadius: 10, display: "flex",
          justifyContent: "space-between", alignItems: "center",
          background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))"
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{a.requested_by}</div>
            <div className="small" style={{ marginTop: 6 }}>{a.start_date} → {a.end_date}</div>
            <div className="small" style={{ marginTop: 6, color: "var(--muted)" }}>
              Status: {a.status || "approved"}{a.approved_at ? ` • approved at ${fmt(a.approved_at)}` : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn ghost" onClick={() => openView(a)}>View</button>
            <button className="btn danger" disabled={actionLoading !== null} onClick={() => doRevoke(a)}>
              {actionLoading === a.requested_by ? "…" : "Revoke Access"}
            </button>
          </div>
        </div>
      ))}

      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title="WFH Request Details">
        {viewData ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div><strong>Requested by:</strong> {viewData.requested_by}</div>
            <div><strong>Start:</strong> {viewData.start_date}</div>
            <div><strong>End:</strong> {viewData.end_date}</div>
            <div><strong>Reason:</strong> {viewData.reason || "(none)"}</div>
            <div><strong>Status:</strong> {viewData.status}</div>
            {viewData.approved_at && <div><strong>Approved at:</strong> {fmt(viewData.approved_at)}</div>}
            {viewData.rejected_at && <div><strong>Rejected at:</strong> {fmt(viewData.rejected_at)}</div>}
            {viewData.revoked_at && <div><strong>Revoked at:</strong> {fmt(viewData.revoked_at)}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="btn ghost" onClick={() => setViewOpen(false)}>Close</button>
            </div>
          </div>
        ) : (
          <div>Loading…</div>
        )}
      </Modal>
    </div>
  );
}
