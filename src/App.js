// src/App.js
import React from "react";
import "./App.css";  // styles ku

import { Routes, Route, Link, Navigate } from "react-router-dom";

import Home from "./Home.jsx";
import Pages from "./pages/pages.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import ScrollToHash from "./components/common/ScrollToTop.jsx";

function App() {
  return (
    <div className="App">
      {/* URL hash maari scroll panna */}
      <ScrollToHash />

      {/* Top navbar – home + admin link */}
      <nav
        style={{
          padding: "10px 20px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
          background: "white",
        }}
      >
        <div>
          <Link to="/" style={{ marginRight: "15px", fontWeight: 600 }}>
            FIT21
          </Link>
        </div>
        <div>
          <Link to="/" style={{ marginRight: "10px" }}>
            Home
          </Link>
          <Link to="/admin">Admin</Link>
        </div>
      </nav>

      {/* Routes ellam */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pages" element={<Pages />} />
        <Route path="/admin" element={<AdminDashboard />} />

        {/* old hash routes */}
        <Route
          path="/contact"
          element={<Navigate to="/#contact" replace />}
        />
        <Route
          path="/login"
          element={<Navigate to="/#login" replace />}
        />
      </Routes>
    </div>
  );
}

export default App;
