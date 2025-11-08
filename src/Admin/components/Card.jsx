// src/Admin/components/Card.jsx
import React from "react";
import "../AdminDashboard.css";

export default function Card({ title, children }) {
  return (
    <div className="card">
      {title && <h3 className="card-title">{title}</h3>}
      {children}
    </div>
  );
}
