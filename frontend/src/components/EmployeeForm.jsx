// src/components/EmployeeForm.jsx
import React, { useState, useEffect } from "react";
import API from "../api";

export default function EmployeeForm({ initial, onSaved, onClose }) {
  const [email, setEmail] = useState(initial?.email || "");
  const [name, setName] = useState(initial?.name || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEmail(initial?.email || "");
    setName(initial?.name || "");
    setPassword("");
  }, [initial]);

  async function save(e) {
    e && e.preventDefault();
    setLoading(true);
    try {
      if (initial?.email) {
        // send PUT JSON payload (backend expects JSON)
        const payload = { email: initial.email, new_email: email, name };
        if (password) payload.password = password;
        await API.put("/admin/update-employee", payload);
        alert("Updated");
      } else {
        if (!password) { alert("provide temporary password"); setLoading(false); return; }
        await API.post("/admin/create-employee", { email, password, name });
        alert("Created");
      }
      onSaved && onSaved();
      onClose && onClose();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.detail || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label>Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />

      <label>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="input" />

      <label>{initial?.email ? "Change password (optional)" : "Temporary password"}</label>
      <input value={password} onChange={(e) => setPassword(e.target.value)} className="input" type="password" />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn" disabled={loading}>{loading ? "Saving..." : (initial?.email ? "Update" : "Create")}</button>
      </div>
    </form>
  );
}
