/* eslint-disable no-useless-computed-key */
// src/Admin/components/Rules/Rules.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../services/firebase";
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import "./Rules.css";

export default function Rules() {
  // ===== BigToe (existing) =====
  const [hipAngle, setHipAngle] = useState("");
  const [holdSeconds, setHoldSeconds] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [docData, setDocData] = useState(null);

  const bigToeRef = doc(db, "poseRules", "bigtoe");

  useEffect(() => {
    const unsub = onSnapshot(
      bigToeRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setDocData(data || null);
          const hip = data?.hipAngleLimit ?? data?.hipAngle ?? "";
          setHipAngle(hip === "" ? "" : hip);
          if (data?.holdMs != null) {
            setHoldSeconds(Number(data.holdMs) / 1000);
          } else if (data?.holdSeconds != null) {
            setHoldSeconds(Number(data.holdSeconds));
          } else {
            setHoldSeconds("");
          }
        } else {
          setDocData(null);
          setHipAngle("");
          setHoldSeconds("");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Rules onSnapshot:", err);
        setMessage("Failed to subscribe to BigToe rules.");
        setLoading(false);
      }
    );

    (async () => {
      try {
        await getDoc(bigToeRef);
      } catch (e) {
        console.warn("Initial BigToe read failed:", e);
      }
    })();

    return () => unsub && unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateBigToe = () => {
    setMessage("");
    const hip = Number(hipAngle);
    const sec = Number(holdSeconds);
    if (hipAngle === "" || isNaN(hip)) {
      setMessage("Enter a valid hip angle (degrees).");
      return false;
    }
    if (hip < 0 || hip > 180) {
      setMessage("Hip angle must be between 0 and 180.");
      return false;
    }
    if (holdSeconds === "" || isNaN(sec) || sec <= 0) {
      setMessage("Enter a valid hold time (seconds > 0).");
      return false;
    }
    return true;
  };

  const handleSaveBigToe = async (e) => {
    e?.preventDefault?.();
    if (!validateBigToe()) return;
    setMessage("");
    setSaving(true);
    try {
      const hip = Number(hipAngle);
      const sec = Number(holdSeconds);
      const payload = {
        hipAngleLimit: hip,
        holdSeconds: sec,
        holdMs: Math.round(sec * 1000),
        updatedAt: serverTimestamp(),
      };
      await setDoc(bigToeRef, payload, { merge: true });
      setMessage("✅ BigToe rules saved.");
      setDocData((prev) => ({ ...(prev || {}), ...payload }));
    } catch (err) {
      console.error("Save BigToe rules error:", err);
      setMessage("❌ Failed to save BigToe rules. See console.");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleResetDefaultsBigToe = () => {
    setHipAngle(80);
    setHoldSeconds(10);
    setMessage("Defaults applied (not saved). Click Save to persist.");
    setTimeout(() => setMessage(""), 2500);
  };

  // ===== Push-up (NEW) =====
  const [puSeconds, setPuSeconds] = useState(""); // maps to "Seconds"
  const [puMaxPoints, setPuMaxPoints] = useState(""); // maps to "maxPoints"
  const [puPerDayMax, setPuPerDayMax] = useState(""); // maps to "maximumcount perday"
  const [puSaving, setPuSaving] = useState(false);
  const [puMsg, setPuMsg] = useState("");
  const pushupRef = doc(db, "poseRules", "pushup");

  useEffect(() => {
    const unsub = onSnapshot(
      pushupRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          // EXACT keys as requested
          const s = d?.Seconds;
          const mp = d?.maxPoints;
          const perDay = d?.["maximumcount perday"];

          setPuSeconds(typeof s === "number" ? s : "");
          setPuMaxPoints(typeof mp === "number" ? mp : "");
          setPuPerDayMax(typeof perDay === "number" ? perDay : "");
        } else {
          setPuSeconds("");
          setPuMaxPoints("");
          setPuPerDayMax("");
        }
      },
      (err) => {
        console.error("Push-up rules onSnapshot:", err);
        setPuMsg("Failed to subscribe to Push-up rules.");
      }
    );

    (async () => {
      try {
        await getDoc(pushupRef);
      } catch (e) {
        console.warn("Initial Push-up read failed:", e);
      }
    })();

    return () => unsub && unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validatePushup = () => {
    setPuMsg("");
    const s = Number(puSeconds);
    const mp = Number(puMaxPoints);
    const pd = Number(puPerDayMax);
    if (puSeconds === "" || isNaN(s) || s <= 0) {
      setPuMsg("Enter a valid window Seconds (> 0).");
      return false;
    }
    if (puMaxPoints === "" || isNaN(mp) || mp <= 0) {
      setPuMsg("Enter a valid maxPoints (> 0).");
      return false;
    }
    if (puPerDayMax === "" || isNaN(pd) || pd <= 0) {
      setPuMsg('Enter a valid "maximumcount perday" (> 0).');
      return false;
    }
    return true;
  };

  const handleSavePushup = async (e) => {
    e?.preventDefault?.();
    if (!validatePushup()) return;
    setPuMsg("");
    setPuSaving(true);
    try {
      const payload = {
        // keep EXACT field names
        Seconds: Number(puSeconds),
        maxPoints: Number(puMaxPoints),
        ["maximumcount perday"]: Number(puPerDayMax),
        updatedAt: serverTimestamp(),
      };
      await setDoc(pushupRef, payload, { merge: true });
      setPuMsg("✅ Push-up rules saved.");
    } catch (err) {
      console.error("Save push-up rules error:", err);
      setPuMsg("❌ Failed to save push-up rules. See console.");
    } finally {
      setPuSaving(false);
      setTimeout(() => setPuMsg(""), 3000);
    }
  };

  const handleResetDefaultsPushup = () => {
    setPuSeconds(3);
    setPuMaxPoints(20);
    setPuPerDayMax(20);
    setPuMsg("Defaults applied (not saved). Click Save to persist.");
    setTimeout(() => setPuMsg(""), 2500);
  };

  if (loading) return <div className="rules-wrap">Loading rules…</div>;

  return (
    <div className="rules-wrap">
      {/* ===== BigToe section (existing) ===== */}
      <h2 className="rules-title">Pose Rules — Big Toe (admin)</h2>

      <form className="rules-form" onSubmit={handleSaveBigToe}>
        <label className="rules-label">
          Hip angle limit (degrees)
          <input
            className="rules-input"
            type="number"
            value={hipAngle}
            onChange={(e) => setHipAngle(e.target.value)}
            min="0"
            max="180"
            step="1"
          />
        </label>

        <label className="rules-label">
          Hold time (seconds)
          <input
            className="rules-input"
            type="number"
            value={holdSeconds}
            onChange={(e) => setHoldSeconds(e.target.value)}
            min="0.1"
            step="0.1"
          />
        </label>

        <div className="rules-actions">
          <button className="rules-save" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save rules"}
          </button>
          <button
            type="button"
            className="rules-default"
            onClick={handleResetDefaultsBigToe}
          >
            Reset defaults
          </button>
        </div>

        {message && <div className="rules-msg">{message}</div>}
      </form>

      {/* ===== Push-up section (NEW) ===== */}
      <h2 className="rules-title" style={{ marginTop: 28 }}>
        Pose Rules — Push-Up (admin)
      </h2>

      <form className="rules-form" onSubmit={handleSavePushup}>
        <label className="rules-label">
          Seconds (timer window)
          <input
            className="rules-input"
            type="number"
            value={puSeconds}
            onChange={(e) => setPuSeconds(e.target.value)}
            min="1"
            step="1"
          />
        </label>

        <label className="rules-label">
          maxPoints (per-session cap)
          <input
            className="rules-input"
            type="number"
            value={puMaxPoints}
            onChange={(e) => setPuMaxPoints(e.target.value)}
            min="1"
            step="1"
          />
        </label>

        <label className="rules-label">
          maximumcount perday (daily cap)
          <input
            className="rules-input"
            type="number"
            value={puPerDayMax}
            onChange={(e) => setPuPerDayMax(e.target.value)}
            min="1"
            step="1"
          />
        </label>

        <div className="rules-actions">
          <button className="rules-save" type="submit" disabled={puSaving}>
            {puSaving ? "Saving…" : "Save rules"}
          </button>
          <button
            type="button"
            className="rules-default"
            onClick={handleResetDefaultsPushup}
          >
            Reset defaults
          </button>
        </div>

        {puMsg && <div className="rules-msg">{puMsg}</div>}
      </form>
    </div>
  );
}
