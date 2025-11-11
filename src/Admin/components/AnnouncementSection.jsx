// src/Admin/components/AnnouncementSection.jsx

import React, { useEffect, useState } from "react";
import {
  fetchAnnouncements,
  addAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../services/announcementService";

import { storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function AnnouncementSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // form-la day, title, message + mediaUrl
  const [form, setForm] = useState({
    day: "",
    title: "",
    message: "",
    mediaUrl: "",          // 👈 NEW
  });

  const [editingId, setEditingId] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // ---------- LOAD FROM FIRESTORE ----------
  async function loadAnnouncements() {
    try {
      setLoading(true);
      setError("");
      const data = await fetchAnnouncements();
      setItems(data);
    } catch (err) {
      console.error("Error loading announcements:", err);
      setError("Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnnouncements();
  }, []);

  // ---------- HELPERS ----------
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm({
      day: "",
      title: "",
      message: "",
      mediaUrl: "",        // 👈 reset pannren
    });
    setMediaFile(null);
    setEditingId(null);
  }

  async function uploadMediaFile(file) {
    if (!file) return { url: "", type: "" };

    const path = `announcements/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    let type = "file";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.startsWith("video/")) type = "video";
    else if (file.type === "application/pdf") type = "file";

    return { url, type };
  }

  // ---------- SAVE ----------
  async function handleSave(e) {
    e.preventDefault();

    if (!form.day || !form.title) {
      alert("Day and Title are required 🙂");
      return;
    }

    try {
      setError("");
      setUploading(true);

      // 👇 mediaUrl-um include pannuren
      const payload = {
        day: form.day,
        title: form.title,
        message: form.message,
        mediaUrl: form.mediaUrl || "",
      };

      // Editing & no new file -> existing media preserve
      if (editingId && !mediaFile) {
        const existing = items.find((x) => x.id === editingId);
        if (existing) {
          // user form.mediaUrl la change pannirundha adhuthaan use aagum
          if (!payload.mediaUrl) payload.mediaUrl = existing.mediaUrl || "";
          payload.mediaType = existing.mediaType || "";
        }
      }

      // New file upload pannirundhaa → Storage la upload panni override pannalaam
      if (mediaFile) {
        const { url, type } = await uploadMediaFile(mediaFile);
        payload.mediaUrl = url;      // 👈 file URL override
        payload.mediaType = type;
      }

      if (editingId) {
        await updateAnnouncement(editingId, payload);
      } else {
        await addAnnouncement(payload);
      }

      resetForm();
      await loadAnnouncements();
    } catch (err) {
      console.error("Error saving announcement:", err);
      setError("Failed to save announcement.");
    } finally {
      setUploading(false);
    }
  }

  // ---------- ROW ACTIONS ----------
  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      day: item.day?.toString() || "",
      title: item.title || "",
      message: item.message || item.body || "",
      mediaUrl: item.mediaUrl || "",   // 👈 existing mediaUrl load pannuren
    });
    setMediaFile(null); // media existing-a irukkum, change panna new file choose pannalam
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this announcement?")) return;

    try {
      setError("");
      await deleteAnnouncement(id);
      await loadAnnouncements();
    } catch (err) {
      console.error("Error deleting announcement:", err);
      setError("Failed to delete announcement.");
    }
  }

  // ---------- UI ----------
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem" }}>
      <h2
        style={{
          fontSize: "2rem",
          fontWeight: "bold",
          marginBottom: "1.5rem",
        }}
      >
        21 Days Announcements
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

      {/* ===== FORM ===== */}
      <div
        style={{
          marginBottom: "2rem",
          padding: "1.5rem",
          borderRadius: "12px",
          background: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h3 style={{ marginBottom: "1rem", fontSize: "1.2rem" }}>
          {editingId ? "Update Announcement" : "Create Announcement"}
        </h3>

        <form
          onSubmit={handleSave}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "0.75rem",
          }}
        >
          {/* Day */}
          <div>
            <label style={{ fontSize: "0.85rem" }}>Day (1 - 21)</label>
            <input
              type="number"
              name="day"
              min="1"
              max="21"
              value={form.day}
              onChange={handleChange}
              placeholder="1"
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                border: "1px solid #444",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
              }}
            />
          </div>

          {/* Title */}
          <div style={{ gridColumn: "span 3 / span 3" }}>
            <label style={{ fontSize: "0.85rem" }}>Title</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Day 1 Start"
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                border: "1px solid #444",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
              }}
            />
          </div>

          {/* Message */}
          <div style={{ gridColumn: "span 4 / span 4" }}>
            <label style={{ fontSize: "0.85rem" }}>Message</label>
            <textarea
              name="message"
              rows={3}
              value={form.message}
              onChange={handleChange}
              placeholder="Fit21 starts at 6.30 PM today."
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                border: "1px solid #444",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                resize: "vertical",
              }}
            />
          </div>

          {/* Media URL input */}
          <div style={{ gridColumn: "span 4 / span 4" }}>
            <label style={{ fontSize: "0.85rem" }}>
              Media URL (optional – any link: image, pdf, folder...)
            </label>
            <input
              type="text"
              name="mediaUrl"
              value={form.mediaUrl}
              onChange={handleChange}
              placeholder="Paste media link here"
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "6px",
                border: "1px solid #444",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
              }}
            />
          </div>

          {/* Media (file upload only) */}
          <div style={{ gridColumn: "span 4 / span 4" }}>
            <label style={{ fontSize: "0.85rem" }}>
              Upload Media (image / video / PDF / document) – optional
            </label>
            <input
              type="file"
              accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setMediaFile(file || null);
              }}
              style={{
                width: "100%",
                marginTop: "0.25rem",
                padding: "0.3rem 0.4rem",
                borderRadius: "6px",
                border: "1px solid #444",
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
              }}
            />
            {mediaFile && (
              <div
                style={{
                  marginTop: "0.25rem",
                  fontSize: "0.8rem",
                  color: "#ccc",
                }}
              >
                Selected: {mediaFile.name}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div
            style={{
              gridColumn: "span 4 / span 4",
              marginTop: "0.75rem",
              display: "flex",
              gap: "0.75rem",
            }}
          >
            <button
              type="submit"
              disabled={uploading}
              style={{
                padding: "0.45rem 1.2rem",
                borderRadius: "999px",
                border: "none",
                background: "linear-gradient(135deg,#f97316,#fb923c)",
                color: "#fff",
                cursor: uploading ? "not-allowed" : "pointer",
                fontWeight: 600,
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading
                ? "Uploading..."
                : editingId
                ? "Update Announcement"
                : "Save Announcement"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: "0.45rem 1.2rem",
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

      {/* ===== LIST ===== */}
      <div
        style={{
          padding: "1.5rem",
          borderRadius: "12px",
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h3 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>
          Announcements List
        </h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
              <th style={{ padding: "0.5rem" }}>Day</th>
              <th style={{ padding: "0.5rem" }}>Title</th>
              <th style={{ padding: "0.5rem" }}>Message</th>
              <th style={{ padding: "0.5rem" }}>Media</th>
              <th style={{ padding: "0.5rem" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: "0.75rem", color: "#ccc" }}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "0.75rem", color: "#ccc" }}>
                  No announcements yet. Add one above 👆
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <td style={{ padding: "0.5rem" }}>{item.day}</td>
                  <td style={{ padding: "0.5rem" }}>{item.title}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {item.message || item.body}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {item.mediaUrl ? (
                      <a
                        href={item.mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#38bdf8", fontSize: "0.85rem" }}
                      >
                        Open media
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.4rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        onClick={() => handleEdit(item)}
                        style={{
                          padding: "0.25rem 0.7rem",
                          borderRadius: "999px",
                          border: "1px solid #60a5fa",
                          background: "transparent",
                          color: "#bfdbfe",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        style={{
                          padding: "0.25rem 0.7rem",
                          borderRadius: "999px",
                          border: "1px solid #f97373",
                          background: "transparent",
                          color: "#fecaca",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
