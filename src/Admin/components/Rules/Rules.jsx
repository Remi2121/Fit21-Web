/* eslint-disable react-hooks/exhaustive-deps */
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

  // ===== Push-up (existing) =====
  const [puSeconds, setPuSeconds] = useState(""); // "Seconds"
  const [puMaxPoints, setPuMaxPoints] = useState(""); // "maxPoints"
  const [puPerDayMax, setPuPerDayMax] = useState(""); // "maximumcount perday"
  const [puSaving, setPuSaving] = useState(false);
  const [puMsg, setPuMsg] = useState("");
  const pushupRef = doc(db, "poseRules", "pushup");

  useEffect(() => {
    const unsub = onSnapshot(
      pushupRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
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
        Seconds: Number(puSeconds),
        maxPoints: 1,
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

  // ===== Bridge Pose (existing) =====
  const bridgeRef = doc(db, "poseRules", "bridgepose");
  const [bpSeconds, setBpSeconds] = useState("");
  const [bpSaving, setBpSaving] = useState(false);
  const [bpMsg, setBpMsg] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      bridgeRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (d?.holdMs != null) setBpSeconds(Number(d.holdMs) / 1000);
          else if (d?.holdSeconds != null) setBpSeconds(Number(d.holdSeconds));
          else setBpSeconds("");
        } else {
          setBpSeconds("");
        }
      },
      (err) => {
        console.error("Bridge rules onSnapshot:", err);
        setBpMsg("Failed to subscribe to Bridge rules.");
      }
    );

    (async () => {
      try {
        await getDoc(bridgeRef);
      } catch (e) {
        console.warn("Initial Bridge read failed:", e);
      }
    })();

    return () => unsub && unsub();
  }, []);

  const validateBridge = () => {
    setBpMsg("");
    const s = Number(bpSeconds);
    if (bpSeconds === "" || isNaN(s) || s <= 0) {
      setBpMsg("Enter a valid Bridge hold time (seconds > 0).");
      return false;
    }
    return true;
  };

  const handleSaveBridge = async (e) => {
    e?.preventDefault?.();
    if (!validateBridge()) return;
    setBpMsg("");
    setBpSaving(true);
    try {
      const sec = Number(bpSeconds);
      const payload = {
        holdSeconds: sec,
        holdMs: Math.round(sec * 1000),
        updatedAt: serverTimestamp(),
      };
      await setDoc(bridgeRef, payload, { merge: true });
      setBpMsg("✅ Bridge rules saved.");
    } catch (err) {
      console.error("Save Bridge rules error:", err);
      setBpMsg("❌ Failed to save Bridge rules. See console.");
    } finally {
      setBpSaving(false);
      setTimeout(() => setBpMsg(""), 3000);
    }
  };

  const handleResetDefaultsBridge = () => {
    setBpSeconds(10);
    setBpMsg("Defaults applied (not saved). Click Save to persist.");
    setTimeout(() => setBpMsg(""), 2500);
  };

  // ===== Squat (existing) =====
  const squatRef = doc(db, "poseRules", "squat");
  const [sqSeconds, setSqSeconds] = useState("");
  const [sqMaxPoints, setSqMaxPoints] = useState("");
  const [sqPerDayMax, setSqPerDayMax] = useState("");
  const [sqSaving, setSqSaving] = useState(false);
  const [sqMsg, setSqMsg] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      squatRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const s = d?.Seconds;
          const mp = d?.maxPoints;
          const pd = d?.["maximumcount perday"];
          setSqSeconds(typeof s === "number" ? s : "");
          setSqMaxPoints(typeof mp === "number" ? mp : "");
          setSqPerDayMax(typeof pd === "number" ? pd : "");
        } else {
          setSqSeconds("");
          setSqMaxPoints("");
          setSqPerDayMax("");
        }
      },
      (err) => {
        console.error("Squat rules onSnapshot:", err);
        setSqMsg("Failed to subscribe to Squat rules.");
      }
    );

    (async () => {
      try {
        await getDoc(squatRef);
      } catch (e) {
        console.warn("Initial Squat read failed:", e);
      }
    })();

    return () => unsub && unsub();
  }, []);

  const validateSquat = () => {
    setSqMsg("");
    const s = Number(sqSeconds);
    const mp = Number(sqMaxPoints);
    const pd = Number(sqPerDayMax);
    if (sqSeconds === "" || isNaN(s) || s <= 0) {
      setSqMsg("Enter a valid window Seconds (> 0).");
      return false;
    }
    if (sqMaxPoints === "" || isNaN(mp) || mp <= 0) {
      setSqMsg("Enter a valid maxPoints (> 0).");
      return false;
    }
    if (sqPerDayMax === "" || isNaN(pd) || pd <= 0) {
      setSqMsg('Enter a valid "maximumcount perday" (> 0).');
      return false;
    }
    return true;
  };

  const handleSaveSquat = async (e) => {
    e?.preventDefault?.();
    if (!validateSquat()) return;
    setSqMsg("");
    setSqSaving(true);
    try {
      const payload = {
        Seconds: Number(sqSeconds),
        maxPoints: 1,
        ["maximumcount perday"]: Number(sqPerDayMax),
        updatedAt: serverTimestamp(),
      };
      await setDoc(squatRef, payload, { merge: true });
      setSqMsg("✅ Squat rules saved.");
    } catch (err) {
      console.error("Save squat rules error:", err);
      setSqMsg("❌ Failed to save Squat rules. See console.");
    } finally {
      setSqSaving(false);
      setTimeout(() => setSqMsg(""), 3000);
    }
  };

  const handleResetDefaultsSquat = () => {
    setSqSeconds(5);
    setSqMaxPoints(20);
    setSqPerDayMax(20);
    setSqMsg("Defaults applied (not saved). Click Save to persist.");
    setTimeout(() => setSqMsg(""), 2500);
  };

  // ===== Plank (NEW) =====
  const plankRef = doc(db, "poseRules", "plank");
  const [plSeconds, setPlSeconds] = useState("");
  const [plMaxPoints, setPlMaxPoints] = useState("");
  const [plSaving, setPlSaving] = useState(false);
  const [plMsg, setPlMsg] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      plankRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const s = d?.Seconds;
          const mp = d?.maxPoints;
          setPlSeconds(typeof s === "number" ? s : "");
          setPlMaxPoints(typeof mp === "number" ? mp : "");
        } else {
          setPlSeconds("");
          setPlMaxPoints("");
        }
      },
      (err) => {
        console.error("Plank rules onSnapshot:", err);
        setPlMsg("Failed to subscribe to Plank rules.");
      }
    );

    (async () => {
      try {
        await getDoc(plankRef);
      } catch (e) {
        console.warn("Initial Plank read failed:", e);
      }
    })();

    return () => unsub && unsub();
  }, []);

  const validatePlank = () => {
    setPlMsg("");
    const s = Number(plSeconds);
    const mp = Number(plMaxPoints);
    if (plSeconds === "" || isNaN(s) || s <= 0) {
      setPlMsg("Enter a valid hold time (seconds > 0).");
      return false;
    }
    if (plMaxPoints === "" || isNaN(mp) || mp <= 0) {
      setPlMsg("Enter a valid maxPoints (> 0).");
      return false;
    }
    return true;
  };

  const handleSavePlank = async (e) => {
    e?.preventDefault?.();
    if (!validatePlank()) return;
    setPlMsg("");
    setPlSaving(true);
    try {
      const payload = {
        Seconds: Number(plSeconds),
        maxPoints: Number(plMaxPoints),
        updatedAt: serverTimestamp(),
      };
      await setDoc(plankRef, payload, { merge: true });
      setPlMsg("✅ Plank rules saved.");
    } catch (err) {
      console.error("Save Plank rules error:", err);
      setPlMsg("❌ Failed to save Plank rules. See console.");
    } finally {
      setPlSaving(false);
      setTimeout(() => setPlMsg(""), 3000);
    }
  };

  const handleResetDefaultsPlank = () => {
    setPlSeconds(60);
    setPlMaxPoints(10);
    setPlMsg("Defaults applied (not saved). Click Save to persist.");
    setTimeout(() => setPlMsg(""), 2500);
  };

  /* =========================
   * ===== Chair (SIMPLIFIED) =====
   * poseRules/chair
   * Fields: holdSeconds|holdMs + kneeMin,kneeMax,hipMin,hipMax
   * ========================= */
  const chairRef = doc(db, "poseRules", "chair");

  // Hold
  const [chSeconds, setChSeconds] = useState("");

  // Only 4 angles
  const defaultChair = { kneeMin: 70, kneeMax: 150, hipMin: 30, hipMax: 150 };
  const [ch, setCh] = useState(defaultChair);
  const [chSaving, setChSaving] = useState(false);
  const [chMsg, setChMsg] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      chairRef,
      (snap) => {
        if (!snap.exists()) {
          setCh(defaultChair);
          setChSeconds("");
          return;
        }
        const d = snap.data();

        // hold
        if (d?.holdMs != null) setChSeconds((Number(d.holdMs) / 1000) || "");
        else if (d?.holdSeconds != null) setChSeconds(Number(d.holdSeconds) || "");
        else setChSeconds("");

        // only these four
        setCh({
          kneeMin: typeof d?.kneeMin === "number" ? d.kneeMin : defaultChair.kneeMin,
          kneeMax: typeof d?.kneeMax === "number" ? d.kneeMax : defaultChair.kneeMax,
          hipMin:  typeof d?.hipMin  === "number" ? d.hipMin  : defaultChair.hipMin,
          hipMax:  typeof d?.hipMax  === "number" ? d.hipMax  : defaultChair.hipMax,
        });
      },
      (err) => {
        console.error("Chair rules onSnapshot:", err);
        setChMsg("Failed to subscribe to Chair rules.");
      }
    );

    (async () => {
      try {
        await getDoc(chairRef);
      } catch (e) {
        console.warn("Initial Chair read failed:", e);
      }
    })();

    return () => unsub && unsub();
  }, []);

  const validateChair = () => {
    setChMsg("");
    const s = Number(chSeconds);
    if (chSeconds === "" || isNaN(s) || s <= 0) {
      setChMsg("Enter a valid Chair hold time (seconds > 0).");
      return false;
    }
    if (
      ![ch.kneeMin, ch.kneeMax, ch.hipMin, ch.hipMax].every((v) => Number.isFinite(v))
    ) {
      setChMsg("Angles must be numbers.");
      return false;
    }
    if (ch.kneeMin >= ch.kneeMax) {
      setChMsg("kneeMin must be < kneeMax.");
      return false;
    }
    if (ch.hipMin >= ch.hipMax) {
      setChMsg("hipMin must be < hipMax.");
      return false;
    }
    if (
      ch.kneeMin < 0 || ch.kneeMax > 180 ||
      ch.hipMin < 0  || ch.hipMax > 180
    ) {
      setChMsg("Angles must be between 0 and 180.");
      return false;
    }
    return true;
  };

  const handleSaveChair = async (e) => {
    e?.preventDefault?.();
    if (!validateChair()) return;
    setChMsg("");
    setChSaving(true);
    try {
      const sec = Number(chSeconds);
      const payload = {
        holdSeconds: sec,
        holdMs: Math.round(sec * 1000),
        kneeMin: Number(ch.kneeMin),
        kneeMax: Number(ch.kneeMax),
        hipMin:  Number(ch.hipMin),
        hipMax:  Number(ch.hipMax),
        updatedAt: serverTimestamp(),
      };
      await setDoc(chairRef, payload, { merge: true });
      setChMsg("✅ Chair rules saved.");
    } catch (err) {
      console.error("Save Chair rules error:", err);
      setChMsg("❌ Failed to save Chair rules. See console.");
    } finally {
      setChSaving(false);
      setTimeout(() => setChMsg(""), 3000);
    }
  };

  const handleResetDefaultsChair = () => {
    setChSeconds(10);
    setCh(defaultChair);
    setChMsg("Defaults applied (not saved). Click Save to persist.");
    setTimeout(() => setChMsg(""), 2500);
  };

  // ===== UI =====
  if (loading) return <div className="rules-wrap">Loading rules…</div>;

  return (
    <div className="rules-wrap">
      {/* ===== BigToe ===== */}
      <h2 className="rules-title">Pose Rules — Big Toe </h2>

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

      {/* ===== Bridge ===== */}
      <h2 className="rules-title" style={{ marginTop: 28 }}>
        Pose Rules — Bridge 
      </h2>

      <form className="rules-form" onSubmit={handleSaveBridge}>
        <label className="rules-label">
          Hold time (seconds)
          <input
            className="rules-input"
            type="number"
            value={bpSeconds}
            onChange={(e) => setBpSeconds(e.target.value)}
            min="0.1"
            step="0.1"
          />
        </label>

        <div className="rules-actions">
          <button className="rules-save" type="submit" disabled={bpSaving}>
            {bpSaving ? "Saving…" : "Save rules"}
          </button>
          <button
            type="button"
            className="rules-default"
            onClick={handleResetDefaultsBridge}
          >
            Reset defaults
          </button>
        </div>

        {bpMsg && <div className="rules-msg">{bpMsg}</div>}
      </form>

     {/* ===== Chair (SIMPLIFIED) ===== */}
      <h2 className="rules-title" style={{ marginTop: 28 }}>
        Pose Rules — Chair 
      </h2>

      <form className="rules-form" onSubmit={handleSaveChair}>
        <label className="rules-label">
          Hold time (seconds)
          <input
            className="rules-input"
            type="number"
            value={chSeconds}
            onChange={(e) => setChSeconds(e.target.value)}
            min="0.1"
            step="0.1"
          />
        </label>

        {/* Horizontal row with 4 angle inputs */}
        <div className="rules-row">
          <label className="rules-label-inline">
            kneeMin
            <input
              className="rules-input"
              type="number"
              value={ch.kneeMin}
              step="1"
              min="0"
              max="180"
              onChange={(e) => setCh({ ...ch, kneeMin: Number(e.target.value) })}
            />
          </label>

          <label className="rules-label-inline">
            kneeMax
            <input
              className="rules-input"
              type="number"
              value={ch.kneeMax}
              step="1"
              min="0"
              max="180"
              onChange={(e) => setCh({ ...ch, kneeMax: Number(e.target.value) })}
            />
          </label>

          <label className="rules-label-inline">
            hipMin
            <input
              className="rules-input"
              type="number"
              value={ch.hipMin}
              step="1"
              min="0"
              max="180"
              onChange={(e) => setCh({ ...ch, hipMin: Number(e.target.value) })}
            />
          </label>

          <label className="rules-label-inline">
            hipMax
            <input
              className="rules-input"
              type="number"
              value={ch.hipMax}
              step="1"
              min="0"
              max="180"
              onChange={(e) => setCh({ ...ch, hipMax: Number(e.target.value) })}
            />
          </label>
        </div>

        <div className="rules-actions">
          <button className="rules-save" type="submit" disabled={chSaving}>
            {chSaving ? "Saving…" : "Save rules"}
          </button>
          <button
            type="button"
            className="rules-default"
            onClick={handleResetDefaultsChair}
          >
            Reset defaults
          </button>
        </div>

        {chMsg && <div className="rules-msg">{chMsg}</div>}
      </form>
    

      {/* ===== Push-Up ===== */}
      <h2 className="rules-title" style={{ marginTop: 28 }}>
        Pose Rules — Push-Up
      </h2>

      <form className="rules-form" onSubmit={handleSavePushup}>


        <label className="rules-label">
  maxPoints (per-session cap)
  <input
    className="rules-input"
    type="number"
    value={1}
    disabled
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

      {/* ===== Squat ===== */}
      <h2 className="rules-title" style={{ marginTop: 28 }}>
        Pose Rules — Squat 
      </h2>

      <form className="rules-form" onSubmit={handleSaveSquat}>
        

        <label className="rules-label">
  maxPoints (per-session cap)
  <input
    className="rules-input"
    type="number"
    value={1}
    disabled
    min="1"
    step="1"
  />
</label>


        <label className="rules-label">
          maximumcount perday (daily cap)
          <input
            className="rules-input"
            type="number"
            value={sqPerDayMax}
            onChange={(e) => setSqPerDayMax(e.target.value)}
            min="1"
            step="1"
          />
        </label>

        <div className="rules-actions">
          <button className="rules-save" type="submit" disabled={sqSaving}>
            {sqSaving ? "Saving…" : "Save rules"}
          </button>
          <button
            type="button"
            className="rules-default"
            onClick={handleResetDefaultsSquat}
          >
            Reset defaults
          </button>
        </div>

        {sqMsg && <div className="rules-msg">{sqMsg}</div>}
      </form>

      {/* ===== Plank ===== */}
      <h2 className="rules-title" style={{ marginTop: 28 }}>
        Pose Rules — Plank 
      </h2>

      <form className="rules-form" onSubmit={handleSavePlank}>
        <label className="rules-label">
          Seconds (hold time)
          <input
            className="rules-input"
            type="number"
            value={plSeconds}
            onChange={(e) => setPlSeconds(e.target.value)}
            min="1"
            step="1"
          />
        </label>

        <label className="rules-label">
          maxPoints
          <input
            className="rules-input"
            type="number"
            value={plMaxPoints}
            onChange={(e) => setPlMaxPoints(e.target.value)}
            min="1"
            step="1"
          />
        </label>

        <div className="rules-actions">
          <button className="rules-save" type="submit" disabled={plSaving}>
            {plSaving ? "Saving…" : "Save rules"}
          </button>
          <button
            type="button"
            className="rules-default"
            onClick={handleResetDefaultsPlank}
          >
            Reset defaults
          </button>
        </div>

        {plMsg && <div className="rules-msg">{plMsg}</div>}
      </form>

      </div>
  );
}
