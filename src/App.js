
import React from "react";
import "./App.css";
import { Routes, Route, Navigate, Link } from "react-router-dom";

import Home from "./Home.jsx";
import Pages from "./pages/pages.jsx";
import ScrollToHash from "./components/common/ScrollToTop.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx"; // admin page

function App() {
  return (
    <div className="App">
      {/* Hash change aagumbothu top-ku scroll pannum component */}
      <ScrollToHash />

      {/* Simple navbar – need na vechiko */}
      <nav
        style={{
          padding: "10px 20px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
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
          <Link to="/pages" style={{ marginRight: "10px" }}>
            Pages
          </Link>
          <Link to="/admin">Admin</Link>
        </div>
      </nav>

      <Routes>
        {/* User side routes */}
        <Route path="/" element={<Home />} />
        <Route path="/pages" element={<Pages />} />

        {/* Admin side route */}
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Old hash redirect routes – keep as it is */}
        <Route
          path="/contact"
          element={<Navigate to="/#contact" replace />}
        />
        <Route path="/login" element={<Navigate to="/#login" replace />} />

        {/* Unknown path -> go home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
