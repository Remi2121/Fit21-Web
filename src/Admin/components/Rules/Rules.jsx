// src/Admin/components/Rules/Rules.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../services/firebase"; // two-level up from components/Rules
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import "./Rules.css";

export default function Rules() {
  const [hipAngle, setHipAngle] = useState("");
  const [holdSeconds, setHoldSeconds] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [docData, setDocData] = useState(null);

  const docRef = doc(db, "poseRules", "bigtoe");

  useEffect(() => {
    const unsub = onSnapshot(
      docRef,
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
        setMessage("Failed to subscribe to Firestore document.");
        setLoading(false);
      }
    );

    // optional initial read
    (async () => {
      try {
        await getDoc(docRef);
      } catch (e) {
        console.warn("Initial doc read failed:", e);
      }
    })();

    return () => {
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = () => {
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

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!validate()) return;
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
      await setDoc(docRef, payload, { merge: true });
      setMessage("✅ Rules saved to Firestore.");
      setDocData((prev) => ({ ...(prev || {}), ...payload }));
    } catch (err) {
      console.error("Save rules error:", err);
      setMessage("❌ Failed to save rules. See console.");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleResetDefaults = () => {
    setHipAngle(80);
    setHoldSeconds(10);
    setMessage("Defaults applied (not saved). Click Save to persist.");
    setTimeout(() => setMessage(""), 2500);
  };

  if (loading) return <div className="rules-wrap">Loading rules…</div>;

  return (
    <div className="rules-wrap">
      <h2 className="rules-title">Pose Rules — Big Toe (admin)</h2>

      <form className="rules-form" onSubmit={handleSave}>
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
          <button type="button" className="rules-default" onClick={handleResetDefaults}>
            Reset defaults
          </button>
        </div>

        {message && <div className="rules-msg">{message}</div>}
      </form>


    </div>
  );
}
