// src/Admin/components/Input.jsx
import React from "react";
import "../AdminDashboard.css";

export default function Input({ label, type = "text", ...props }) {
  return (
    <div className="input-wrapper">
      <label className="input-label">{label}</label>
      <input type={type} className="input-control" {...props} />
    </div>
  );
}
