// Attendance.jsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import "./Attendance.css";
import Headers from "../components/header/header";

/* -------------------- DATE HELPERS -------------------- */
function getTodayYYYYMMDD(timeZone = "Asia/Colombo") {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const map = {};
  parts.forEach((p) => (map[p.type] = p.value));
  return `${map.year}-${map.month}-${map.day}`;
}

function formatYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYYYYMMDD(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/* -------------------- SAVE USER FIRESTORE (profile -> users/{uid}) -------------------- */
const saveUserToFirestore = async (user) => {
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.uid); // <-- FIXED HERE
    await setDoc(
      userRef,
      {
        uid: user.uid,
        name: user.displayName || user.name || "No Name",
        email: user.email || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("saveUser error:", err);
  }
};

/* -------------------- ATTENDANCE COMPONENT -------------------- */
const Attendance = () => {
  const [status, setStatus] = useState("checking");
  const [user, setUser] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);

  const START_DATE = "2025-10-10";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setStatus("not-signed-in");
        setTableRows([]);
        return;
      }

      setUser(u);
      setStatus("checking");

      try {
        /* Save user profile */
        await saveUserToFirestore(u);

        /* Mark today's attendance */
        const uid = u.uid;
        const today = getTodayYYYYMMDD();
        const attRef = doc(db, "users", uid, "attendance", today);

        const snap = await getDoc(attRef);

        if (!snap.exists()) {
          await setDoc(attRef, {
            userId: uid,
            date: today,
            markedAt: serverTimestamp(),
            userName: u.displayName || null,
            email: u.email || null,
          });
        }

        setStatus("marked");

        // Build attendance table
        await buildAttendanceTable(uid, u.displayName || "No name", u.email || null, START_DATE);

      } catch (err) {
        console.error("Attendance error:", err);
        setStatus("failed");
      }
    });

    return () => unsub();
  }, []);

  const buildAttendanceTable = async (uid, userName, userEmail, startDateStr) => {
    setLoadingTable(true);

    try {
      const todayStr = getTodayYYYYMMDD();
      const start = parseYYYYMMDD(startDateStr);
      const today = parseYYYYMMDD(todayStr);

      if (start > today) {
        setTableRows([]);
        setLoadingTable(false);
        return;
      }

      const days = Math.ceil((today - start) / (1000 * 60 * 60 * 24)) + 1;
      const rows = [];
      const MAX_DAYS = 1000;

      const loopDays = Math.min(days, MAX_DAYS);

      for (let i = 0; i < loopDays; i++) {
        const d = addDays(start, i);
        const dateStr = formatYYYYMMDD(d);

        const attDocRef = doc(db, "users", uid, "attendance", dateStr);
        let attSnap;

        try {
          attSnap = await getDoc(attDocRef);
        } catch (err) {
          console.warn("Error fetching attendance for", dateStr, err);
        }

        const attended = attSnap && attSnap.exists();

        rows.push({
          day: i + 1,
          date: dateStr,
          userName,
          userEmail,
          attended,
        });
      }

      setTableRows(rows);

    } catch (err) {
      console.error("buildAttendanceTable error:", err);
    } finally {
      setLoadingTable(false);
    }
  };

  return (
    <div className="attendance-container">
      <Headers />
      <div className="attendance-card">
        <h2 className="att-heading">Daily Attendance</h2>

        {status === "checking" && <p className="att-status">Checking attendance…</p>}
        {status === "not-signed-in" && <p className="att-status">Please sign in to mark attendance.</p>}
        {status === "marked" && <p className="att-status success">Attendance marked for today ✅</p>}
        {status === "failed" && (
          <p className="att-status error">Could not mark attendance. Try again later.</p>
        )}

        {user && (
          <div className="user-block">
            <div className="user-name">{user.displayName || "No name"}</div>
            <div className="user-email">{user.email}</div>
            <div className="user-uid">UID: {user.uid}</div>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <h3 style={{ marginBottom: 10 }}>Attendance List</h3>

          {loadingTable ? (
            <p>Loading table…</p>
          ) : tableRows.length === 0 ? (
            <p>No dates in range or not signed in.</p>
          ) : (
            <div className="attendance-table-wrap centered">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Date</th>
                    <th>Username</th>
                    <th>Usermail</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr key={r.date}>
                      <td>{r.day}</td>
                      <td>{r.date}</td>
                      <td>{r.userName}</td>
                      <td>{r.userEmail}</td>
                      <td className={r.attended ? "att-yes" : "att-no"}>
                        {r.attended ? "Yes" : "No"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Attendance;
