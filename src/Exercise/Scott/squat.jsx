/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useState } from "react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import "./squat.css";
import SquatImg from "../../assets/squat.png";

// Firebase imports
import { db } from "../../firebase";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function SquatCounter() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // UI state
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("waiting");
  const [userId, setUserId] = useState(null);
  const [hasCompletedToday, setHasCompletedToday] = useState(false);
  const [finishedMessage, setFinishedMessage] = useState("");

  // Admin config (live from Firestore)
  const [windowSeconds, setWindowSeconds] = useState(5); // Seconds
  const [maxPoints, setMaxPoints] = useState(20);        // maxPoints
  const [perDayMax, setPerDayMax] = useState(20);        // maximumcount perday

  // Timer UI
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

  const exerciseName = "squat";
  const todayId = new Date().toISOString().split("T")[0];

  // Helpers
  const winSec = () => (Number(windowSeconds) > 0 ? Number(windowSeconds) : 5);
  const capPoints = (n) =>
    Math.min(
      Number(maxPoints) > 0 ? Number(maxPoints) : 20,
      Number(perDayMax) > 0 ? Number(perDayMax) : 20,
      n
    );

  // 1) Detect logged-in user
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => user && setUserId(user.uid));
    return () => unsub();
  }, []);

  // 2) Load admin config (live)
  useEffect(() => {
    const cfgRef = doc(db, "poseRules", "squat");
    const unsub = onSnapshot(
      cfgRef,
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        if (typeof d.Seconds === "number" && d.Seconds > 0) setWindowSeconds(d.Seconds);
        if (typeof d.maxPoints === "number" && d.maxPoints > 0) setMaxPoints(d.maxPoints);
        const pd = d["maximumcount perday"];
        if (typeof pd === "number" && pd > 0) setPerDayMax(pd);
      },
      (e) => console.warn("poseRules/squat load failed:", e)
    );
    return () => unsub();
  }, []);

  // 3) Check if already saved today (one-save-per-day)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const ref = doc(db, "users", userId, "exercises", exerciseName, "days", todayId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const pts = Number(snap.data()?.points) || 0;
          setHasCompletedToday(true);
          setFinishedMessage(`Already finished today with ${pts} squats. Do tomorrow 🙂`);
        } else {
          setHasCompletedToday(false);
          setFinishedMessage("");
          initPose();
        }
      } catch (e) {
        console.error("squat already-done check failed:", e);
      }
    })();
    return cleanupPose;
  }, [userId, todayId]);

  // -------- Pose / camera setup ----------
  async function initPose() {
    if (hasCompletedToday || sessionActiveRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
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
    poseRef.current.onResults(onResults);

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

    if (poseRef.current) {
      try { poseRef.current.close(); } catch {}
      poseRef.current = null;
    }
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

  // Angle calculator
  function calculateAngle(a, b, c) {
    const radians =
      Math.atan2(c.y - b.y, c.x - b.x) -
      Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  }

  // ---------- Save once (end of session) ----------
  async function finalizeAndSave() {
    if (sessionActiveRef.current) return;
    sessionActiveRef.current = true;

    const finalPoints = capPoints(countRef.current);

    try {
      if (!userId) return;

      // 1) Save day doc (idempotent per day)
      const dayRef = doc(db, "users", userId, "exercises", exerciseName, "days", todayId);
      await setDoc(dayRef, {
        date: todayId,
        points: finalPoints,
        adminWindowSeconds: winSec(),
        adminMaxPoints: Number(maxPoints) || 20,
        adminPerDayMax: Number(perDayMax) || 20,
        savedAt: serverTimestamp(),
      });

      // 2) Increment user's total finalScore atomically (create if missing)
      const userRef = doc(db, "users", userId);
      await setDoc(
        userRef,
        {
          finalScore: increment(finalPoints),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setHasCompletedToday(true);
      setFinishedMessage(`Finished today with ${finalPoints} squats. Do tomorrow 🙂`);
    } catch (e) {
      console.error("Squat save error:", e);
    } finally {
      cleanupPose();
    }
  }

  // Countdown (starts after 1st rep)
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
  function onResults(results) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    const cap = capPoints(9999);

    if (results.poseLandmarks) {
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS);
      drawLandmarks(ctx, results.poseLandmarks);

      const lHip = results.poseLandmarks[23];
      const rHip = results.poseLandmarks[24];
      const lKnee = results.poseLandmarks[25];
      const rKnee = results.poseLandmarks[26];
      const lAnkle = results.poseLandmarks[27];
      const rAnkle = results.poseLandmarks[28];
      const lShoulder = results.poseLandmarks[11];
      const rShoulder = results.poseLandmarks[12];
      const lElbow = results.poseLandmarks[13];
      const rElbow = results.poseLandmarks[14];

      const leftKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
      const rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
      const leftHandAngle = calculateAngle(lElbow, lShoulder, lHip);
      const rightHandAngle = calculateAngle(rElbow, rShoulder, rHip);

      // Standing posture validation
      const validPosition =
        leftKneeAngle > 50 &&
        rightKneeAngle > 50 &&
        leftHandAngle > 80 &&
        rightHandAngle > 80;

      if (!hasCompletedToday && validPosition) {
        // Standing (UP)
        if (leftKneeAngle > 160 && rightKneeAngle > 160) {
          if (motionStateRef.current === "down") {
            setCount((prev) => {
              const next = prev < cap ? prev + 1 : cap;
              countRef.current = next;
              if (next === 1) startCountdownIfNeeded(); // start after first rep
              return next;
            });
          }
          motionStateRef.current = "up";
          setStatus("up");
        }
        // Squatting (DOWN)
        else if (leftKneeAngle < 100 && rightKneeAngle < 100) {
          motionStateRef.current = "down";
          setStatus("down");
        }
      } else if (!hasCompletedToday) {
        setStatus("no person detected");
      }

      // debug text
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.fillText(`Window: ${winSec()}s  Cap: ${capPoints(999)}  Count: ${countRef.current}`, 10, 20);
    } else {
      if (!hasCompletedToday) setStatus("no person detected");
    }

    ctx.restore();
  }

  useEffect(() => () => cleanupPose(), []);

  // Derived for UI
  const showTimer = remainingMs > 0 && !hasCompletedToday;
  const remainingSec = Math.max(0, (remainingMs / 1000).toFixed(1));
  const totalMs = winSec() * 1000;
  const progressPct = showTimer
    ? Math.min(100, Math.max(0, (100 * (totalMs - remainingMs)) / (totalMs || 1)))
    : 0;

  // -------- UI ----------
  return (
    <div className="squat-container">
      <h2 className="stoke-text">Squat Counter</h2>

      {hasCompletedToday ? (
        <div className="finished-banner">
          {finishedMessage || "Already finished today. Do tomorrow 🙂"}
        </div>
      ) : (
        <>
          <video ref={videoRef} style={{ display: "none" }} width={640} height={480} />

          <div className="squat-stage">
            <canvas ref={canvasRef} width={640} height={480} />
            <div className="squat-plain">
              <span className="squat-tip-plain">
                Stand in proper side view facing the camera for accurate tracking.
              </span>
              <img src={SquatImg} className="squat-pose-img" alt="ref" draggable="false" />
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 18 }}>
            <strong>Squats:</strong> {count} | <strong>Status:</strong> {status}
            {showTimer ? <> | <strong>Time:</strong> {remainingSec}s</> : <> | <strong>Time:</strong> --</>}
          </div>

          {/* Admin Timer Box (like push-up UI) */}
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
              Starts after <b>1st rep</b> • Cap: <b>{Math.min(maxPoints, perDayMax)}</b>
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
import "./squat.css";
import SquatImg from "../../assets/squat.png";

// Firebase imports
import { db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function SquatCounter() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("waiting");
  const [userId, setUserId] = useState(null);

  const exerciseId = "squat";

  // -------------------------------------------------------
  // 1. Detect logged-in user
  // -------------------------------------------------------
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
    });
    return () => unsubscribe();
  }, []);

  // -------------------------------------------------------
  // 2. Load daily points ONCE per day (fixed refresh bug)
  // -------------------------------------------------------
  useEffect(() => {
    if (!userId) return;

    async function loadDailyPoints() {
      const today = new Date().toISOString().split("T")[0];
      const ref = doc(db, "users", userId, "exercises", exerciseId);
      const snap = await getDoc(ref);

      // 🔥 If data doesn't exist → create first-time record
      if (!snap.exists()) {
        await setDoc(
          ref,
          { date: today, points: 0 },
          { merge: true } // avoids overwriting accidentally
        );
        setCount(0);
        return;
      }

      const data = snap.data();

      // 🔥 If today's record → load today's points
      if (data.date === today) {
        setCount(data.points || 0);
        return;
      }

      // 🔥 If different day → reset once
      await setDoc(
        ref,
        { date: today, points: 0 },
        { merge: true }
      );
      setCount(0);
    }

    loadDailyPoints();
  }, [userId]);

  // -------------------------------------------------------
  // 3. Save points whenever count changes (cap at 20)
  // -------------------------------------------------------
  useEffect(() => {
    if (!userId) return;

    async function savePoints() {
      const today = new Date().toISOString().split("T")[0];
      const ref = doc(db, "users", userId, "exercises", exerciseId);

      const pointsToSave = count > 20 ? 20 : count;

      // 🔥 merge: true prevents overwriting date field incorrectly
      await setDoc(
        ref,
        { date: today, points: pointsToSave },
        { merge: true }
      );
    }

    savePoints();
  }, [count, userId]);

  
  // -------------------------------------------------------
  // 5. Squat detection using Mediapipe
  // -------------------------------------------------------
  useEffect(() => {
    let pose;
    let rafId;
    let state = "up"; // track squat state

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

    // Angle calculator
    function calculateAngle(a, b, c) {
      const radians =
        Math.atan2(c.y - b.y, c.x - b.x) -
        Math.atan2(a.y - b.y, a.x - b.x);
      let angle = Math.abs((radians * 180.0) / Math.PI);
      if (angle > 180.0) angle = 360 - angle;
      return angle;
    }

    // Pose callback
    function onResults(results) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS);
        drawLandmarks(ctx, results.poseLandmarks);

        const lHip = results.poseLandmarks[23];
        const rHip = results.poseLandmarks[24];
        const lKnee = results.poseLandmarks[25];
        const rKnee = results.poseLandmarks[26];
        const lAnkle = results.poseLandmarks[27];
        const rAnkle = results.poseLandmarks[28];
        const lShoulder = results.poseLandmarks[11];
        const rShoulder = results.poseLandmarks[12];
        const lElbow = results.poseLandmarks[13];
        const rElbow = results.poseLandmarks[14];

        const leftKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
        const rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
        const leftHandAngle = calculateAngle(lElbow, lShoulder, lHip);
        const rightHandAngle = calculateAngle(rElbow, rShoulder, rHip);

        // Standing posture validation
        const validPosition =
          leftKneeAngle > 50 &&
          rightKneeAngle > 50 &&
          leftHandAngle > 80 &&
          rightHandAngle > 80;

        if (validPosition) {
          // Standing (UP)
          if (leftKneeAngle > 160 && rightKneeAngle > 160) {
            if (state === "down") {
              // Add count only on up movement
              setCount((prev) => (prev < 20 ? prev + 1 : 20));
            }
            state = "up";
            setStatus("up");
          }

          // Squatting (DOWN)
          else if (leftKneeAngle < 100 && rightKneeAngle < 100) {
            state = "down";
            setStatus("down");
          }
        }

        ctx.fillStyle = "white";
        ctx.font = "16px Arial";
        ctx.fillText(`Left Knee: ${Math.round(leftKneeAngle)}°`, 10, 20);
        ctx.fillText(`Right Knee: ${Math.round(rightKneeAngle)}°`, 10, 40);
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

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------
  return (
    <div className="squat-container">
      <h2 className="stoke-text">Squat Counter</h2>

      <video ref={videoRef} style={{ display: "none" }} width={640} height={480} />

      <div className="squat-stage">
        <canvas ref={canvasRef} width={640} height={480} />

        <div className="squat-plain">
          <span className="squat-tip-plain">
            Stand in proper side view facing the camera for accurate tracking.
          </span>

          <img src={SquatImg} className="squat-pose-img" alt="ref" draggable="false" />
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 18 }}>
        <strong>Squats:</strong> {count} | <strong>Status:</strong> {status}
      </div>

      
    </div>
  );
}
  */
