import React, { useEffect, useState } from "react";
import Headers from "../components/header/header.jsx";   // keep your fixed site header
import "./Leaderboard.css";

export default function LeaderBoard() {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const sample = [
      { id: 1, name: "Remi", points: 320},
      { id: 2, name: "Sanu", points: 270 },
      { id: 3, name: "Kavi", points: 250 },
      { id: 4, name: "Renu", points: 220  },
      { id: 5, name: "Renu", points: 220  },
      { id: 6, name: "Renu", points: 220 },
      { id: 7, name: "Renu", points: 220 },
      { id: 8, name: "Renu", points: 220 },
      { id: 9, name: "Renu", points: 220 },
      { id: 10, name: "Renu", points: 220 },
      { id: 11, name: "Renu", points: 220 },
    ];
    setPlayers(sample.sort((a, b) => b.points - a.points));
  }, []);

  return (
    <>
      <Headers />
      {/* Full-screen panel fixed under the site header */}
      <main className="leaderboard-screen">
        <div className="leaderboard-panel">
          <header className="panel-title">
            <h1>🏆 Fit21 Leader Board</h1>
            <p>Track the top fitness performers and their achievements!</p>
          </header>

          {/* Only this area scrolls */}
          <div className="table-scroll">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Points</th>
                  
                </tr>
              </thead>
              <tbody>
                {players.map((p, index) => (
                  <tr
                    key={p.id}
                    className={
                      index === 0 ? "gold" : index === 1 ? "silver" : index === 2 ? "bronze" : ""
                    }
                  >
                    <td>{index + 1}</td>
                    <td>{p.name}</td>
                    <td>{p.points}</td>
                    
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
