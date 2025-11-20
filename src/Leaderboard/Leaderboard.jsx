import React, { useState, useEffect } from "react";
import Headers from "../components/header/header.jsx";
import "./Leaderboard.css";

import { db } from "../firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";

export default function LeaderBoard() {
  const [activeTab, setActiveTab] = useState("user");
  const [users, setUsers] = useState([]);

  useEffect(() => {
    async function loadLeaderboard() {
      const usersRef = collection(db, "users");
      const userSnaps = await getDocs(usersRef);

      const leaderboardArray = [];

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

        // Save final score in user's document
        await updateDoc(doc(db, "users", userId), { finalScore: totalPoints });

        leaderboardArray.push({
          name: userData.username || "Unknown",
          points: totalPoints,
        });
      }

      leaderboardArray.sort((a, b) => b.points - a.points);
      setUsers(leaderboardArray);
    }

    loadLeaderboard();
  }, []);

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
          </div>

          <div className="table-scroll">
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
