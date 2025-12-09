// --------------------------------------------
// Imports (top of file)
// --------------------------------------------
import React, { useEffect, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import OtpVerify from "./pages/OtpVerify";
import AdminDashboard from "./pages/AdminDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import AdminSettings from "./pages/AdminSettings";
import Nav from "./components/Nav";

import API from "./api";
import {
  parseJwt,
  readToken,
  isTokenValid,
  scheduleAutoLogout,
  clearSession
} from "./utils/auth";


// --------------------------------------------
// 🛡️ PRIVATE ROUTE
// --------------------------------------------
function PrivateRoute({ children, role }) {
  const token = readToken();
  const valid = isTokenValid(token);

  // Reject if no token or expired or invalid
  if (!valid.valid) {
    clearSession();
    return <Navigate to="/" replace />;
  }

  const payload = parseJwt(token);
  const userRole = payload.role || localStorage.getItem("role");

  // Reject if role mismatch
  if (role && userRole !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}


// --------------------------------------------
// 🌐 MAIN APP COMPONENT
// --------------------------------------------
export default function App() {
  const logoutTimerRef = useRef(null);

  useEffect(() => {
    async function checkSession() {
      const token = readToken();
      if (!token) return;

      // Local JWT validation
      const validity = isTokenValid(token);
      if (!validity.valid) {
        console.log("Invalid session:", validity.reason);
        clearSession();
        return;
      }

      // Optional but recommended server-side validation
      try {
        const res = await API.get("/auth/me");
        if (res?.data?.role) {
          localStorage.setItem("role", res.data.role);
        }
      } catch (err) {
        console.warn("Server validation failed:", err);
        clearSession();
        return;
      }

      // Auto logout on token expiration
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);

      logoutTimerRef.current = scheduleAutoLogout(token, () => {
        console.log("Auto logout triggered (token expired)");
        clearSession();
        window.location.href = "/";
      });
    }

    checkSession();

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, []);


  return (
    <>
      <Nav />
      <div className="container">
        <Routes>

          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/verify-otp" element={<OtpVerify />} />

          {/* Admin Dashboard */}
          <Route
            path="/admin"
            element={
              <PrivateRoute role="admin">
                <AdminDashboard />
              </PrivateRoute>
            }
          />

          {/* Admin Settings Page */}
          <Route
            path="/admin/settings"
            element={
              <PrivateRoute role="admin">
                <AdminSettings />
              </PrivateRoute>
            }
          />

          {/* Employee Dashboard */}
          <Route
            path="/employee"
            element={
              <PrivateRoute role="employee">
                <EmployeeDashboard />
              </PrivateRoute>
            }
          />

          {/* Unknown route fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </div>
    </>
  );
}
