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

  // Date only for saving record
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [markedList, setMarkedList] = useState([]);
  const [markedLoading, setMarkedLoading] = useState(false);

  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState("");

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString() : "—";

  const dayOptions = Array.from({ length: 21 }, (_, i) => i + 1);

  /* ---------- LOAD USERS (EVERY USER) ---------- */
  const loadUsers = async (dayNum) => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));

      const rows = await Promise.all(
        snap.docs.map(async (udoc) => {
          const u = udoc.data() || {};
          const ref = doc(
            db,
            "users",
            udoc.id,
            "attendance",
            `day-${dayNum}`
          );

          const attSnap = await getDoc(ref);

          return {
            id: udoc.id,
            name: u.username || u.name || "No Name",
            email: u.email || "",
            present: attSnap.exists()
              ? attSnap.data().present
              : null,
          };
        })
      );

      setUsers(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
        // Push all, not just present
        rows.push({
          id: d.id,
          name: data.name || "No Name",
          email: data.email || "",
          present: data.present, // true / false
          date: data.date || null,
        });
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
      if (snap.exists()) {
        const d = snap.data();
        rows.push({
          id: udoc.id,
          name: d.name || "No Name",
          email: d.email || "",
          present: d.present,   // true or false
          date: d.date || null,
        });
      }
    }
    setMarkedList(rows);
  } finally {
    setMarkedLoading(false);
  }
};



  useEffect(() => {
    loadUsers(selectedDay);
    loadMarkedForDay(selectedDay);
    // eslint-disable-next-line
  }, [selectedDay]);

  /* ---------- SAVE SINGLE USER ---------- */
  const saveUser = async (u) => {
    if (u.present === null) {
      setMessage("Select Present or Absent");
      return;
    }

    setSavingId(u.id);
    setMessage("");

    try {
      const ref = doc(
        db,
        "users",
        u.id,
        "attendance",
        `day-${selectedDay}`
      );

      await setDoc(
        ref,
        {
          day: selectedDay,
          date: selectedDate, // saved only
          present: u.present,
          name: u.name,
          email: u.email,
        },
        { merge: true }
      );

      setMessage(`Attendance saved for ${u.name}`);
      await loadMarkedForDay(selectedDay);
    } catch (e) {
      console.error(e);
      setMessage("Save failed");
    } finally {
      setSavingId(null);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  /* ---------- UI ---------- */
  return (
    <div className="att-wrap">
      <h2>Attendance — Admin</h2>

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
          <label>Date (record only)</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {message && <div className="att-msg">{message}</div>}

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
                <td>
                  {m.present ? (
                    <span className="badge badge-green">Present</span>
                    ) : (
                    <span className="badge badge-red">Absent</span>
                  )}
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      )}


      {/* -------- EVERY USER -------- */}
      <h3>Every user — Day {selectedDay}</h3>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className="att-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Save</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, idx) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>

                <td style={{ textAlign: "center" }}>
                  <input
                    type="radio"
                    checked={u.present === true}
                    onChange={() => {
                      const cp = [...users];
                      cp[idx].present = true;
                      setUsers(cp);
                    }}
                  />
                </td>

                <td style={{ textAlign: "center" }}>
                  <input
                    type="radio"
                    checked={u.present === false}
                    onChange={() => {
                      const cp = [...users];
                      cp[idx].present = false;
                      setUsers(cp);
                    }}
                  />
                </td>

                <td>
                  <button
                    className="att-save-one"
                    onClick={() => saveUser(u)}
                    disabled={savingId === u.id}
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="att-sep" />

      
    </div>
  );
}
