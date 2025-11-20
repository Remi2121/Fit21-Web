// src/Admin/components/TeamMember.jsx
import React from "react";

export default function TeamMember({ member, onRemove }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 12,
        borderRadius: 8,
        background: "rgba(255,255,255,0.02)",
        marginBottom: 10,
      }}
    >
      <div>
        <div style={{ fontWeight: 700 }}>{member.username || member.id || "No name"}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{member.email || "—"}</div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="admin-btn"
          onClick={onRemove}
          style={{ padding: "8px 12px", borderRadius: 8 }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
