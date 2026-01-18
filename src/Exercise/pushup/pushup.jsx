/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useState } from "react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import "./pushup.css";
import PushUpImg from "../../assets/pushup.png";

import { db } from "../../firebase";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function PushUpCounter() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("waiting");
  const [userId, setUserId] = useState(null);

  const [maxCount, setMaxCount] = useState(20);
  const [completed, setCompleted] = useState(false);

  const maxCountRef = useRef(20);
  const exerciseId = "pushup";

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
  // Load admin rule
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
      const ref = doc(db, "users", userId, "exercises", exerciseId, "days", today);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await setDoc(ref, {
          date: today,
          points: 0,
          completed: false,
        });
        setCount(0);
        setCompleted(false);
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
    if (!userId) return;

    const today = new Date().toISOString().split("T")[0];
    const dayRef = doc(db, "users", userId, "exercises", exerciseId, "days", today);
    const userRef = doc(db, "users", userId);

    const daySnap = await getDoc(dayRef);
    if (daySnap.exists() && daySnap.data().completed) return;

    setCompleted(true);
    setStatus("You have finished today’s task");

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
  // PUSH-UP POSE LOGIC (UNCHANGED)
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
        Math.atan2(c.y - b.y, c.x - b.x) -
        Math.atan2(a.y - b.y, a.x - b.x);
      let angle = Math.abs((radians * 180.0) / Math.PI);
      if (angle > 180) angle = 360 - angle;
      return angle;
    }

    function onResults(results) {
      if (completed) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS);
        drawLandmarks(ctx, results.poseLandmarks);

        const lm = results.poseLandmarks;

        const lShoulder = lm[11];
        const lElbow = lm[13];
        const lWrist = lm[15];
        const rShoulder = lm[12];
        const rElbow = lm[14];
        const rWrist = lm[16];
        const lHip = lm[23];
        const rHip = lm[24];
        const nose = lm[0];

        const leftArmAngle = calculateAngle(lShoulder, lElbow, lWrist);
        const rightArmAngle = calculateAngle(rShoulder, rElbow, rWrist);
        const bodyAngleLeft = calculateAngle(lShoulder, lHip, lm[25]);
        const bodyAngleRight = calculateAngle(rShoulder, rHip, lm[26]);

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
          } else if (leftArmAngle < 110 && rightArmAngle < 110) {
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
  <div className="pushup-container">
    <h2 className="stoke-text">Push-Up Counter</h2>

    <div style={{ marginTop: 6 }}>
      Max per day: <strong>{maxCount}</strong>
    </div>

    <video ref={videoRef} style={{ display: "none" }} />

    <div className="pushup-stage">
      {/* 🔴 CAMERA + STATUS SIDE */}
      <div className="pushup-camera-box">
        <canvas ref={canvasRef} width={640} height={480} />

        {completed ? (
          <div className="pushup-finished">
            ✅ You have finished today’s task
          </div>
        ) : (
          <>
            <div className="pushup-status">
              <strong>Push-ups:</strong> {count}/{maxCount} |{" "}
              <strong>Status:</strong> {status}
            </div>

            <button
              className="pushup-reset-btn"
              onClick={() => {
                const ok = window.confirm(
                  "⚠️ If you confirm this score, you can’t do push-ups again today."
                );
                if (ok) finishToday(count);
              }}
            >
              Finish Today
            </button>
          </>
        )}
      </div>

      {/* 🔵 INSTRUCTIONS SIDE */}
      <div className="pushup-plain">
        <img
          src={PushUpImg}
          className="pushup-pose-img"
          alt="ref"
          draggable="false"
        />

        <div className="pushup-instructions">
          <ul className="pushup-points">
            <li>
              If the camera is not working, please refresh the page and try again.
            </li>

            <li>
              Position yourself in a proper side view facing the camera.
            </li>

            <li>
              <strong>UP position:</strong> Keep your arms fully straight
              (arm angle &gt; 160°) and your body in a straight line from head
              to heels (body angle &gt; 160°).
            </li>

            <li>
              <strong>DOWN position:</strong> Bend your elbows and lower your body
              until your arms are bent (arm angle &lt; 110°). Keep your core
              tight and back straight.
            </li>

            <li>
              When you reach the daily maximum, press{" "}
              <strong>“Finish Today”</strong> to confirm and complete today’s
              exercise.
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
);

}