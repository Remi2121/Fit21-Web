/* eslint-disable react-hooks/exhaustive-deps */
// src/components/LeaderBoard.jsx
import React, { useState, useEffect } from "react";
import Headers from "../components/header/header.jsx";
import "./Leaderboard.css";

import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export default function LeaderBoard() {
  const [activeTab, setActiveTab] = useState("user"); // "user" | "team"
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadUserLeaderboard(), loadTeamLeaderboard()]);
      setLoading(false);
    })();
  }, []);

  // ---------- helpers ----------
  async function sumExercisesIncludingDays(userId) {
    let total = 0;
    try {
      const exRef = collection(db, "users", userId, "exercises");
      const exSnap = await getDocs(exRef);
      for (const exDoc of exSnap.docs) {
        const exData = exDoc.data();
        if (typeof exData.points === "number") total += exData.points;

        // also sum /days subcollection
        try {
          const daysRef = collection(
            db,
            "users",
            userId,
            "exercises",
            exDoc.id,
            "days"
          );
          const daysSnap = await getDocs(daysRef);
          // eslint-disable-next-line no-loop-func
          daysSnap.forEach((d) => (total += Number(d.data()?.points) || 0));
        } catch {}
      }
    } catch {}
    return total;
  }

  async function computePointsForUserDoc(userDoc) {
    if (!userDoc) return 0;
    const ud = userDoc.data();
    if (typeof ud.finalScore === "number") return ud.finalScore;
    return sumExercisesIncludingDays(userDoc.id);
  }

  async function findUserDocByNameOrEmail(username, email) {
    // email first (more unique)
    if (email) {
      const q1 = query(collection(db, "users"), where("email", "==", email));
      const s1 = await getDocs(q1);
      if (!s1.empty) return s1.docs[0];
    }
    if (username) {
      const q2 = query(collection(db, "users"), where("username", "==", username));
      const s2 = await getDocs(q2);
      if (!s2.empty) return s2.docs[0];
    }
    return null;
  }

  // ---------- USERS ----------
  async function loadUserLeaderboard() {
    try {
      const usersRef = collection(db, "users");
      const userSnaps = await getDocs(usersRef);

      const list = [];
      for (const u of userSnaps.docs) {
        const uid = u.id;
        const ud = u.data();
        const points =
          typeof ud.finalScore === "number"
            ? ud.finalScore
            : await sumExercisesIncludingDays(uid);

        list.push({
          id: uid,
          name: ud.username || ud.name || "(No name)",
          email: ud.email || "",
          points,
        });
      }

      list.sort((a, b) => b.points - a.points);
      setUsers(list);
    } catch (err) {
      console.error("Failed to load user leaderboard:", err);
    }
  }

  // ---------- TEAMS ----------
  async function loadTeamLeaderboard() {
    try {
      const teamsRef = collection(db, "teams");
      const teamSnaps = await getDocs(teamsRef);

      const results = [];

      for (const t of teamSnaps.docs) {
        const teamId = t.id;
        const td = t.data();
        const teamName = td.teamName || td.name || teamId;
        const description = td.description || "";

        // get members subcollection
        let members = [];
        try {
          const membersRef = collection(db, "teams", teamId, "members");
          const memSnap = await getDocs(membersRef);
          members = memSnap.docs.map((md) => {
            const d = md.data();
            return {
              username: d.username || d.name || md.id,
              email: d.email || null,
            };
          });
        } catch {}

        const resolved = [];
        for (const m of members) {
          const userDoc = await findUserDocByNameOrEmail(m.username, m.email);
          if (userDoc) {
            const pts = await computePointsForUserDoc(userDoc);
            resolved.push({
              name: userDoc.data().username || userDoc.data().name || m.username || "(unknown)",
              email: userDoc.data().email || m.email || "",
              points: pts,
            });
          } else {
            resolved.push({
              name: m.username || "(unknown)",
              email: m.email || "",
              points: 0,
            });
          }
        }

        // ✅ total + avg (contributors only)
        const totalPoints = resolved.reduce((s, r) => s + (r.points || 0), 0);
        const contributors = resolved.filter((m) => (m.points || 0) > 0).length;
        const denom = contributors > 0 ? contributors : 1;
        const avgPoints = Math.round((totalPoints / denom) * 100) / 100;

        results.push({
          id: teamId,
          name: teamName,
          description,
          members: resolved,
          totalPoints,
          avgPoints,
        });
      }

      // sort by total desc
      results.sort((a, b) => b.totalPoints - a.totalPoints);
      setTeams(results);
    } catch (err) {
      console.error("Failed to load team leaderboard:", err);
    }
  }

  // ---------- UI ----------
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

            {/* USER LEADERBOARD */}
            {activeTab === "user" && !loading && (
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* TEAM LEADERBOARD */}
            {activeTab === "team" && !loading && (
              <>
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Total Points</th>
                      <th>Avg Points (contributors)</th>
                      <th>Members</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((t) => (
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
                        <td style={{ verticalAlign: "top" }}>{t.totalPoints}</td>
                        <td style={{ verticalAlign: "top" }}>{t.avgPoints}</td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            {t.members.length === 0 && (
                              <div style={{ color: "#cfcfcf" }}>No members</div>
                            )}
                            {t.members.map((m, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  padding: "6px 10px",
                                  background: "rgba(255,255,255,0.03)",
                                  borderRadius: 8,
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 700 }}>{m.name}</div>
                                  {m.email && (
                                    <div
                                      style={{
                                        fontSize: 12,
                                        color: "#bdbdbd",
                                      }}
                                    >
                                      {m.email}
                                    </div>
                                  )}
                                </div>
                                <div style={{ fontWeight: 800 }}>
                                  {m.points}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {teams.length === 0 && (
                  <div style={{ color: "#ddd", padding: 12 }}>
                    No teams found
                  </div>
                )}
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
