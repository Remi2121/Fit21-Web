import React, { useState, useEffect } from "react";
import Headers from "../components/header/header.jsx";
import "./Leaderboard.css";

export default function LeaderBoard() {
  const [activeTab, setActiveTab] = useState("user");
  const [openTeam, setOpenTeam] = useState(null);

  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    // USER SAMPLE DATA
    const userSample = [
      { name: "Remi", points: 320 },
      { name: "Sanu", points: 270 },
      { name: "Kavi", points: 250 },
      { name: "Mani", points: 240 },
      { name: "Renu", points: 220 },
      { name: "Hari", points: 200 },
      { name: "Jaya", points: 180 },
      { name: "Nila", points: 160 },
    ];

    setUsers(userSample);

    // TEAM SAMPLE DATA
    const teamSample = [
      {
        id: 1,
        teamName: "Team A",
        members: [
          { name: "Remi", points: 320 },
          { name: "Sanu", points: 270 },
          { name: "Kavi", points: 250 },
        ],
      },
      {
        id: 2,
        teamName: "Team B",
        members: [
          { name: "Mani", points: 240 },
          { name: "Renu", points: 220 },
          { name: "Hari", points: 200 },
        ],
      },
    ];

    const teamRankData = teamSample.map((t) => {
      const total = t.members.reduce((a, b) => a + b.points, 0);
      return {
        ...t,
        avg: Math.round(total / t.members.length),
      };
    });

    setTeams(teamRankData);
  }, []);

  return (
    <>
      <Headers />

      <main className="leaderboard-screen">
        <div className="leaderboard-panel">

          {/* TITLE */}
          <header className="panel-title">
            <h1>🏆 Fit21 Leader Board</h1>
            <p>Track the top performers in Users and Teams!</p>
          </header>

          {/* TABS */}
          <div className="lb-tabs">
            <div
              className={`tab ${activeTab === "user" ? "active" : ""}`}
              onClick={() => { setActiveTab("user"); setOpenTeam(null); }}
            >
              <span className="tab-emoji">👤</span>User Rank
            </div>

            <div
              className={`tab ${activeTab === "team" ? "active" : ""}`}
              onClick={() => { setActiveTab("team"); setOpenTeam(null); }}
            >
              <span className="tab-emoji">🛡️</span>Team Rank
            </div>
          </div>

          {/* DATA TABLE */}
          <div className="table-scroll">

            {/* USER TABLE */}
            {activeTab === "user" && (
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Points</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((u, i) => (
                    <tr key={i}>
                      <td>{u.name}</td>
                      <td>{u.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* TEAM TABLE */}
            {activeTab === "team" && (
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Avg Points</th>
                  </tr>
                </thead>

                <tbody>
                  {teams.map((t) => (
                    <>
                      <tr
                        key={t.id}
                        className="team-row"
                        onClick={() => setOpenTeam(openTeam === t.id ? null : t.id)}
                      >
                        <td>{t.teamName} ({t.members.length})</td>
                        <td>{t.avg}</td>
                      </tr>

                      {/* EXPANDED MEMBERS */}
                      {openTeam === t.id && (
                        <tr className="team-members-row">
                          <td colSpan={2}>
                            <div className="team-members-inner">
                              <div className="members-container">
                                <ul>
                                  {t.members.map((m) => (
                                    <li>
                                      <span className="member-name">{m.name}</span>
                                      <span className="member-points">{m.points}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}

          </div>

          {/* FOOTER BUTTON */}
          <div className="panel-actions">
            <button className="back-btn" onClick={() => (window.location.href = "/")}>
              Back to Home
            </button>
          </div>

        </div>
      </main>
    </>
  );
}
