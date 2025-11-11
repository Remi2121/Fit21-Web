// src/Admin/components/LeaderboardSection.jsx
import React, { useState } from "react";
import Card from "./Card.jsx";
import Input from "./Input.jsx";
import "../AdminDashboard.css";

export default function LeaderboardSection({
  leaderboard,
  setLeaderboard,
  currentDay,
  setCurrentDay,
}) {
  const [editData, setEditData] = useState(null);
  const [newPlayer, setNewPlayer] = useState({
    name: "",
    daysCompleted: "",
    points: "",
  });

  // points-based rank + 17 days rule + only after day 21
  const recomputeRanks = (list, totalDays) => {
    if (totalDays < 21) {
      // challenge innum mudiyala – rank assign pannadhe
      return list.map((u) => ({ ...u, rank: null }));
    }

    const sorted = [...list].sort((a, b) => b.points - a.points);
    let runningRank = 1;

    return sorted.map((user) => {
      if (user.daysCompleted >= 17) {
        const rankedUser = { ...user, rank: runningRank };
        runningRank += 1;
        return rankedUser;
      } else {
        return { ...user, rank: null }; // disqualified – no rank
      }
    });
  };

  const handleCurrentDayChange = (value) => {
    const num = Number(value) || 0;
    const clamped = Math.max(0, Math.min(21, num)); // 0–21
    setCurrentDay(clamped);

    const ranked = recomputeRanks(leaderboard, clamped);
    setLeaderboard(ranked);
  };

  const startEdit = (user) => {
    setEditData({
      id: user.id,
      name: user.name,
      daysCompleted: String(user.daysCompleted),
      points: String(user.points),
    });
  };

  const handleEditChange = (field, value) => {
    setEditData({ ...editData, [field]: value });
  };

  const saveEdit = () => {
    if (!editData) return;

    const updated = leaderboard.map((u) =>
      u.id === editData.id
        ? {
            ...u,
            name: editData.name,
            daysCompleted: Number(editData.daysCompleted),
            points: Number(editData.points),
          }
        : u
    );

    const ranked = recomputeRanks(updated, currentDay);
    setLeaderboard(ranked);
    setEditData(null);
  };

  const handleNewPlayerChange = (field, value) => {
    setNewPlayer({ ...newPlayer, [field]: value });
  };

  const handleAddPlayer = () => {
    if (!newPlayer.name) return;

    const nextId =
      leaderboard.length > 0
        ? Math.max(...leaderboard.map((u) => u.id)) + 1
        : 1;

    const updated = [
      ...leaderboard,
      {
        id: nextId,
        name: newPlayer.name,
        daysCompleted: Number(newPlayer.daysCompleted || 0),
        points: Number(newPlayer.points || 0),
        rank: null,
      },
    ];

    const ranked = recomputeRanks(updated, currentDay);
    setLeaderboard(ranked);
    setNewPlayer({ name: "", daysCompleted: "", points: "" });
  };

  const handleDeletePlayer = (id) => {
    const updated = leaderboard.filter((u) => u.id !== id);
    const ranked = recomputeRanks(updated, currentDay);
    setLeaderboard(ranked);

    if (editData && editData.id === id) {
      setEditData(null);
    }
  };

  return (
    <div>
      <h1 className="page-title">Points &amp; Leaderboard</h1>
      <Card title="Users Progress (21 Days)">
        {/* top info: current challenge day */}
        <div className="leaderboard-top">
          <div className="leaderboard-current">
            Challenge Progress:&nbsp;
            <strong>Day {currentDay} / 21</strong>
          </div>

          <div className="form-inline">
            <label className="input-label">Current Day (0 - 21)</label>
            <input
              type="number"
              min="0"
              max="21"
              value={currentDay}
              onChange={(e) => handleCurrentDayChange(e.target.value)}
              className="input-control"
              style={{ width: "90px" }}
            />
          </div>
        </div>

        {/* Add Player Form */}
        <div className="leaderboard-add">
          <h4 className="leaderboard-edit-title">Add Player</h4>
          <div className="form-grid">
            <Input
              label="User Name"
              value={newPlayer.name}
              onChange={(e) => handleNewPlayerChange("name", e.target.value)}
            />
            <Input
              label="Days Completed"
              type="number"
              value={newPlayer.daysCompleted}
              onChange={(e) =>
                handleNewPlayerChange("daysCompleted", e.target.value)
              }
            />
            <Input
              label="Points"
              type="number"
              value={newPlayer.points}
              onChange={(e) =>
                handleNewPlayerChange("points", e.target.value)
              }
            />
          </div>
          <button onClick={handleAddPlayer} className="btn btn-success mt-10">
            Add Player
          </button>
        </div>

        {/* Table */}
        <table className="admin-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>User</th>
              <th>Days Completed</th>
              <th>Points</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((user) => (
              <tr key={user.id}>
                <td>{user.rank != null ? user.rank : "-"}</td>
                <td>{user.name}</td>
                <td>
                  {user.daysCompleted} / {currentDay}
                </td>
                <td>{user.points}</td>
                <td>
                  <button
                    onClick={() => startEdit(user)}
                    className="btn btn-small btn-outline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeletePlayer(user.id)}
                    className="btn btn-small btn-danger"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Edit form */}
        {editData && (
          <div className="leaderboard-edit">
            <h4 className="leaderboard-edit-title">Edit User Points</h4>
            <div className="form-grid">
              <Input
                label="User Name"
                value={editData.name}
                onChange={(e) => handleEditChange("name", e.target.value)}
              />
              <Input
                label="Days Completed"
                type="number"
                value={editData.daysCompleted}
                onChange={(e) =>
                  handleEditChange("daysCompleted", e.target.value)
                }
              />
              <Input
                label="Points"
                type="number"
                value={editData.points}
                onChange={(e) =>
                  handleEditChange("points", e.target.value)
                }
              />
            </div>
            <button
              onClick={saveEdit}
              className="btn btn-primary mt-10 mr-8"
            >
              Save Changes
            </button>
            <button
              onClick={() => setEditData(null)}
              className="btn btn-outline mt-10"
            >
              Cancel
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
