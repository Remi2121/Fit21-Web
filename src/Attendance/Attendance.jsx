import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import "./Attendance.css";
import Headers from "../components/header/header";

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setStatus("not-signed-in");
        setTableRows([]);
        setLoadedCount(0);
        setTotalCount(0);
        return;
      }

      setUser(u);
      setStatus("checking");

      try {
        await saveUserToFirestore(u);
        await buildAttendanceTable(u.uid, u.displayName || "No name", u.email || null);
        setStatus("loaded");
      } catch (err) {
        console.error("Attendance error:", err);
        setStatus("failed");
      }
    });

    return () => unsub();
  }, []);

  const buildAttendanceTable = async (uid, userName, userEmail) => {
    setLoadingTable(true);
    setTableRows([]);
    setLoadedCount(0);
    setTotalCount(0);

    try {
      const attColRef = collection(db, "users", uid, "attendance");
      const q = query(attColRef, orderBy("date", "asc"));
      const snap = await getDocs(q);

      let docs = snap.docs;
      if (docs.length === 0) {
        const snap2 = await getDocs(attColRef);
        docs = snap2.docs;
      }

      const rows = docs.map((docSnap) => {
        const data = docSnap.data() || {};

        let rawDate = null;
        if (data.date && typeof data.date.toDate === "function") {
          rawDate = data.date.toDate();
        } else if (typeof data.date === "string" && data.date.trim()) {
          const parsed = new Date(data.date);
          if (!isNaN(parsed.getTime())) rawDate = parsed;
        } else {
          const id = docSnap.id;
          const parsedId = new Date(id);
          if (!isNaN(parsedId.getTime())) rawDate = parsedId;
        }

        const displayDate = rawDate ? rawDate.toLocaleString() : (data.date || docSnap.id || "");

        const presentFlag = Object.prototype.hasOwnProperty.call(data, "present")
          ? !!data.present
          : true;

        return {
          id: docSnap.id,
          dateRaw: rawDate,
          date: displayDate,
          userName,
          userEmail,
          attended: presentFlag,
        };
      });

      rows.sort((a, b) => {
        if (a.dateRaw && b.dateRaw) return a.dateRaw.getTime() - b.dateRaw.getTime();
        if (a.dateRaw && !b.dateRaw) return -1;
        if (!a.dateRaw && b.dateRaw) return 1;
        return a.id.localeCompare(b.id);
      });

      const numbered = rows.map((r, i) => ({ ...r, day: i + 1 }));

      setTableRows(numbered);
      setLoadedCount(numbered.length);
      setTotalCount(numbered.length);
    } catch (err) {
      console.error("buildAttendanceTable error:", err);
    } finally {
      setLoadingTable(false);
    }
  };

  return (
    <>
      <Headers />
      <div className="attendance-container">
        <div className="attendance-card">
          <div className="card-top">
            <h2 className="att-heading">Daily Attendance</h2>
            {status === "checking" && <p className="att-status">Loading attendance…</p>}
            {status === "not-signed-in" && (
              <p className="att-status">Please sign in to view your attendance.</p>
            )}
            {status === "loaded" && <p className="att-status success">Your attendance list below</p>}
            {status === "failed" && (
              <p className="att-status error">Could not load attendance. Try again later.</p>
            )}
          </div>

          {user && (
            <div className="user-block">
              <div className="user-name">{user.displayName || "No name"}</div>
              <div className="user-email">{user.email}</div>
              <div className="user-uid">UID: {user.uid}</div>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <h3 className="list-title">Attendance List</h3>

            {loadingTable && (
              <div className="attendance-inline-progress">
                Loading attendance — {loadedCount} / {totalCount}
              </div>
            )}

            <div className="attendance-table-wrap centered black-brown">
              {tableRows.length === 0 && !loadingTable ? (
                <p className="no-records">No attendance records yet.</p>
              ) : (
                <table className="attendance-table three-d" aria-describedby="attendance-list">
                  <thead>
                    <tr>
                      <th>DAY</th>
                      <th>DATE</th>
                      <th>USERNAME</th>
                      <th>USERMAIL</th>
                      <th>ATTENDANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r) => (
                      <tr key={r.id} className="row-3d" tabIndex={0}>
                        <td>{r.day}</td>
                        <td>{r.date}</td>
                        <td>{r.userName}</td>
                        <td>{r.userEmail}</td>
                        <td>
                          <span className={r.attended ? "pill pill-yes" : "pill pill-no"}>
                            {r.attended ? "Yes" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {loadingTable && (
        <div className="attendance-loading-overlay" aria-hidden>
          <div className="attendance-loading-card">
            <div className="loading-title">Loading attendance…</div>
            <div className="loading-sub">{loadedCount} / {totalCount}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default Attendance;
