// src/Admin/components/Attendance/Attendance.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../services/firebase";
import {
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import "./Attendance.css";

export default function Attendance() {
  const [selectedDay, setSelectedDay] = useState(1);

  // 🔥 Date select
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0]; // yyyy-mm-dd
  });

  // search/mark
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // lists
  const [markedList, setMarkedList] = useState([]);
  const [markedLoading, setMarkedLoading] = useState(false);

  const [allUsers, setAllUsers] = useState([]);
  const [allLoading, setAllLoading] = useState(false);

  const dayOptions = Array.from({ length: 21 }, (_, i) => i + 1);

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString() : "—";

  /* ---------- LOAD MARKED (ROBUST) ---------- */
  const loadMarkedForDay = async (dayNum) => {
    setMarkedLoading(true);
    try {
      // 1️⃣ Try collectionGroup
      const cg = query(
        collectionGroup(db, "attendance"),
        where("day", "==", Number(dayNum))
      );
      const snap = await getDocs(cg);

      if (!snap.empty) {
        const rows = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          if (data.present) {
            rows.push({
              id: d.id,
              name: data.name || "No Name",
              email: data.email || "",
              present: true,
              date: data.date || null,
            });
          }
        });
        setMarkedList(rows);
      } else {
        throw new Error("Empty CG");
      }
    } catch {
      // 2️⃣ Fallback: users/{uid}/attendance/day-X
      const usersSnap = await getDocs(collection(db, "users"));
      const rows = [];

      for (const udoc of usersSnap.docs) {
        const ref = doc(
          db,
          "users",
          udoc.id,
          "attendance",
          `day-${dayNum}`
        );
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data().present) {
          const d = snap.data();
          rows.push({
            id: udoc.id,
            name: d.name || "No Name",
            email: d.email || "",
            present: true,
            date: d.date || null,
          });
        }
      }
      setMarkedList(rows);
    } finally {
      setMarkedLoading(false);
    }
  };

  /* ---------- EVERY USER STATUS ---------- */
  const loadAllUsersWithStatus = async (dayNum) => {
    setAllLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const rows = await Promise.all(
        usersSnap.docs.map(async (udoc) => {
          const u = udoc.data() || {};
          const ref = doc(
            db,
            "users",
            udoc.id,
            "attendance",
            `day-${dayNum}`
          );
          const snap = await getDoc(ref);
          const present = snap.exists() ? !!snap.data().present : false;

          return {
            id: udoc.id,
            name: u.username || u.name || "No Name",
            email: u.email || "",
            status: present ? "Present" : "Not Marked",
          };
        })
      );
      setAllUsers(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setAllLoading(false);
    }
  };

  useEffect(() => {
    loadMarkedForDay(selectedDay);
    loadAllUsersWithStatus(selectedDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  /* ---------- SEARCH ---------- */
  const handleSearch = async () => {
    setResults([]);
    setMessage("");
    const term = queryText.trim().toLowerCase();
    if (!term) return;

    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const filtered = snap.docs.filter((d) => {
        const data = d.data() || {};
        return (
          (data.email || "").toLowerCase() === term ||
          (data.name || "").toLowerCase().startsWith(term)
        );
      });

const items = await Promise.all(
  filtered.map(async (d) => {
    const data = d.data() || {};

    const ref = doc(
      db,
      "users",
      d.id,
      "attendance",
      `day-${selectedDay}`
    );

    const attSnap = await getDoc(ref);

    return {
      docId: d.id,
      name: data.name || "No Name",
      email: data.email || "",
      present: attSnap.exists() ? !!attSnap.data().present : false,
    };
  })
);


      setResults(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

// ---------- SAVE ----------
const saveSingle = async (item) => {
  setSaving(true);
  setMessage("");

  try {
    const ref = doc(
      db,
      "users",
      item.docId,
      "attendance",
      `day-${selectedDay}`
    );

    // ✅ ALWAYS SAVE DOCUMENT
    await setDoc(
      ref,
      {
        day: Number(selectedDay),
        date: selectedDate,     // yyyy-mm-dd
        present: item.present,  // true OR false
        email: item.email,
        name: item.name,
      },
      { merge: true }
    );

    setMessage(
      item.present
        ? `Saved attendance for ${item.name}`
        : `Marked absent for ${item.name}`
    );

    await loadMarkedForDay(selectedDay);
    await loadAllUsersWithStatus(selectedDay);
  } catch (e) {
    console.error(e);
    setMessage("Action failed");
  } finally {
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  }
};


  /* ---------- UI ---------- */
  return (
    <div className="att-wrap">
      <h2>Attendance — mark present (admin)</h2>

      <div className="att-controls">
        <div className="att-day">
          <label>Day</label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(Number(e.target.value))}
          >
            {dayOptions.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="att-day">
          <label>Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="att-search">
          <label>Search by email or name</label>
          <input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
          />
          <button onClick={handleSearch} disabled={loading}
           className="att-save-one">
            Search
          </button>
        </div>
      </div>

      {message && <div className="att-msg">{message}</div>}

      {/* SEARCH RESULTS */}
      {results.map((r, idx) => (
        <div className="att-row" key={r.docId}>
          <div>
            <strong>{r.name}</strong> — {r.email}
          </div>

          <label className="att-present">
  <input
    type="checkbox"
    checked={r.present === true}
    onChange={() => {
      setResults((prev) => {
        const cp = [...prev];
        cp[idx] = { ...cp[idx], present: true };
        return cp;
      });
    }}
  />
  Present
</label>

<label className="att-present" style={{ marginLeft: 12 }}>
  <input
    type="checkbox"
    checked={r.present === false}
    onChange={() => {
      setResults((prev) => {
        const cp = [...prev];
        cp[idx] = { ...cp[idx], present: false };
        return cp;
      });
    }}
  />
  Absent
</label>


          <button
            className="att-save-one"
            onClick={() => saveSingle(r)}
            disabled={saving}
          >
            Save
          </button>
        </div>
      ))}

      <div className="att-sep" />

      {/* MARKED */}
      <h3>Day {selectedDay} — Marked</h3>
      {markedLoading ? (
        <p>Loading…</p>
      ) : markedList.length === 0 ? (
        <p>No attendance marked</p>
      ) : (
        <table className="att-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Date</th>
              <th>Present</th>
            </tr>
          </thead>
          <tbody>
            {markedList.map((m, i) => (
              <tr key={i}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>{formatDate(m.date)}</td>
                <td>Yes</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="att-sep" />

      {/* EVERY USER */}
      <h3>Every user — Day {selectedDay}</h3>
      {allLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="att-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((u, i) => (
              <tr key={i}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
