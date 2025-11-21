// src/Admin/components/Attendance/Attendance.jsx
import React, { useState } from "react";
import { db } from "../../services/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import "./Attendance.css";

export default function Attendance() {
  const [selectedDay, setSelectedDay] = useState(1);
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [message, setMessage] = useState("");

  const dayOptions = Array.from({ length: 21 }, (_, i) => i + 1);

  const handleSearch = async () => {
    setMessage("");
    setResults([]);
    const q = (queryText || "").trim();
    if (!q) {
      setMessage("Enter name or email to search.");
      return;
    }

    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      let snap = null;

      if (q.includes("@")) {
        const qEmail = query(usersRef, where("email", "==", q));
        snap = await getDocs(qEmail);
      } else {
        // basic prefix search on username field
        const qName = query(usersRef, where("username", ">=", q), where("username", "<=", q + "\uf8ff"));
        snap = await getDocs(qName);
      }

      const items = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({
          uid: data.uid ?? d.id,
          docId: d.id,
          name: data.username ?? data.name ?? "No Name",
          email: data.email ?? "",
          present: false,
          existingAttendance: null,
        });
      });

      // Check existing attendance for selected day (fetch user's attendance subcollection)
      const withAttendance = await Promise.all(
        items.map(async (it) => {
          try {
            const attCol = collection(db, "users", it.docId, "attendance");
            const attSnap = await getDocs(attCol);
            let found = null;
            attSnap.forEach((ad) => {
              const adata = ad.data();
              if (adata?.day === Number(selectedDay)) {
                found = { id: ad.id, ...adata };
              }
            });
            return {
              ...it,
              present: found ? !!found.present : false,
              existingAttendance: found || null,
            };
          } catch (err) {
            console.error("attendance read error", err);
            return { ...it, present: false, existingAttendance: null };
          }
        })
      );

      setResults(withAttendance);
      if (withAttendance.length === 0) setMessage("No users found.");
    } catch (err) {
      console.error("search error", err);
      setMessage("Search failed — check console.");
    } finally {
      setLoading(false);
    }
  };

  const togglePresent = (index) => {
    setResults((prev) => {
      const cp = [...prev];
      cp[index] = { ...cp[index], present: !cp[index].present };
      return cp;
    });
  };

  const saveSingle = async (item) => {
    setSaving(true);
    setMessage("");
    try {
      const attCol = collection(db, "users", item.docId, "attendance");
      const payload = {
        day: Number(selectedDay),
        date: new Date(),
        present: !!item.present,
        updatedAt: serverTimestamp(),
      };

      await addDoc(attCol, payload);
      setMessage(`Saved attendance for ${item.name}`);
      setResults((prev) => prev.map((r) => (r.docId === item.docId ? { ...r, existingAttendance: payload } : r)));
    } catch (err) {
      console.error("saveSingle error", err);
      setMessage("Save failed — check console.");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };


  const clearSearch = () => {
    setQueryText("");
    setResults([]);
    setMessage("");
  };

  return (
    <div className="att-wrap">
      <h2>Attendance — mark present (admin)</h2>

      <div className="att-controls">
        <div className="att-day">
          <label>Day</label>
          <select value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))}>
            {dayOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="att-search">
          <label>Search by  email</label>
          <input
            type="text"
            placeholder="Enter email"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
          />
          <div className="att-buttons">
            <button onClick={handleSearch} disabled={loading}>
              {loading ? "Searching…" : "Search"}
            </button>
            <button onClick={clearSearch}>Clear</button>
          </div>
        </div>
      </div>



      <div className="att-results">
        {results.length === 0 ? (
          <div className="att-empty">No search results</div>
        ) : (
          results.map((r, idx) => (
            <div className="att-row" key={r.docId}>
              <div className="att-user">
                <div className="att-name">
                  <strong>{r.name}</strong>
                </div>
                <div className="att-email">{r.email || "—"}</div>
                <div className="att-uid">uid: {r.uid}</div>
              </div>

              <div className="att-controls-mini">
                <label className="att-present">
                  <input type="checkbox" checked={!!r.present} onChange={() => togglePresent(idx)} />
                  Present
                </label>

                <div className="att-existing">
                  {r.existingAttendance ? <span className="exists-yes">Already marked</span> : <span className="exists-no">Not marked</span>}
                </div>

                <button className="att-save-one" onClick={() => saveSingle(r)} disabled={saving}>
                  Save
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
