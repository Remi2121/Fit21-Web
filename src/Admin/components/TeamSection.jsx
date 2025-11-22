// src/Admin/components/TeamSection.jsx
import React, { useEffect, useState } from "react";
import {
  createTeam,
  listTeams,
  listMembers,
  addMemberToTeam,
  removeMemberFromTeam,
} from "../services/teamService";
import TeamMember from "./TeamMember";

export default function TeamSection() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [members, setMembers] = useState([]);

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");

  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTeams() {
    try {
      const t = await listTeams();
      setTeams(t);
      if (t.length && !selectedTeam) {
        setSelectedTeam(t[0].id);
        await loadMembers(t[0].id);
      }
    } catch (e) {
      console.error("loadTeams failed:", e);
    }
  }

  async function loadMembers(teamId) {
    try {
      if (!teamId) {
        setMembers([]);
        return;
      }
      const m = await listMembers(teamId);
      setMembers(m);
    } catch (e) {
      console.error("loadMembers failed:", e);
    }
  }

  async function handleCreateTeam(e) {
    e.preventDefault();
    if (!newTeamName) return;
    try {
      const res = await createTeam({ teamName: newTeamName, description: newTeamDesc });
      setNewTeamName("");
      setNewTeamDesc("");
      await loadTeams();
      setSelectedTeam(res.id);
      await loadMembers(res.id);
    } catch (e) {
      console.error("createTeam failed:", e);
      alert("Failed to create team");
    }
  }

  function makeMemberIdFromEmail(email) {
    if (!email) return `m_${Date.now()}`;
    return email.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!selectedTeam) {
      alert("Select a team first");
      return;
    }
    if (!memberName || !memberEmail) {
      alert("Enter member name and email");
      return;
    }
    setAdding(true);
    try {
      const memberId = makeMemberIdFromEmail(memberEmail);
      await addMemberToTeam(selectedTeam, {
        userId: memberId,
        username: memberName,
        email: memberEmail,
      });
      setMemberName("");
      setMemberEmail("");
      await loadMembers(selectedTeam);
    } catch (err) {
      console.error("addMember failed:", err);
      alert("Failed to add member: " + (err.message || err));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMember(userId) {
    if (!selectedTeam || !userId) return;
    if (!window.confirm("Remove member from team?")) return;
    try {
      await removeMemberFromTeam(selectedTeam, userId);
      await loadMembers(selectedTeam);
    } catch (e) {
      console.error("removeMember failed:", e);
      alert("Failed to remove member");
    }
  }

  return (
    <div>
      <h1 className="page-title">Team Management</h1>

      <section className="card" style={{ padding: 16, marginBottom: 12 }}>
        <h3>Create a new team</h3>
        <form
          onSubmit={handleCreateTeam}
          style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}
        >
          <input
            className="admin-input"
            placeholder="Team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            required
            style={{ width: 220 }}
          />
          <input
            className="admin-input"
            placeholder="Description (optional)"
            value={newTeamDesc}
            onChange={(e) => setNewTeamDesc(e.target.value)}
            style={{ width: 320 }}
          />
          <button className="admin-btn" type="submit">Create Team</button>
        </form>
      </section>

      <section className="card" style={{ display: "flex", gap: 12 }}>
        <aside style={{ width: 260 }}>
          <h4>Teams</h4>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {teams.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => {
                    setSelectedTeam(t.id);
                    loadMembers(t.id);
                  }}
                  className={`team-select-btn ${selectedTeam === t.id ? "selected" : ""}`}
                  style={{
                    width: "100%",
                    padding: 12,
                    textAlign: "left",
                    marginBottom: 8,
                    borderRadius: 8,
                    cursor: "pointer",
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.03)"
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{t.teamName || t.teamName || t.id}</div>
                  <div style={{ fontSize: 12, color: "#9aa" }}>{t.description}</div>
                </button>
              </li>
            ))}
            {teams.length === 0 && <li>No teams yet</li>}
          </ul>
        </aside>

        <div style={{ flex: 1 }}>
          <h4>Team members</h4>
          {!selectedTeam && <div>Select a team to view members</div>}
          {selectedTeam && (
            <>
              <form onSubmit={handleAddMember} style={{ marginBottom: 12, display: "flex", gap: 10 }}>
                <input
                  className="admin-input"
                  placeholder="Member name"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  style={{ width: 220 }}
                />
                <input
                  className="admin-input"
                  placeholder="Member email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  style={{ width: 260 }}
                />
                <button className="admin-btn" disabled={adding} type="submit">
                  {adding ? "Adding..." : "Add member"}
                </button>
              </form>

              <div>
                {members.length === 0 && <div>No members</div>}
                {members.map((m) => (
                  <TeamMember key={m.id} member={m} onRemove={() => handleRemoveMember(m.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
