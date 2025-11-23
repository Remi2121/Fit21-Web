// src/Admin/components/LeaderboardSection.jsx
import React, { useEffect, useMemo, useState } from "react";
import Card from "./Card.jsx";
import "../AdminDashboard.css";

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../services/firebase.js";

// helpers
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const tidy = (s) => (s || "").trim().toLowerCase();

export default function LeaderboardSection() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("online"); // online | physical

  // firestore data
  const [teams, setTeams] = useState([]); // {id, teamName, description, points, members:[{name,email}]}
  const [users, setUsers] = useState([]); // {id, username, email, finalScore, finalScore_admin, teamId, teamName}

  // edit caches
  const [userOnlineEdits, setUserOnlineEdits] = useState({});
  const [userPhysicalEdits, setUserPhysicalEdits] = useState({});
  const [teamPhysicalEdits, setTeamPhysicalEdits] = useState({});

  // ---- load all ----
  useEffect(() => {
    (async () => {
      setLoading(true);

      // teams
      const tSnap = await getDocs(collection(db, "teams"));
      const teamList = [];
      for (const t of tSnap.docs) {
        const td = t.data() || {};
        // members subcollection
        let members = [];
        try {
          const mSnap = await getDocs(collection(db, "teams", t.id, "members"));
          members = mSnap.docs.map((md) => {
            const m = md.data() || {};
            return {
              name: m.username || m.name || md.id,
              email: m.email || "",
            };
          });
        } catch {}
        teamList.push({
          id: t.id,
          teamName: td.teamName || td.name || t.id,
          description: td.description || "",
          points: num(td.points), // TEAM PHYSICAL
          members,
        });
      }

      // users
      const uSnap = await getDocs(collection(db, "users"));
      const userList = uSnap.docs.map((u) => {
        const d = u.data() || {};
        return {
          id: u.id,
          username: d.username || d.name || "Unknown",
          email: d.email || "",
          finalScore: num(d.finalScore),             // ONLINE
          finalScore_admin: num(d.finalScore_admin), // PHYSICAL (root field)
        };
      });

      // map users to teams by email -> username
      const email2Team = new Map();
      const name2Team = new Map();
      teamList.forEach((t) =>
        t.members.forEach((m) => {
          if (m.email) email2Team.set(tidy(m.email), t);
          if (m.name) name2Team.set(tidy(m.name), t);
        })
      );

      const mappedUsers = userList.map((u) => {
        const t1 = u.email ? email2Team.get(tidy(u.email)) : null;
        const t2 = t1 ? null : name2Team.get(tidy(u.username));
        const team = t1 || t2 || null;
        return {
          ...u,
          teamId: team ? team.id : null,
          teamName: team ? team.teamName : "No team",
        };
      });

      setTeams(teamList);
      setUsers(mappedUsers);

      // init edit caches
      const uOE = {};
      const uPE = {};
      mappedUsers.forEach((u) => {
        uOE[u.id] = u.finalScore;
        uPE[u.id] = u.finalScore_admin;
      });
      const tPE = {};
      teamList.forEach((t) => (tPE[t.id] = t.points));

      setUserOnlineEdits(uOE);
      setUserPhysicalEdits(uPE);
      setTeamPhysicalEdits(tPE);

      setLoading(false);
    })();
  }, []);

  // group users by team name
  const usersByTeam = useMemo(() => {
    const map = new Map();
    for (const u of users) {
      const key = u.teamId ? u.teamName : "No team";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(u);
    }
    // order each group by online points desc
    for (const [, arr] of map) {
      arr.sort(
        (a, b) => num(userOnlineEdits[b.id]) - num(userOnlineEdits[a.id])
      );
    }
    // order groups: all teams in teams list order, then "No team"
    const res = [];
    teams.map((t) => t.teamName).forEach((name) => {
      if (map.has(name)) res.push({ teamName: name, users: map.get(name) });
    });
    if (map.has("No team")) res.push({ teamName: "No team", users: map.get("No team") });
    return res;
  }, [users, teams, userOnlineEdits]);

  // team online total (sum of members' finalScore)
  const teamOnlineTotals = useMemo(() => {
    const totals = new Map();
    teams.forEach((t) => totals.set(t.id, 0));
    users.forEach((u) => {
      if (u.teamId) {
        const cur = totals.get(u.teamId) || 0;
        totals.set(u.teamId, cur + num(userOnlineEdits[u.id]));
      }
    });
    return totals;
  }, [users, teams, userOnlineEdits]);

  const teamsWithCombined = useMemo(() => {
    return teams
      .map((t) => {
        const online = teamOnlineTotals.get(t.id) || 0;
        const physical = num(teamPhysicalEdits[t.id]);
        return {
          ...t,
          online,
          physical,
          combined: online + physical,
        };
      })
      .sort((a, b) => b.combined - a.combined);
  }, [teams, teamOnlineTotals, teamPhysicalEdits]);

  // Only show users with NO TEAM for physical individuals
  const individualsWithCombined = useMemo(() => {
    return users
      .filter((u) => !u.teamId)
      .map((u) => {
        const online = num(userOnlineEdits[u.id]);
        const physical = num(userPhysicalEdits[u.id]); // root field
        return {
          ...u,
          teamName: "No team",
          online,
          physical,
          combined: online + physical,
        };
      })
      .sort((a, b) => b.combined - a.combined);
  }, [users, userOnlineEdits, userPhysicalEdits]);

  // saves
  async function saveUserOnline(uid) {
    const points = num(userOnlineEdits[uid]);
    await updateDoc(doc(db, "users", uid), { finalScore: points });
  }

  async function saveUserPhysical(uid) {
    const points = num(userPhysicalEdits[uid]);
    // store at user ROOT (below finalScore)
    await setDoc(
      doc(db, "users", uid),
      { finalScore_admin: points },
      { merge: true }
    );
  }

  // ✅ Save team physical AND write combined "finalScore" to teams/<id>
  async function saveTeamPhysical(teamId) {
    const physical = num(teamPhysicalEdits[teamId]);
    const online = teamOnlineTotals.get(teamId) || 0; // current online total from members
    const combined = online + physical;

    await setDoc(
      doc(db, "teams", teamId),
      {
        points: physical,      // physical points (admin)
        finalScore: combined,  // combined total (online + physical)
      },
      { merge: true }
    );
  }

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Admin Leaderboard</h1>
        <Card title="Loading data…">
          <div style={{ padding: 12, color: "#ddd" }}>Please wait…</div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Admin Leaderboard</h1>

      <div className="lb-tabs" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div
          className={`tab ${activeTab === "online" ? "active" : ""}`}
          onClick={() => setActiveTab("online")}
        >
          🌐 Online Leaderboard
        </div>
        <div
          className={`tab ${activeTab === "physical" ? "active" : ""}`}
          onClick={() => setActiveTab("physical")}
        >
          🏟️ Physical Leaderboard
        </div>
      </div>

      {/* ONLINE */}
      {activeTab === "online" && (
        <Card title="Online Leaderboard (Users grouped by Team)">
          <p className="muted">
            Only uses <code>users/&lt;uid&gt;.finalScore</code>. “No team” group lists users without a team.
          </p>

          {usersByTeam.map(({ teamName, users: group }) => (
            <div key={teamName} style={{ marginBottom: 22 }}>
              <h3 style={{ margin: "6px 0 10px" }}>{teamName}</h3>
              <div className="table-wrapper">
                <table className="admin-table leaderboard-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Online Points (finalScore)</th>
                      <th>Save</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((u) => (
                      <tr key={u.id}>
                        <td>{u.username}</td>
                        <td>{u.email || "-"}</td>
                        <td style={{ maxWidth: 160 }}>
                          <input
                            type="number"
                            className="input-control"
                            value={userOnlineEdits[u.id] ?? 0}
                            onChange={(e) =>
                              setUserOnlineEdits((m) => ({ ...m, [u.id]: e.target.value }))
                            }
                            style={{ width: 120 }}
                          />
                        </td>
                        <td>
                          <button className="btn btn-primary" onClick={() => saveUserOnline(u.id)}>
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* PHYSICAL */}
      {activeTab === "physical" && (
        <>
          <Card title="Teams — Physical Leaderboard (Online + Physical)">
            <p className="muted">
              Team total = <b>sum of members’ finalScore</b> (online) + <b>teams/&lt;id&gt;.points</b> (physical).<br />
              On save, we also write <code>teams/&lt;id&gt;.finalScore = online + physical</code>.
            </p>
            <div className="table-wrapper">
              <table className="admin-table leaderboard-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Online Total</th>
                    <th>Physical Points</th>
                    <th>Combined</th>
                    <th>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {teamsWithCombined.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{t.teamName}</div>
                        {t.description ? (
                          <div style={{ color: "#bdbdbd", fontSize: 12 }}>{t.description}</div>
                        ) : null}
                      </td>
                      <td>{t.online}</td>
                      <td style={{ maxWidth: 160 }}>
                        <input
                          type="number"
                          className="input-control"
                          value={teamPhysicalEdits[t.id] ?? 0}
                          onChange={(e) =>
                            setTeamPhysicalEdits((m) => ({ ...m, [t.id]: e.target.value }))
                          }
                          style={{ width: 120 }}
                        />
                      </td>
                      <td style={{ fontWeight: 800 }}>{t.combined}</td>
                      <td>
                        <button className="btn btn-primary" onClick={() => saveTeamPhysical(t.id)}>
                          Save
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Individuals — Physical Points (No-team users only)">
            <p className="muted">
              Shows only users without a team. Stores per-user physical points at <code>users/&lt;uid&gt;.finalScore_admin</code>.
              Combined = <b>finalScore + finalScore_admin</b>.
            </p>
            <div className="table-wrapper">
              <table className="admin-table leaderboard-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Online</th>
                    <th>Physical (admin)</th>
                    <th>Combined</th>
                    <th>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {individualsWithCombined.map((u) => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>{u.email || "-"}</td>
                      <td>{u.online}</td>
                      <td style={{ maxWidth: 160 }}>
                        <input
                          type="number"
                          className="input-control"
                          value={userPhysicalEdits[u.id] ?? 0}
                          onChange={(e) =>
                            setUserPhysicalEdits((m) => ({ ...m, [u.id]: e.target.value }))
                          }
                          style={{ width: 120 }}
                        />
                      </td>
                      <td style={{ fontWeight: 800 }}>{u.combined}</td>
                      <td>
                        <button className="btn btn-primary" onClick={() => saveUserPhysical(u.id)}>
                          Save
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
