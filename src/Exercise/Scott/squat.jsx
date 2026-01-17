/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useState } from "react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import "./squat.css";
import SquatImg from "../../assets/squat.png";

import { db } from "../../firebase";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function SquatCounter() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("waiting");
  const [userId, setUserId] = useState(null);

  const [maxCount, setMaxCount] = useState(20);
  const [completed, setCompleted] = useState(false);

  const userIdRef = useRef(null);
  const maxCountRef = useRef(20);

  const exerciseId = "squat";

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    maxCountRef.current = maxCount;
  }, [maxCount]);

  // -----------------------------
  // Auth
  // -----------------------------
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
    });
    return () => unsub();
  }, []);

  // -----------------------------
  // Load admin maxCount
  // -----------------------------
  useEffect(() => {
    const ruleRef = doc(db, "poseRules", exerciseId);

    const unsub = onSnapshot(ruleRef, (snap) => {
      if (!snap.exists()) return;

      const raw =
        snap.data()["maximumcount perday"] ??
        snap.data().maximumcount_perday ??
        snap.data().maximumCountPerDay;

      const m = Number(raw);
      if (!Number.isNaN(m) && m > 0) setMaxCount(m);
    });

    return () => unsub();
  }, []);

  // -----------------------------
  // Load today's state
  // -----------------------------
  useEffect(() => {
    if (!userId) return;

    async function loadToday() {
      const today = new Date().toISOString().split("T")[0];
      const ref = doc(
        db,
        "users",
        userId,
        "exercises",
        exerciseId,
        "days",
        today
      );
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setCount(0);
        //1 setCompleted(false);
        return;
      }

      const data = snap.data();
      setCount(Number(data.points || 0));
      setCompleted(Boolean(data.completed));
    }

    loadToday();
  }, [userId, maxCount]);

  // -----------------------------
  // FINAL COMMIT (ONCE PER DAY)
  // -----------------------------
  const finishToday = async (finalPoints) => {
    if (!userId || completed) return;
    //2 if (!userId) return;

    // 🔒 LOCK UI IMMEDIATELY (CRITICAL FIX)
    setCompleted(true);
    setStatus("You have finished today’s task");

    const today = new Date().toISOString().split("T")[0];
    const dayRef = doc(
      db,
      "users",
      userId,
      "exercises",
      exerciseId,
      "days",
      today
    );
    const userRef = doc(db, "users", userId);

    const daySnap = await getDoc(dayRef);
    if (daySnap.exists() && daySnap.data().completed) return;

    await setDoc(dayRef, {
      date: today,
      points: finalPoints,
      completed: true,
    });

    const userSnap = await getDoc(userRef);
    const prev = Number(userSnap.data()?.finalScore || 0);

    await updateDoc(userRef, {
      finalScore: prev + finalPoints,
    });
  };

  // -----------------------------
  // Squat Pose Logic (UNCHANGED)
  // -----------------------------
  useEffect(() => {
    let pose;
    let rafId;
    let state = "up";
    let started = false;

    async function init() {
      if (started) return;
      started = true;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch {
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

      const loop = async () => {
        if (videoRef.current && pose && !videoRef.current.paused) {
          await pose.send({ image: videoRef.current });
        }
        rafId = requestAnimationFrame(loop);
      };

      loop();
    }

    function calculateAngle(a, b, c) {
      const radians =
        Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
      let angle = Math.abs((radians * 180.0) / Math.PI);
      if (angle > 180) angle = 360 - angle;
      return angle;
    }

    function onResults(results) {
      if (completed) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS);
        drawLandmarks(ctx, results.poseLandmarks);

        const lm = results.poseLandmarks;
        const leftKneeAngle = calculateAngle(lm[23], lm[25], lm[27]);
        const rightKneeAngle = calculateAngle(lm[24], lm[26], lm[28]);
        const lefthandangle = calculateAngle(lm[13], lm[11], lm[23]);
        const righthandangle = calculateAngle(lm[14], lm[12], lm[24]);

        const valid =
          leftKneeAngle > 50 &&
          rightKneeAngle > 50 &&
          lefthandangle > 80 &&
          righthandangle > 80;

        if (valid) {
          if (leftKneeAngle > 160 && rightKneeAngle > 160) {
            if (state === "down") {
              setCount((prev) => {
                const cap = maxCountRef.current;
                if (prev >= cap) return cap;

                const next = prev + 1;
                if (next === cap) finishToday(cap);
                return next;
              });
            }
            state = "up";
            setStatus("up");
          } else if (leftKneeAngle < 100 && rightKneeAngle < 100) {
            state = "down";
            setStatus("down");
          }
        }
      }
    }

    init();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
      pose?.close();
    };
  }, [completed]);

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="squat-container">
      <h2 className="stoke-text">Squat Counter</h2>

      <div style={{ marginTop: 6 }}>
        Max per day: <strong>{maxCount}</strong>
      </div>

      <video ref={videoRef} style={{ display: "none" }} />

      <div className="squat-stage">
        <div className="squat-camera-box">
        <canvas ref={canvasRef} width={640} height={480} />
        {completed ? (
          <div className="squat-finished">
            ✅ You have finished today’s task
          </div>
        ) : (
          <div className="squat-status">
            <strong>Squats:</strong> {count}/{maxCount} |{" "}
            <strong>Status:</strong> {status}
          </div>
        )}
        </div>
        <div className="squat-plain">
          <span className="squat-tip-plain">
          If the camera is not working, please refresh the page and try again.
          </span>
          <span className="squat-tip-plain">
            Stand in proper side view facing the camera.
          </span>
          <span className="squat-tip-plain">
            UP: Keep your legs fully straight. Raise both hands above shoulder
            level (more than 90°).
          </span>
          <span className="squat-tip-plain">
            DOWN: Bend your knees and lower your body into a squat. Keep your
            back straight. Your hands can stay raised.
          </span>
          <span className="squat-tip-plain">

            When you reach the daily maximum, press “Finish Today” to confirm
            and complete today’s exercise.
          </span>
          
          <img src={SquatImg} className="squat-pose-img" alt="ref" />
        </div>
      </div>

      {!completed && (
        <button
          className="squat-reset-btn"
          onClick={() => {
            const ok = window.confirm(
              "⚠️ If you confirm this score, you can’t do squats again today."
            );
            if (ok) finishToday(count);
          }}
        >
          Finish Today
        </button>
      )}
    </div>
  );
}
