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
    const userRef = doc(db, "users", user.uid);
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
  const [status, setStatus] = useState("checking"); // checking | not-signed-in | loaded | failed
  const [user, setUser] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [loadingTable, setLoadingTable] = useState(false);

  // progress
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // default fallback start date (used if settings doc missing)
  const FALLBACK_START_DATE = "2025-10-10";

  // fetch start date from Firestore settings/attendance
  const fetchStartDate = async () => {
    try {
      const settingsRef = doc(db, "settings", "attendance");
      const snap = await getDoc(settingsRef);
      if (snap && snap.exists()) {
        const data = snap.data();
        return data.startingDate || data.startDate || FALLBACK_START_DATE;
      } else {
        return FALLBACK_START_DATE;
      }
    } catch (err) {
      console.error("fetchStartDate error:", err);
      return FALLBACK_START_DATE;
    }
  };

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

        /* Get start date from settings => settings/attendance.startingDate */
        const startDateFromSettings = await fetchStartDate();

        // Build attendance table (only this user's attendance)
        await buildAttendanceTable(
          u.uid,
          u.displayName || "No name",
          u.email || null,
          startDateFromSettings
        );

        setStatus("loaded");
      } catch (err) {
        console.error("Attendance error:", err);
        setStatus("failed");
      }
    });

    return () => unsub();
  }, []);

  /**
   * Build table incrementally and update UI every row.
   * This version does NOT show a blocking overlay.
   * If the range is huge, consider batching updates (every N rows) to improve perf.
   */
  const buildAttendanceTable = async (uid, userName, userEmail, startDateStr) => {
    setLoadingTable(true);
    setTableRows([]);
    setLoadedCount(0);
    setTotalCount(0);

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
      const MAX_DAYS = 1000;
      const loopDays = Math.min(days, MAX_DAYS);

      setTotalCount(loopDays);

      // Build rows incrementally; update state each iteration so rows appear as they load
      const rows = [];
      for (let i = 0; i < loopDays; i++) {
        const d = addDays(start, i);
        const dateStr = formatYYYYMMDD(d);

        const attDocRef = doc(db, "users", uid, "attendance", dateStr);
        let attSnap;
        let attended = false;

        try {
          attSnap = await getDoc(attDocRef);
          attended = attSnap && attSnap.exists();
        } catch (err) {
          console.warn("Error fetching attendance for", dateStr, err);
          attended = false;
        }

        rows.push({
          day: i + 1,
          date: dateStr,
          userName,
          userEmail,
          attended,
        });

        // immediate UI update (one row at a time)
        setTableRows([...rows]);
        setLoadedCount(i + 1);
        // no delay — Firestore getDoc is the main IO; rows appear as IO completes
      }

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

        {status === "checking" && <p className="att-status">Loading attendance…</p>}
        {status === "not-signed-in" && <p className="att-status">Please sign in to view your attendance.</p>}
        {status === "loaded" && <p className="att-status success">Your attendance list below</p>}
        {status === "failed" && (
          <p className="att-status error">Could not load attendance. Try again later.</p>
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

          {/* Inline small progress bar/text above the table (non-blocking) */}
          {loadingTable && (
            <div className="attendance-inline-progress">
              Loading attendance — {loadedCount} / {totalCount}
            </div>
          )}

          {tableRows.length === 0 && !loadingTable ? (
            <p>No dates in range or not signed in.</p>
          ) : (
            <div className="attendance-table-wrap centered black-brown">
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
