/* eslint-disable react-hooks/exhaustive-deps */
// src/components/LeaderBoard.jsx
import React, { useState, useEffect } from "react";
import Headers from "../components/header/header.jsx";
import "./Leaderboard.css";

import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";

export default function LeaderBoard() {
  const [activeTab, setActiveTab] = useState("user"); // "user" or "team"
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load both users leaderboard and teams (so switching tabs is instant)
    async function loadAll() {
      setLoading(true);
      await Promise.all([loadUserLeaderboard(), loadTeamLeaderboard()]);
      setLoading(false);
    }
    loadAll();
  }, []);

  // ---------- USERS ----------
  async function loadUserLeaderboard() {
    try {
      const usersRef = collection(db, "users");
      const userSnaps = await getDocs(usersRef);

      const leaderboardArray = [];

      // iterate over users
      for (const u of userSnaps.docs) {
        const userId = u.id;
        const userData = u.data();

        const exercisesRef = collection(db, "users", userId, "exercises");
        const exSnap = await getDocs(exercisesRef);

        let totalPoints = 0;
        exSnap.forEach((docItem) => {
          const data = docItem.data();
          totalPoints += data.points || 0;
        });

        // Save final score in user's document (optional)
        // Note: you may want to guard this to avoid too many writes; kept as in original
        try {
          await updateDoc(doc(db, "users", userId), { finalScore: totalPoints });
        } catch (e) {
          // ignore update errors (e.g. permissions) so UI still works
          console.warn("Could not update finalScore for user:", userId, e);
        }

        leaderboardArray.push({
          id: userId,
          name: userData.username || "Unknown",
          email: userData.email || null,
          points: totalPoints,
        });
      }

      leaderboardArray.sort((a, b) => b.points - a.points);
      setUsers(leaderboardArray);
    } catch (err) {
      console.error("Failed to load user leaderboard:", err);
    }
  }

  // ---------- TEAMS ----------
  // Helper: find a user doc by username OR email
  async function findUserDocByNameOrEmail(name, email) {
    // try username first
    if (name) {
      try {
        const q = query(collection(db, "users"), where("username", "==", name));
        const snap = await getDocs(q);
        if (!snap.empty) return snap.docs[0]; // return first match
      } catch (e) {
        console.warn("username query failed", e);
      }
    }
    // fallback to email
    if (email) {
      try {
        const q2 = query(collection(db, "users"), where("email", "==", email));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) return snap2.docs[0];
      } catch (e) {
        console.warn("email query failed", e);
      }
    }
    return null;
  }

  // Helper: compute points for a user doc (use finalScore if present, otherwise sum exercises)
  async function computePointsForUserDoc(userDoc) {
    if (!userDoc) return 0;
    const ud = userDoc.data();
    if (typeof ud.finalScore === "number") return ud.finalScore;

    // otherwise sum exercises
    try {
      const userId = userDoc.id;
      const exercisesRef = collection(db, "users", userId, "exercises");
      const exSnap = await getDocs(exercisesRef);
      let total = 0;
      exSnap.forEach((d) => {
        const dd = d.data();
        total += dd.points || 0;
      });
      // optionally update user's finalScore to cache
      try {
        await updateDoc(doc(db, "users", userId), { finalScore: total });
      } catch (e) {
        // ignore
      }
      return total;
    } catch (e) {
      console.warn("Failed to sum exercises for user", e);
      return 0;
    }
  }

  async function loadTeamLeaderboard() {
    try {
      const teamsRef = collection(db, "teams");
      const teamSnaps = await getDocs(teamsRef);

      const teamResults = [];

      for (const teamDoc of teamSnaps.docs) {
        const teamId = teamDoc.id;
        const teamData = teamDoc.data();

        // We'll try to detect members in different possible structures:
        // 1) team document has a field `members` as an array of { name, email } or strings
        // 2) team has a subcollection "members" where each doc is a member doc with name/email
        // 3) team doc contains fields like remi: "remi@gmail.com" (less likely)
        let membersList = [];

        // case 1: array field
        if (Array.isArray(teamData.members) && teamData.members.length > 0) {
          // normalize to objects { name, email }
          membersList = teamData.members.map((m) =>
            typeof m === "string" ? { name: m, email: null } : { name: m.name || m.username || null, email: m.email || null }
          );
        }

        // case 2: check members subcollection if membersList empty
        if (membersList.length === 0) {
          try {
            const membersRef = collection(db, "teams", teamId, "members");
            const membersSnap = await getDocs(membersRef);
            if (!membersSnap.empty) {
              membersList = membersSnap.docs.map((md) => {
                const mdData = md.data();
                return {
                  name: mdData.username || mdData.name || md.id,
                  email: mdData.email || null,
                };
              });
            }
          } catch (e) {
            // ignore
          }
        }

        // case 3: fallback — try to use any primitive keys in teamDoc (not recommended), convert to members
        if (membersList.length === 0) {
          // try to detect keys which look like member entries
          const candidateMembers = [];
          for (const [k, v] of Object.entries(teamData)) {
            // skip metadata fields like description or teamName
            if (k === "teamName" || k === "name" || k === "description" || k === "members") continue;
            if (typeof v === "string" && v.includes("@")) {
              candidateMembers.push({ name: k, email: v });
            } else if (typeof v === "string") {
              candidateMembers.push({ name: v, email: null });
            }
          }
          membersList = candidateMembers;
        }

        // Now compute points for each member
        const memberPointsPromises = membersList.map(async (m) => {
          // find the user's document in users collection by username or email
          const possibleName = m.name || null;
          const possibleEmail = m.email || null;

          const userDoc = await findUserDocByNameOrEmail(possibleName, possibleEmail);
          const points = await computePointsForUserDoc(userDoc);
          // if we didn't find via queries, also try matching by doc id (maybe team stores userId)
          if (!userDoc && possibleName) {
            try {
              const maybeDoc = await getDocs(query(collection(db, "users"), where("__name__", "==", possibleName)));
              if (!maybeDoc.empty) {
                const ud2 = maybeDoc.docs[0];
                const pts2 = await computePointsForUserDoc(ud2);
                return { name: possibleName, email: possibleEmail, points: pts2 };
              }
            } catch (e) {
              // ignore
            }
          }

          return { name: possibleName || "(unknown)", email: possibleEmail || null, points };
        });

        const resolvedMembers = await Promise.all(memberPointsPromises);

        const totalPoints = resolvedMembers.reduce((s, r) => s + (r.points || 0), 0);
        const memberCount = resolvedMembers.length || 1; // avoid divide by zero
        const avgPoints = Math.round((totalPoints / memberCount) * 100) / 100; // two decimals

        // <-- FIX: prefer teamData.teamName (your Firestore field), then fallback to teamData.name, then doc id
        teamResults.push({
          id: teamId,
          name: teamData.teamName || teamData.name || teamId,
          description: teamData.description || "",
          members: resolvedMembers,
          avgPoints,
          totalPoints,
        });
      }

      // sort teams by avgPoints desc
      teamResults.sort((a, b) => b.avgPoints - a.avgPoints);
      setTeams(teamResults);
    } catch (err) {
      console.error("Failed to load teams leaderboard:", err);
    }
  }

  // ----------------- render -----------------
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

            {activeTab === "user" && !loading && (
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Points</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id || i}>
                      <td>{u.name}</td>
                      <td>{u.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "team" && !loading && (
              <>
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Avg Points</th>
                      <th>Members</th>
                    </tr>
                  </thead>

                  <tbody>
                    {teams.map((t) => (
                      <tr key={t.id}>
                        <td style={{ verticalAlign: "top", fontWeight: 800 }}>
                          {t.name}
                          {t.description ? (
                            <div style={{ fontSize: 12, color: "#d0d0d0", fontWeight: 500 }}>{t.description}</div>
                          ) : null}
                        </td>
                        <td style={{ verticalAlign: "top" }}>{t.avgPoints}</td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {t.members.length === 0 && <div style={{ color: "#cfcfcf" }}>No members</div>}
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
                                  {m.email ? <div style={{ fontSize: 12, color: "#bdbdbd" }}>{m.email}</div> : null}
                                </div>
                                <div style={{ fontWeight: 800 }}>{m.points}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {teams.length === 0 && <div style={{ color: "#ddd", padding: 12 }}>No teams found</div>}
              </>
            )}
          </div>

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
