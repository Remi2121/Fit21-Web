/* eslint-disable react-hooks/exhaustive-deps */
// src/components/LeaderBoard.jsx
import React, { useState, useEffect } from "react";
import Headers from "../components/header/header.jsx";
import "./Leaderboard.css";

import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

export default function LeaderBoard() {
  const [activeTab, setActiveTab] = useState("user"); // "user" | "team"
  const [userRank, setUserRank] = useState([]);       // [{id, name, email, points}]
  const [teamFinal, setTeamFinal] = useState([]);     // [{id, name, description, finalScore, hasTeamPhysical}]
  const [individualCombined, setIndividualCombined] = useState([]); // [{id,name,email,online,physical,combined,hasPhysical}]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // ---- Load USERS (online + physical flags) ----
      const usersSnap = await getDocs(collection(db, "users"));
      const users = usersSnap.docs.map((d) => {
        const raw = d.data() || {};
        const online = Number(raw.finalScore) || 0;
        // detect if field exists (not just 0)
        const hasPhysical = Object.prototype.hasOwnProperty.call(raw, "finalScore_admin");
        const physical = Number(raw.finalScore_admin) || 0;

        return {
          id: d.id,
          name: raw.username || raw.name || "(No name)",
          email: raw.email || "",
          online,
          physical,
          combined: online + physical,
          hasPhysical, // true if field present
        };
      });

      // USER RANK (ONLINE ONLY)
      const userRankSorted = [...users]
        .sort((a, b) => b.online - a.online)
        .map((u) => ({ id: u.id, name: u.name, email: u.email, points: u.online }));
      setUserRank(userRankSorted);

      // INDIVIDUAL (COMBINED)
      const indivSorted = [...users]
        .sort((a, b) => b.combined - a.combined)
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          online: u.online,
          physical: u.physical,
          combined: u.combined,
          hasPhysical: u.hasPhysical,
        }));
      setIndividualCombined(indivSorted);

      // ---- Load TEAMS (final only + flag) ----
      const teamsSnap = await getDocs(collection(db, "teams"));
      const teams = teamsSnap.docs.map((t) => {
        const td = t.data() || {};
        // detect existence of finalScore field
        const hasTeamPhysical = Object.prototype.hasOwnProperty.call(td, "finalScore");
        return {
          id: t.id,
          name: td.teamName || td.name || t.id,
          description: td.description || "",
          finalScore: Number(td.finalScore) || 0, // ADMIN SET
          hasTeamPhysical,
        };
      });
      const teamsSorted = teams.sort((a, b) => b.finalScore - a.finalScore);
      setTeamFinal(teamsSorted);

      setLoading(false);
    })();
  }, []);

  // Small helper to render a status chip
  const StatusChip = ({ ok, textIfOk, pendingText = "Waiting (admin will add)" }) => {
    const base = {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      whiteSpace: "nowrap",
    };
    const styleOk = { ...base, background: "rgba(0,255,0,0.12)" };
    const stylePend = { ...base, background: "rgba(255,165,0,0.16)" };
    return <span style={ok ? styleOk : stylePend}>{ok ? textIfOk : pendingText}</span>;
  };

  return (
    <>
      <Headers />

      <main className="leaderboard-screen">
        <div className="leaderboard-panel">
          <header className="panel-title">
            <h1>🏆 Fit21 Leader Board</h1>
            <p>Track the top performers!</p>
          </header>

          <div className="lb-tabs">
            <div
              className={`tab ${activeTab === "user" ? "active" : ""}`}
              onClick={() => setActiveTab("user")}
            >
              👤 User Rank
            </div>
            <div
              className={`tab ${activeTab === "team" ? "active" : ""}`}
              onClick={() => setActiveTab("team")}
            >
              🧑‍🤝‍🧑 Team Rank
            </div>
          </div>

          <div className="table-scroll">
            {loading && <div style={{ color: "#ddd", padding: 12 }}>Loading...</div>}

            {/* ================= USER RANK (ONLINE ONLY) ================= */}
            {activeTab === "user" && !loading && (
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {userRank.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email || "-"}</td>
                      <td>{u.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* ================= TEAM RANK (FINAL) + INDIVIDUAL (COMBINED) ================= */}
            {activeTab === "team" && !loading && (
              <>
                {/* Teams — Final (admin set) */}
                <h3 style={{ margin: "8px 0 10px" }}>Teams — Final (Admin set)</h3>
                <table className="leaderboard-table" style={{ marginBottom: 22 }}>
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Final Score</th>
                      <th>Physical Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamFinal.map((t) => (
                      <tr key={t.id}>
                        <td style={{ verticalAlign: "top", fontWeight: 800 }}>
                          {t.name}
                          {t.description && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "#d0d0d0",
                                fontWeight: 500,
                              }}
                            >
                              {t.description}
                            </div>
                          )}
                        </td>
                        <td style={{ verticalAlign: "top" }}>{t.finalScore}</td>
                        <td style={{ verticalAlign: "top" }}>
                          <StatusChip
                            ok={t.hasTeamPhysical && t.finalScore > 0}
                            textIfOk="Set"
                            pendingText="Waiting (admin will add)"
                          />
                        </td>
                      </tr>
                    ))}
                    {teamFinal.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ color: "#ddd", padding: 12 }}>
                          No teams found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Individuals — Combined (online + physical) */}
                <h3 style={{ margin: "8px 0 10px" }}>
                  Individual (Combined): finalScore + finalScore_admin
                </h3>
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Online</th>
                      <th>Physical (admin)</th>
                      <th>Final Score</th>
                      <th>Physical Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {individualCombined.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.email || "-"}</td>
                        <td>{u.online}</td>
                        <td>{u.physical}</td>
                        <td>{u.combined}</td>
                        <td>
                          <StatusChip
                            ok={u.hasPhysical && u.physical > 0}
                            textIfOk="Set"
                            pendingText="Waiting (admin will add)"
                          />
                        </td>
                      </tr>
                    ))}
                    {individualCombined.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ color: "#ddd", padding: 12 }}>
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>

          <div className="panel-actions">
            <button
              className="back-btn"
              onClick={() => (window.location.href = "/")}
            >
              Back to Home
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
