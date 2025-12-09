import React, { useState } from "react";
import API from "../api";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();

  const [activeTab, setActiveTab] = useState("admin");

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [empEmail, setEmpEmail] = useState("");
  const [empPassword, setEmpPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function submitLogin(email, password, role) {
    setLoading(true);
    try {
      await API.post("/auth/login", { email, password });
      nav("/verify-otp", { state: { email, role } });
    } catch (err) {
      alert(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function submitAdmin(e) {
    e.preventDefault();
    submitLogin(adminEmail.trim(), adminPassword, "admin");
  }

  function submitEmployee(e) {
    e.preventDefault();
    submitLogin(empEmail.trim(), empPassword, "employee");
  }

  return (
    <div className="card" style={{ maxWidth: 480, margin: "40px auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>Sign In</h2>

      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20, gap: 10 }}>
        <button
          className={activeTab === "admin" ? "btn" : "btn ghost"}
          onClick={() => setActiveTab("admin")}
        >
          Admin
        </button>

        <button
          className={activeTab === "employee" ? "btn" : "btn ghost"}
          onClick={() => setActiveTab("employee")}
        >
          Employee
        </button>
      </div>

      {/* ADMIN FORM */}
      {activeTab === "admin" && (
        <form onSubmit={submitAdmin}>
          <div className="form-row">
            <label>Admin Email</label>
            <input
              className="input"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
            />
          </div>

          {/* CLEARLY VISIBLE LOGIN BUTTON */}
          <button type="submit" className="login-submit-btn">
            {loading ? "Sending OTP..." : "Login as Admin"}
          </button>


          <p className="small" style={{ marginTop: 8 }}>
            An OTP will be sent to the admin email.
          </p>
        </form>
      )}

      {/* EMPLOYEE FORM */}
      {activeTab === "employee" && (
        <form onSubmit={submitEmployee}>
          <div className="form-row">
            <label>Employee Email</label>
            <input
              className="input"
              type="email"
              value={empEmail}
              onChange={(e) => setEmpEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={empPassword}
              onChange={(e) => setEmpPassword(e.target.value)}
              required
            />
          </div>

          {/* CLEAR LOGIN BUTTON */}
          <button type="submit" className="login-submit-btn">
            {loading ? "Sending OTP..." : "Login as Employee"}
          </button>


          <p className="small" style={{ marginTop: 8 }}>
            OTP will be sent to your registered email.
          </p>
        </form>
      )}
    </div>
  );
}
