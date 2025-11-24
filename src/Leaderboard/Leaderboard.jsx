/* eslint-disable react-hooks/exhaustive-deps */
// src/components/LeaderBoard.jsx
import React, { useState, useEffect } from "react";
import Headers from "../components/header/header.jsx";
import "./Leaderboard.css";

import { db } from "../firebase";
import {
  collection,
  collectionGroup,
  getDocs,
} from "firebase/firestore";

export default function LeaderBoard() {
  const [activeTab, setActiveTab] = useState("user"); // "user" | "team"
  const [userRank, setUserRank] = useState([]);       // [{id, name, email, points}]
  const [teamFinal, setTeamFinal] = useState([]);     // [{id, name, description, finalScore, hasTeamPhysical}]
  const [individualCombined, setIndividualCombined] = useState([]); // users NOT in any team
  const [loading, setLoading] = useState(true);

  // team details (expand on click)
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [teamMembers, setTeamMembers] = useState({}); // { [teamId]: { loading: bool, items: [{username,email}] } }

  // ---- helpers ----
  const normalizeEmail = (s = "") => (s || "").trim().toLowerCase();
  // "remi@gmail.com" -> "remi_gmail_com"
  const emailToSlug = (s = "") =>
    normalizeEmail(s).replace(/@/g, "_").replace(/\./g, "_");

  useEffect(() => {
    (async () => {
      setLoading(true);

      // ---- Load USERS (online + physical flags) ----
      const usersSnap = await getDocs(collection(db, "users"));
      const users = usersSnap.docs.map((d) => {
        const raw = (d.data && d.data()) || {};
        const online = Number(raw.finalScore) || 0;
        const hasPhysical = Object.prototype.hasOwnProperty.call(
          raw,
          "finalScore_admin"
        );
        const physical = Number(raw.finalScore_admin) || 0;

        return {
          id: d.id,
          name: raw.username || raw.name || "(No name)",
          email: raw.email || "",
          emailKey: normalizeEmail(raw.email || ""),
          online,
          physical,
          combined: online + physical,
          hasPhysical,
        };
      });

      // USER RANK (ONLINE ONLY)
      const userRankSorted = [...users]
        .sort((a, b) => b.online - a.online)
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          points: u.online,
        }));
      setUserRank(userRankSorted);

      // ---- Load TEAMS (final only + flag) ----
      const teamsSnap = await getDocs(collection(db, "teams"));
      const teams = teamsSnap.docs.map((t) => {
        const td = (t.data && t.data()) || {};
        const hasTeamPhysical = Object.prototype.hasOwnProperty.call(
          td,
          "finalScore"
        );
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

      // ---- Get ALL team members (collectionGroup on 'members') ----
      const membersSnap = await getDocs(collectionGroup(db, "members"));

      const memberEmailSet = new Set();
      const memberUidSet = new Set();
      const memberSlugIdSet = new Set();

      membersSnap.docs.forEach((m) => {
        const md = (m.data && m.data()) || {};
        const byEmail = md.email || md.userEmail || md.memberEmail || null;
        const byUid = md.uid || md.userId || md.userUID || null;

        if (byEmail) memberEmailSet.add(normalizeEmail(byEmail));
        if (byUid) memberUidSet.add(String(byUid));
        if (m.id) memberSlugIdSet.add(String(m.id).toLowerCase());
      });

      // ---- INDIVIDUAL (COMBINED) — ONLY users NOT in any team ----
      const indivSorted = users
        .filter((u) => {
          const emailKey = normalizeEmail(u.email);
          const slugKey = emailToSlug(u.email);
          const inTeamByEmail = memberEmailSet.has(emailKey);
          const inTeamBySlug = memberSlugIdSet.has(slugKey);
          const inTeamByUid = u.id && memberUidSet.has(String(u.id));
          return !(inTeamByEmail || inTeamBySlug || inTeamByUid);
        })
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

      setLoading(false);
    })();
  }, []);

  // Load members for a given team (only once)
  const toggleTeam = async (teamId) => {
    if (expandedTeamId === teamId) {
      setExpandedTeamId(null);
      return;
    }
    setExpandedTeamId(teamId);

    // if already loaded, don't fetch again
    if (teamMembers[teamId]?.items) return;

    setTeamMembers((prev) => ({
      ...prev,
      [teamId]: { loading: true, items: [] },
    }));

    try {
      const memSnap = await getDocs(collection(db, "teams", teamId, "members"));
      const rows = memSnap.docs.map((d) => {
        const md = (d.data && d.data()) || {};
        return {
          id: d.id,
          username: md.username || md.name || "(No name)",
          email: md.email || md.userEmail || "",
        };
      });

      setTeamMembers((prev) => ({
        ...prev,
        [teamId]: { loading: false, items: rows },
      }));
    } catch (e) {
      setTeamMembers((prev) => ({
        ...prev,
        [teamId]: { loading: false, items: [], error: String(e?.message || e) },
      }));
    }
  };

  // Small helper to render a status chip
  const StatusChip = ({
    ok,
    textIfOk,
    pendingText = "Waiting (admin will add)",
  }) => {
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
    return (
      <span style={ok ? styleOk : stylePend}>
        {ok ? textIfOk : pendingText}
      </span>
    );
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
            {loading && (
              <div style={{ color: "#ddd", padding: 12 }}>Loading...</div>
            )}

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

            {/* ================= TEAM RANK (FINAL) + EXPANDABLE DETAILS ================= */}
            {activeTab === "team" && !loading && (
              <>
                <h3 style={{ margin: "8px 0 10px" }}>Teams — Final (Admin set)</h3>
                <table className="leaderboard-table" style={{ marginBottom: 22 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 360 }}>Team</th>
                      <th>Final Score</th>
                      <th>Physical Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamFinal.map((t) => {
                      const isOpen = expandedTeamId === t.id;
                      const tm = teamMembers[t.id];
                      return (
                        <React.Fragment key={t.id}>
                          <tr
                            onClick={() => toggleTeam(t.id)}
                            style={{ cursor: "pointer" }}
                            title="Click to view team members"
                          >
                            <td style={{ verticalAlign: "top", fontWeight: 800 }}>
                              {t.name} {isOpen ? "▾" : "▸"}
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

                          {/* Expandable details row */}
                          {isOpen && (
                            <tr>
                              <td colSpan={3} style={{ background: "rgba(255,255,255,0.03)" }}>
                                <div style={{ padding: "10px 6px 6px" }}>
                                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                                    Team Members
                                  </div>
                                  {tm?.loading && (
                                    <div style={{ color: "#bbb" }}>Loading members…</div>
                                  )}
                                  {tm?.error && (
                                    <div style={{ color: "#ffb3b3" }}>
                                      Failed to load members: {tm.error}
                                    </div>
                                  )}
                                  {tm && !tm.loading && tm.items?.length === 0 && (
                                    <div style={{ color: "#bbb" }}>No members.</div>
                                  )}
                                  {tm && !tm.loading && tm.items?.length > 0 && (
                                    <table
                                      className="leaderboard-table"
                                      style={{ margin: 0 }}
                                    >
                                      <thead>
                                        <tr>
                                          <th style={{ width: 220 }}>Member</th>
                                          <th>Email</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {tm.items.map((m) => (
                                          <tr key={m.id}>
                                            <td>{m.username}</td>
                                            <td>{m.email || "-"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {teamFinal.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ color: "#ddd", padding: 12 }}>
                          No teams found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Individuals — NOT in any team */}
                <h3 style={{ margin: "8px 0 10px" }}>
                  Individual (Not in any team): finalScore + finalScore_admin
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
                          No users found (all users are in teams)
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
