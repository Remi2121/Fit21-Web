// Attendance.jsx
import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase"; // adjust the path
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import "./Attendance.css";
import Headers from "../components/header/header"

/* -------------------- DATE HELPER -------------------- */
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

/* -------------------- SAVE USER FIRESTORE -------------------- */
const saveUserToFirestore = async (user) => {
  if (!user) return;

  try {
    const userRef = doc(db, "attendance", user.uid);
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
  const [status, setStatus] = useState("checking"); // checking | marked | failed | not-signed-in
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setStatus("not-signed-in");
        return;
      }

      setUser(u);
      setStatus("checking");

      try {
        /* Save user details first */
        await saveUserToFirestore(u);

        /* Mark attendance */
        const uid = u.uid;
        const today = getTodayYYYYMMDD();
        const attRef = doc(db, "users", uid, "attendance", today);

        const snap = await getDoc(attRef);

        if (snap.exists()) {
          setStatus("marked");
        } else {
          await setDoc(attRef, {
            userId: uid,
            date: today,
            markedAt: serverTimestamp(),
            userName: u.displayName || null,
            email: u.email || null,
          });
          setStatus("marked");
        }
      } catch (err) {
        console.error("Attendance error:", err);
        setStatus("failed");
      }
    });

    return () => unsub();
  }, []);

  return (
    <div className="attendance-container">
    <Headers/>
      <div className="attendance-card">
        <h2 className="att-heading">Daily Attendance</h2>

        {status === "checking" && (
          <p className="att-status">Checking attendance…</p>
        )}
        {status === "not-signed-in" && (
          <p className="att-status">Please sign in to mark attendance.</p>
        )}
        {status === "marked" && (
          <p className="att-status success">Attendance marked for today ✅</p>
        )}
        {status === "failed" && (
          <p className="att-status error">
            Could not mark attendance. Try again later.
          </p>
        )}

        {user && (
          <div className="user-block">
            <div className="user-name">{user.displayName || "No name"}</div>
            <div className="user-email">{user.email}</div>
            <div className="user-uid">UID: {user.uid}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Attendance;
