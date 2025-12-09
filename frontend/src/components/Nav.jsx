// src/components/Nav.jsx (Admin button removed)
import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

/* --- JWT Helper Functions --- */
function parseJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch (e) {
    return null;
  }
}

function readStoredToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    null
  );
}

/* --- NAV COMPONENT --- */
export default function Nav() {
  const navigate = useNavigate();

  const authInfo = useMemo(() => {
    const token = readStoredToken();
    if (!token) return { authenticated: false };

    const payload = parseJwt(token);
    if (!payload) return { authenticated: false };

    // Check expiry
    if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("token");
      return { authenticated: false };
    }

    return {
      authenticated: true,
      role: payload.role,
      email: payload.sub || payload.email,
    };
  }, []);

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/");
    window.location.reload();
  }

  return (
    <nav
      className="top-nav"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 22px",
        backdropFilter: "blur(14px)",
        background: "rgba(255,255,255,0.22)",
        borderBottom: "1px solid rgba(255,255,255,0.18)",
      }}
    >
      {/* LEFT BRAND */}
      <div
        style={{
          fontSize: "22px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <div
          style={{
            height: 34,
            width: 34,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: "white",
            fontWeight: 900,
            fontSize: 18,
          }}
        >
          G
        </div>
        <Link
          to="/"
          style={{
            textDecoration: "none",
            color: "black",
            fontWeight: 600,
            fontSize: 20,
          }}
        >
          Geocrypt
        </Link>
      </div>

      {/* RIGHT SIDE BUTTONS */}
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Link
          to="/"
          style={{
            textDecoration: "none",
            fontSize: 15,
            color: "black",
            opacity: 0.9,
          }}
        >
          Home
        </Link>

        {/* Show email when logged in */}
        {authInfo.authenticated && (
          <div
            className="small muted"
            style={{ opacity: 0.8, fontSize: 14 }}
          >
            {authInfo.email}
          </div>
        )}

        {/* Logout button */}
        {authInfo.authenticated ? (
          <button
            className="btn"
            onClick={handleLogout}
            style={{
              padding: "6px 16px",
              borderRadius: 12,
              fontWeight: 600,
              background:
                "linear-gradient(135deg, #ff416c, #ff4b2b)",
              color: "white",
              border: "none",
            }}
          >
            Logout
          </button>
        ) : (
          <Link
            to="/"
            className="btn"
            style={{
              padding: "6px 16px",
              borderRadius: 12,
              fontWeight: 600,
              background:
                "linear-gradient(135deg, #6a11cb, #2575fc)",
              color: "white",
              textDecoration: "none",
            }}
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
