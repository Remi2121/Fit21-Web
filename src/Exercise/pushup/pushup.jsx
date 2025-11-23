/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useState } from "react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import "./pushup.css";
import Pushup from "../../assets/pushup.png";

// Firebase
import { db } from "../../firebase";
import { doc, getDoc, setDoc, serverTimestamp ,increment} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function PushUpCounter() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // UI state
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("waiting");
  const [userId, setUserId] = useState(null);
  const [hasCompletedToday, setHasCompletedToday] = useState(false);
  const [finishedMessage, setFinishedMessage] = useState("");

  // Admin config (defaults; overwritten by Firestore)
  const [windowSeconds, setWindowSeconds] = useState(3);   // "Seconds"
  const [maxPoints, setMaxPoints] = useState(20);          // "maxPoints"
  const [perDayMax, setPerDayMax] = useState(20);          // "maximumcount perday"

  // Timer (shown near Status + in box)
  const [remainingMs, setRemainingMs] = useState(0);
  const countdownEndAtRef = useRef(null);
  const countdownTickRef = useRef(null);

  // Refs / lifecycle
  const poseRef = useRef(null);
  const rafIdRef = useRef(null);
  const streamRef = useRef(null);
  const motionStateRef = useRef("up");
  const countRef = useRef(0);
  const sessionActiveRef = useRef(false);

  const todayId = new Date().toISOString().split("T")[0];
  const exerciseName = "pushup";

  // Helpers
  const winSec = () => (Number(windowSeconds) > 0 ? Number(windowSeconds) : 3);
  const effectiveMax = () =>
    Math.min(
      Number(maxPoints) > 0 ? Number(maxPoints) : 20,
      Number(perDayMax) > 0 ? Number(perDayMax) : 999999
    );

   // ============================
  // 🔵 Detect current logged-in user
  // ============================
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => user && setUserId(user.uid));
    return () => unsub();
  }, []);

  // Load admin config
  useEffect(() => {
    (async () => {
      try {
        const cfgRef = doc(db, "poseRules", "pushup");
        const snap = await getDoc(cfgRef);
        if (snap.exists()) {
          const d = snap.data();
          if (typeof d.Seconds === "number" && d.Seconds > 0) setWindowSeconds(d.Seconds);
          if (typeof d.maxPoints === "number" && d.maxPoints > 0) setMaxPoints(d.maxPoints);
          const pd = d["maximumcount perday"];
          if (typeof pd === "number" && pd > 0) setPerDayMax(pd);
        }
      } catch (e) {
        console.warn("poseRules/pushup load failed:", e);
      }
    })();
  }, []);

  // Check today's record
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const ref = doc(db, "users", userId, "exercises", exerciseName, "days", todayId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const pts = Number(snap.data()?.points) || 0;
        setHasCompletedToday(true);
        setFinishedMessage(`Already finished today with ${pts} push-ups. Do tomorrow 🙂`);
      } else {
        setHasCompletedToday(false);
        setFinishedMessage("");
        initPose();
      }
    })();
    return cleanupPose;
  }, [userId, todayId]);

  // Pose init
  async function initPose() {
    if (hasCompletedToday || sessionActiveRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    } catch (e) {
      console.error("Camera error", e);
      setStatus("camera error");
      return;
    }

    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    poseRef.current = pose;
    poseRef.current.onResults(handleResults);

    async function sendFrame() {
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        await poseRef.current.send({ image: videoRef.current });
      }
      rafIdRef.current = requestAnimationFrame(sendFrame);
    }
    sendFrame();
  }

  // Cleanup
  function cleanupPose() {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;

    if (poseRef.current) { try { poseRef.current.close(); } catch {} poseRef.current = null; }
    if (videoRef.current?.srcObject) {
      try { videoRef.current.srcObject.getTracks().forEach((t) => t.stop()); } catch {}
      videoRef.current.srcObject = null;
    }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
      streamRef.current = null;
    }
    if (countdownTickRef.current) {
      clearInterval(countdownTickRef.current);
      countdownTickRef.current = null;
    }
    countdownEndAtRef.current = null;
    setRemainingMs(0);
  }

  // Math
  function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180) / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return angle;
  }

  async function finalizeAndSave() {
  if (sessionActiveRef.current) return;
  sessionActiveRef.current = true;

  const finalPoints = Math.min(countRef.current, effectiveMax());
  try {
    if (!userId) return;

    // 1️⃣  Save today’s pushup record
    const ref = doc(db, "users", userId, "exercises", exerciseName, "days", todayId);
    await setDoc(ref, {
      date: todayId,
      points: finalPoints,
      adminWindowSeconds: winSec(),
      adminMaxPoints: Number(maxPoints) || 20,
      adminPerDayMax: Number(perDayMax) || 20,
      savedAt: serverTimestamp(),
    });

    // 2️⃣  Increment the user's total finalScore atomically
    const userRef = doc(db, "users", userId);
    await setDoc(
      userRef,
      {
        finalScore: increment(finalPoints),
        updatedAt: serverTimestamp(),
      },
      { merge: true } // auto-create if missing
    );

    setHasCompletedToday(true);
    setFinishedMessage(`Finished today with ${finalPoints} push-ups. Do tomorrow 🙂`);
  } catch (e) {
    console.error("Save error:", e);
  } finally {
    cleanupPose();
  }
}


  // Countdown
  function startCountdownIfNeeded() {
    if (countdownEndAtRef.current || sessionActiveRef.current) return;
    const endAt = Date.now() + winSec() * 1000;
    countdownEndAtRef.current = endAt;
    setRemainingMs(endAt - Date.now());
    setStatus(`session started (${winSec()}s)`);

    countdownTickRef.current = setInterval(() => {
      const ms = endAt - Date.now();
      if (ms <= 0) {
        clearInterval(countdownTickRef.current);
        countdownTickRef.current = null;
        setRemainingMs(0);
        finalizeAndSave();
      } else {
        setRemainingMs(ms);
      }
    }, 100);
  }

  // Pose callback
  function handleResults(results) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    const cap = effectiveMax();

    if (results.poseLandmarks) {
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS);
      drawLandmarks(ctx, results.poseLandmarks);

      const lShoulder = results.poseLandmarks[11];
      const lElbow = results.poseLandmarks[13];
      const lWrist = results.poseLandmarks[15];
      const rShoulder = results.poseLandmarks[12];
      const rElbow = results.poseLandmarks[14];
      const rWrist = results.poseLandmarks[16];
      const lHip = results.poseLandmarks[23];
      const rHip = results.poseLandmarks[24];
      const nose = results.poseLandmarks[0];

      const leftArmAngle = calculateAngle(lShoulder, lElbow, lWrist);
      const rightArmAngle = calculateAngle(rShoulder, rElbow, rWrist);
      const bodyAngleLeft = calculateAngle(lShoulder, lHip, results.poseLandmarks[25]);
      const bodyAngleRight = calculateAngle(rShoulder, rHip, results.poseLandmarks[26]);

      const headHipDiff = Math.abs((nose.y - (lHip?.y + rHip?.y) / 2) * canvas.height);
      const validPosition = headHipDiff < 120;

      if (validPosition && !hasCompletedToday) {
        if (
          (leftArmAngle > 160 || rightArmAngle > 160) &&
          bodyAngleLeft > 160 &&
          bodyAngleRight > 160
        ) {
          if (motionStateRef.current === "down") {
            setCount((prev) => {
              const next = prev < cap ? prev + 1 : cap;
              countRef.current = next;
              if (next === 1) startCountdownIfNeeded(); // start on 1st rep
              return next;
            });
          }
          motionStateRef.current = "up";
          setStatus("up");
        } else if (leftArmAngle < 70 && rightArmAngle < 70) {
          motionStateRef.current = "down";
          setStatus("down");
        }
      } else if (!hasCompletedToday) {
        setStatus("no person detected");
      }

      // optional debug on canvas
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.fillText(`Window: ${winSec()}s  Cap: ${cap}`, 10, 20);
    } else {
      if (!hasCompletedToday) setStatus("no person detected");
    }

    ctx.restore();
  }

  useEffect(() => () => cleanupPose(), []);

  // Derived for status/box
  const showTimer = remainingMs > 0 && !hasCompletedToday;
  const remainingSec = Math.max(0, (remainingMs / 1000).toFixed(1));
  const totalMs = winSec() * 1000;
  const progressPct = showTimer
    ? Math.min(100, Math.max(0, (100 * (totalMs - remainingMs)) / (totalMs || 1)))
    : 0;

  return (
    <div className="pushup-container">
      <h2 className="stoke-text">Push-Up Counter</h2>

      {hasCompletedToday ? (
        <div className="finished-banner">
          {finishedMessage || "Already finished today. Do tomorrow 🙂"}
        </div>
      ) : (
        <>
          <video ref={videoRef} style={{ display: "none" }} width={640} height={480} />

          <div className="pushup-stage">
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              style={{ border: "2px solid #444", borderRadius: "8px" }}
            />
            <div className="pushup-plain">
              <span className="pushup-tip-plain">
                For this pose, stand in a proper side view facing the camera.
              </span>
              <img src={Pushup} className="pushup-pose-img" alt="ref" draggable="false" />
            </div>
          </div>

          {/* Status + inline timer */}
          <div className="status-line">
            <span><strong>Push-ups:</strong> {count}</span>
            <span>| <strong>Status:</strong> {status}</span>
            <span>
              {showTimer ? <> | <strong>Time:</strong> {remainingSec}s</> : <> | <strong>Time:</strong> --</>}
            </span>
          </div>

          {/* Admin Timer Box */}
          <div className="timer-box">
            <div className="timer-box-top">
              <span className="timer-box-title">Admin Timer</span>
              <span className="timer-box-chip">{winSec()}s</span>
            </div>
            <div className="timer-box-value">
              {showTimer ? remainingSec : winSec().toFixed(1)}<span>s</span>
            </div>
            <div className="timer-box-bar">
              <div className="timer-box-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="timer-box-hint">
              Starts after <b>1st rep</b> • Cap: <b>{effectiveMax()}</b>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* 
import React, { useRef, useEffect, useState } from "react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import './pushup.css'
import Pushup from "../../assets/pushup.png"

// === Firebase imports ===
import { db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function PushUpCounter() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("waiting");
  const [userId, setUserId] = useState(null);

  const exerciseId = "pushup"; // Unique exercise identifier

  // ============================
  // 🔵 Detect current logged-in user
  // ============================
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // ============================
  // 🔵 Load daily points + reset once per day
  // ============================
  useEffect(() => {
    if (!userId) return;

    async function loadDailyPoints() {
      const today = new Date().toISOString().split("T")[0];
      const ref = doc(db, "users", userId, "exercises", exerciseId);

      const snap = await getDoc(ref);

      // First time ever → create record
      if (!snap.exists()) {
        await setDoc(ref, { date: today, points: 0 });
        setCount(0);
        return;
      }

      const data = snap.data();

      // New day → reset once
      if (data.date !== today) {
        await setDoc(ref, { date: today, points: 0 });
        setCount(0);
        return;
      }

      // Same day → load existing
      setCount(data.points);
    }

    loadDailyPoints();
  }, [userId]);

  // ============================
  // 🔵 Save points whenever count changes (cap at 20)
  // ============================
  useEffect(() => {
    if (!userId) return;

    async function savePoints() {
      const today = new Date().toISOString().split("T")[0];
      const ref = doc(db, "users", userId, "Exercises", exerciseId);

      let pointsToSave = count;
      if (pointsToSave > 2) pointsToSave = 2; // my change

      await setDoc(ref, { date: today, points: pointsToSave });
    }

    savePoints();
  }, [count, userId]);

  // ============================
  // 🔵 Manual reset button handler
  // ============================
  const handleManualReset = async () => {
    if (!userId) return;
    const today = new Date().toISOString().split("T")[0];
    const ref = doc(db, "users", userId, "exercises", exerciseId);
    await setDoc(ref, { date: today, points: 0 });
    setCount(0);
  };

  // ============================
  // ⚠️ EXISTING Push-Up Pose Logic (unchanged)
  // ============================
  useEffect(() => {
    let pose;
    let rafId;
    let state = "up"; // track push-up motion

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch (e) {
        console.error("Camera error", e);
        setStatus("camera error");
        return;
      }

      pose = new Pose({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      pose.onResults(onResults);

      async function sendFrame() {
        if (
          videoRef.current &&
          !videoRef.current.paused &&
          !videoRef.current.ended
        ) {
          await pose.send({ image: videoRef.current });
        }
        rafId = requestAnimationFrame(sendFrame);
      }

      sendFrame();
    }

    function calculateAngle(a, b, c) {
      const radians =
        Math.atan2(c.y - b.y, c.x - b.x) -
        Math.atan2(a.y - b.y, a.x - b.x);
      let angle = Math.abs((radians * 180.0) / Math.PI);
      if (angle > 180.0) angle = 360 - angle;
      return angle;
    }

    function onResults(results) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS);
        drawLandmarks(ctx, results.poseLandmarks);

        const lShoulder = results.poseLandmarks[11];
        const lElbow = results.poseLandmarks[13];
        const lWrist = results.poseLandmarks[15];
        const rShoulder = results.poseLandmarks[12];
        const rElbow = results.poseLandmarks[14];
        const rWrist = results.poseLandmarks[16];
        const lHip = results.poseLandmarks[23];
        const rHip = results.poseLandmarks[24];
        const nose = results.poseLandmarks[0];

        const leftArmAngle = calculateAngle(lShoulder, lElbow, lWrist);
        const rightArmAngle = calculateAngle(rShoulder, rElbow, rWrist);
        const bodyAngleLeft = calculateAngle(
          lShoulder,
          lHip,
          results.poseLandmarks[25]
        );
        const bodyAngleRight = calculateAngle(
          rShoulder,
          rHip,
          results.poseLandmarks[26]
        );

        const headHipDiff = Math.abs(
          (nose.y - (lHip.y + rHip.y) / 2) * canvas.height
        );
        const validPosition = headHipDiff < 120;

        if (validPosition) {
          if (
            (leftArmAngle > 160 || rightArmAngle > 160) &&
            bodyAngleLeft > 160 &&
            bodyAngleRight > 160
          ) {
            if (state === "down") {
              setCount((prev) => (prev < 20 ? prev + 1 : 20)); // cap at 20
            }
            state = "up";
            setStatus("up");
          } else if (leftArmAngle < 70 && rightArmAngle < 70) {
            state = "down";
            setStatus("down");
          }
        }

        ctx.fillStyle = "white";
        ctx.font = "16px Arial";
        ctx.fillText(`Left Arm: ${Math.round(leftArmAngle)}°`, 10, 20);
        ctx.fillText(`Right Arm: ${Math.round(rightArmAngle)}°`, 10, 40);
        ctx.fillText(`Head-Hip Diff: ${headHipDiff.toFixed(1)} px`, 10, 60);
      } else {
        setStatus("no person detected");
      }

      ctx.restore();
    }

    init();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
      if (pose) pose.close();
    };
  }, []);

  return (
    <div className="pushup-container">
      <h2 className="stoke-text"> Push-Up Counter</h2>
      <video
        ref={videoRef}
        style={{ display: "none" }}
        width={640}
        height={480}
      />

      <div className="pushup-stage">
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{
            border: "2px solid #444",
            borderRadius: "8px",
          }}
        />

        <div className="pushup-plain">
          <span className="pushup-tip-plain">
            For this pose, stand in a proper side view facing the camera.
          </span>
          <img src={Pushup} className="pushup-pose-img" alt="ref" draggable="false" />
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 18 }}>
        <strong>Push-ups:</strong> {count} | <strong>Status:</strong> {status}
      </div>

      {/* 🔵 Manual reset button 
      <button 
        onClick={handleManualReset} 
        style={{ marginTop: 10, padding: "6px 12px", fontSize: 16 }}
      >
        Reset Today
      </button>
    </div>
  );
}
*/