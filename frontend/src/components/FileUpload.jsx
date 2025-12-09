// src/components/FileUpload.jsx
import React, { useState } from "react";
import API from "../api";

export default function FileUpload({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e && e.preventDefault();
    if (!file) return alert("Select a file first");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await API.post("/admin/upload-file", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Upload successful");
      setFile(null);
      onUploaded && onUploaded(res.data);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.detail || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button className="force-visible-btn" type="submit" style={{ width: 160 }}>
        {loading ? "Uploading..." : "Upload File"}
      </button>
    </form>
  );
}
