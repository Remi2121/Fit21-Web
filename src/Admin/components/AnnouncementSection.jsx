// src/Admin/components/AnnouncementSection.jsx
import React from "react";
import Card from "./Card.jsx";
import Input from "./Input.jsx";
import "../AdminDashboard.css";

export default function AnnouncementSection({
  announcements,
  newAnnouncement,
  setNewAnnouncement,
  onSubmit,
  onEdit,
  onDelete,
  isEditing,
}) {
  return (
    <div>
      <h1 className="page-title">21 Days Announcements</h1>

      <Card title={isEditing ? "Edit Announcement" : "Create Announcement"}>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <Input
              label="Day (1 - 21)"
              type="number"
              value={newAnnouncement.day}
              onChange={(e) =>
                setNewAnnouncement({
                  ...newAnnouncement,
                  day: e.target.value,
                })
              }
            />
            <Input
              label="Title"
              value={newAnnouncement.title}
              onChange={(e) =>
                setNewAnnouncement({
                  ...newAnnouncement,
                  title: e.target.value,
                })
              }
            />
          </div>
          <div className="input-wrapper mt-10">
            <label className="input-label">Message</label>
            <textarea
              value={newAnnouncement.message}
              onChange={(e) =>
                setNewAnnouncement({
                  ...newAnnouncement,
                  message: e.target.value,
                })
              }
              rows={3}
              className="input-control textarea"
            />
          </div>
          <button type="submit" className="btn btn-primary mt-10">
            {isEditing ? "Update Announcement" : "Save Announcement"}
          </button>
        </form>
      </Card>

      <Card title="Announcements List">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Title</th>
              <th>Message</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {announcements.map((a) => (
              <tr key={a.id}>
                <td>{a.day}</td>
                <td>{a.title}</td>
                <td>{a.message}</td>
                <td>
                  <button
                    onClick={() => onEdit(a)}
                    className="btn btn-small btn-outline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(a.id)}
                    className="btn btn-small btn-danger"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
