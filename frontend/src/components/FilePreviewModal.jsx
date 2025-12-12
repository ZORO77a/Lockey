// src/components/FilePreviewModal.jsx
import React, { useEffect, useState } from "react";
import API from "../api";
import Modal from "./Modal";

/**
 * Props:
 *  - open: boolean
 *  - fileId: string
 *  - filename: string
 *  - onClose: fn
 */
export default function FilePreviewModal({ open, fileId, filename, onClose }) {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [mime, setMime] = useState(null);
  const [textPreview, setTextPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (!fileId) return;
    let cancelled = false;
    let urlRef = null;
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    setTextPreview(null);

    async function load() {
      try {
        // call stream-file to get binary
        const form = new URLSearchParams();
        form.set("file_id", fileId);

        // stream-file returns bytes; make sure API attaches auth header
        const res = await API.post("/stream-file", form, { responseType: "arraybuffer" });

        // try to infer mime type from filename extension (best-effort)
        const ext = (filename || "").split(".").pop()?.toLowerCase() || "";
        let guessed = "application/octet-stream";
        if (["png","jpg","jpeg","gif","bmp","webp"].includes(ext)) guessed = `image/${ext === "jpg" ? "jpeg" : ext}`;
        if (ext === "pdf") guessed = "application/pdf";
        if (["txt","log","md","csv","json","xml"].includes(ext)) guessed = "text/plain";
        if (["mp4","webm","ogg"].includes(ext)) guessed = `video/${ext === "mp4" ? "mp4" : ext}`;

        // Use Content-Type header if backend provides it
        const contentTypeHeader = res.headers && res.headers["content-type"];
        const finalMime = contentTypeHeader || guessed;
        setMime(finalMime);

        const ab = res.data;
        const blob = new Blob([ab], { type: finalMime });
        urlRef = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(urlRef);
          return;
        }

        // for text types, attempt to decode as text preview
        if (finalMime.startsWith("text/")) {
          // decode UTF-8
          const dec = new TextDecoder("utf-8");
          const text = dec.decode(ab);
          // limit to first ~200KB for preview
          setTextPreview(text.slice(0, 200000));
          setBlobUrl(urlRef);
        } else {
          setBlobUrl(urlRef);
        }
      } catch (err) {
        console.error("preview load error:", err);
        setError(err?.response?.data?.detail || err.message || "Failed to load preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (urlRef) URL.revokeObjectURL(urlRef);
    };
  }, [open, fileId, filename]);

  function renderBody() {
    if (loading) return <div style={{ padding: 24 }}>Loading preview…</div>;
    if (error) return <div style={{ padding: 24, color: "var(--danger, #c0392b)" }}>{error}</div>;
    if (!blobUrl) return <div style={{ padding: 24 }}>No preview available.</div>;

    if (mime?.startsWith("image/")) {
      return (
        <div style={{ padding: 8, maxHeight: "70vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
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
        <div style={{ padding: 8 }}>
          <video controls style={{ maxWidth: "100%", maxHeight: "70vh" }}>
            <source src={blobUrl} type={mime} />
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (mime?.startsWith("text/") || textPreview !== null) {
      return (
        <div style={{ padding: 12, maxHeight: "70vh", overflow: "auto", background: "#0f1724", color: "#e6eef8", borderRadius: 8 }}>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{textPreview || "Empty file"}</pre>
        </div>
      );
    }

    // fallback: provide download and try to open in new tab
    return (
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 12 }}>No inline preview available for this file type.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={blobUrl} download={filename} className="btn">Download</a>
          <a href={blobUrl} target="_blank" rel="noreferrer" className="btn ghost">Open in new tab</a>
        </div>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Preview: ${filename || ""}`} wide>
      <div style={{ minHeight: 120 }}>
        {renderBody()}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        {blobUrl && <a href={blobUrl} download={filename} className="btn">Download</a>}
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
