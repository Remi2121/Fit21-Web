// src/Admin/components/CommitteeSection.jsx
import React, { useEffect, useState } from "react";
import {
  getCommitteeMembers,
  addCommitteeMember,
  updateCommitteeMember,
  deleteCommitteeMember,
} from "../services/committee.service";

export default function CommitteeSection() {
  const [committee, setCommittee] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // ---------- LOAD MEMBERS ----------
  async function loadMembers() {
    try {
      setLoading(true);
      setError("");
      const data = await getCommitteeMembers();
      setCommittee(data || []);
    } catch (err) {
      console.error("Error fetching committee:", err);
      setError("Failed to load committee members.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  // ---------- HANDLERS ----------
  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    setPhotoFile(file || null);
  }

  function resetForm() {
    setFormData({
      name: "",
      role: "",
      phone: "",
      email: "",
    });
    setPhotoFile(null);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.name.trim() || !formData.role.trim()) {
      alert("Name and role are required 🙂");
      return;
    }

    try {
      setError("");

      if (editingId) {
        await updateCommitteeMember(editingId, formData, photoFile);
      } else {
        await addCommitteeMember(formData, photoFile);
      }

      resetForm();
      await loadMembers();
    } catch (err) {
      console.error("Error saving member:", err);
      setError("Failed to save member.");
    }
  }

  function handleEdit(member) {
    setEditingId(member.id);
    setFormData({
      name: member.name || "",
      role: member.role || "",
      phone: member.phone || "",
      email: member.email || "",
    });
    setPhotoFile(null);
  }

  async function handleDelete(id) {
    const ok = window.confirm("Are you sure you want to delete this member?");
    if (!ok) return;

    try {
      setError("");
      await deleteCommitteeMember(id);
      await loadMembers();
    } catch (err) {
      console.error("Error deleting member:", err);
      setError("Failed to delete member.");
    }
  }

  function handleCancelEdit() {
    resetForm();
  }

  // ---------- UI ----------
  return (
    // OUTER WRAPPER – FULL PAGE BACKGROUND
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background:
          "radial-gradient(circle at top left, #ff6a3d 0, #1b1023 35%, #050816 80%)",
        color: "#fff",
      }}
    >
      {/* INNER CONTENT CONTAINER */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem" }}>
        <h2
          style={{
            fontSize: "2rem",
            fontWeight: "bold",
            marginBottom: "1rem",
          }}
        >
          Committee Members
        </h2>

        {error && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.5rem 0.75rem",
              backgroundColor: "#ffe5e5",
              color: "#b00020",
              borderRadius: "6px",
            }}
          >
            {error}
          </div>
        )}

        {/* FORM CARD */}
        <div
          style={{
            marginBottom: "2rem",
            padding: "1.5rem",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.1)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(0,0,0,0.4))",
            backdropFilter: "blur(10px)",
          }}
        >
          <h3 style={{ marginBottom: "1rem", fontSize: "1.2rem" }}>
            {editingId ? "Edit member" : "Add new member"}
          </h3>

          <form
            onSubmit={handleSubmit}
            style={{ display: "grid", gap: "0.75rem" }}
          >
            <label>
              <span>Name</span>
              <input
                type="text"
                name="name"
                placeholder="e.g. John Doe"
                value={formData.name}
                onChange={handleInputChange}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  marginTop: "0.25rem",
                  borderRadius: "6px",
                  border: "1px solid #444",
                  background: "rgba(0,0,0,0.5)",
                  color: "#fff",
                }}
              />
            </label>

            <label>
              <span>Role</span>
              <input
                type="text"
                name="role"
                placeholder="e.g. President"
                value={formData.role}
                onChange={handleInputChange}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  marginTop: "0.25rem",
                  borderRadius: "6px",
                  border: "1px solid #444",
                  background: "rgba(0,0,0,0.5)",
                  color: "#fff",
                }}
              />
            </label>

            <label>
              <span>Phone</span>
              <input
                type="text"
                name="phone"
                placeholder="e.g. +94 71 234 5678"
                value={formData.phone}
                onChange={handleInputChange}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  marginTop: "0.25rem",
                  borderRadius: "6px",
                  border: "1px solid #444",
                  background: "rgba(0,0,0,0.5)",
                  color: "#fff",
                }}
              />
            </label>

            <label>
              <span>Email</span>
              <input
                type="email"
                name="email"
                placeholder="e.g. john@example.com"
                value={formData.email}
                onChange={handleInputChange}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  marginTop: "0.25rem",
                  borderRadius: "6px",
                  border: "1px solid #444",
                  background: "rgba(0,0,0,0.5)",
                  color: "#fff",
                }}
              />
            </label>

            <label>
              <span>Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ width: "100%", marginTop: "0.25rem", color: "#fff" }}
              />
              {photoFile && (
                <span style={{ fontSize: "0.8rem", color: "#bbb" }}>
                  Selected: {photoFile.name}
                </span>
              )}
            </label>

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                marginTop: "0.75rem",
              }}
            >
              <button
                type="submit"
                style={{
                  padding: "0.5rem 1.1rem",
                  borderRadius: "999px",
                  border: "none",
                  background:
                    "linear-gradient(135deg, #ff5f6d 0%, #ffc371 100%)",
                  color: "#000",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {editingId ? "Update" : "Add"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    padding: "0.5rem 1.1rem",
                    borderRadius: "999px",
                    border: "1px solid #888",
                    background: "transparent",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* LIST */}
        {loading ? (
          <p style={{ color: "#ccc" }}>Loading members…</p>
        ) : committee.length === 0 ? (
          <p style={{ color: "#ccc" }}>No members yet. Add the first one 👆</p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {committee.map((member) => {
              // support different possible field names from Firestore
              const photoSrc =
                member.photoUrl || member.mediaUrl || member.photo || "";

              return (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 0.5rem",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                    }}
                  >
                    {photoSrc ? (
                      <img
                        src={photoSrc}
                        alt={member.name}
                        style={{
                          width: "46px",
                          height: "46px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "2px solid rgba(255,255,255,0.3)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "46px",
                          height: "46px",
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg, #4c669f, #3b5998, #192f6a)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        {member.name?.[0] || "?"}
                      </div>
                    )}

                    <div>
                      <div style={{ fontWeight: 600, color: "#fff" }}>
                        {member.name}
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "#ccc" }}>
                        {member.role}
                      </div>
                      {member.phone && (
                        <div style={{ fontSize: "0.8rem", color: "#aaa" }}>
                          📞 {member.phone}
                        </div>
                      )}
                      {member.email && (
                        <div style={{ fontSize: "0.8rem", color: "#aaa" }}>
                          ✉️ {member.email}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => handleEdit(member)}
                      style={{
                        padding: "0.25rem 0.8rem",
                        borderRadius: "999px",
                        border: "1px solid #60a5fa",
                        background: "transparent",
                        color: "#bfdbfe",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(member.id)}
                      style={{
                        padding: "0.25rem 0.8rem",
                        borderRadius: "999px",
                        border: "1px solid #f87171",
                        background: "transparent",
                        color: "#fecaca",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
