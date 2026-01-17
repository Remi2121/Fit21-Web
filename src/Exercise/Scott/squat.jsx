/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useState } from "react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import "./squat.css";
import SquatImg from "../../assets/squat.png";

// Firebase imports
import { db } from "../../firebase";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function SquatCounter() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("waiting");
  const [userId, setUserId] = useState(null);

  // ✅ admin max count + avoid double add
  const [maxCount, setMaxCount] = useState(20);
  const [addedToFinal, setAddedToFinal] = useState(0);

  // ✅ fix mediapipe double-init (React StrictMode) using refs
  const userIdRef = useRef(null);
  const maxCountRef = useRef(20);

  const exerciseId = "squat"; // Unique exercise identifier

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    maxCountRef.current = maxCount;
  }, [maxCount]);

  // -----------------------------
  // Detect current logged-in user
  // -----------------------------
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
    });
    return () => unsubscribe();
  }, []);

  // ----------------------------------------
  // ✅ REALTIME Load maxCount from admin rules (poseRules/squat)
  // FIX: your firestore key has SPACE: "maximumcount perday"
  // ----------------------------------------
  useEffect(() => {
    const ruleRef = doc(db, "poseRules", exerciseId); // poseRules/squat

    const unsub = onSnapshot(
      ruleRef,
      (ruleSnap) => {
        if (!ruleSnap.exists()) return;

        const ruleData = ruleSnap.data();

        const raw =
          ruleData["maximumcount perday"] ??
          ruleData.maximumcount_perday ??
          ruleData.maximumcountPerDay ??
          ruleData.maximumCountPerDay;

        const m = Number(raw);

        if (!Number.isNaN(m) && m > 0) {
          setMaxCount(m);
        }
      },
      (err) => {
        console.error("poseRules read error:", err);
      }
    );

    return () => unsub();
  }, [exerciseId]);

  // ✅ helper: add only the difference to users/{uid}.finalScore
  const addToFinalScore = async (diff) => {
    const uid = userIdRef.current;
    if (!uid || diff <= 0) return;

    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      const prevFinal = Number(userSnap.data()?.finalScore || 0);
      await updateDoc(userRef, { finalScore: prevFinal + diff });
    } catch (e) {
      console.error("Failed to update finalScore:", e);
    }
  };

  // ----------------------------------------
  // Load daily points (Option A: each day separate doc)
  // Path: users/{uid}/exercises/squat/days/{YYYY-MM-DD}
  // ----------------------------------------
  useEffect(() => {
    if (!userId) return;

    async function loadDailyPoints() {
      const today = new Date().toISOString().split("T")[0];

      const dayRef = doc(db, "users", userId, "exercises", exerciseId, "days", today);
      const snap = await getDoc(dayRef);

      if (!snap.exists()) {
        await setDoc(dayRef, { date: today, points: 0, addedToFinal: 0 });
        setCount(0);
        setAddedToFinal(0);
        return;
      }

      const data = snap.data();
      const pts = Number(data.points || 0);
      const added = Number(data.addedToFinal || 0);

      setCount(pts > maxCount ? maxCount : pts);
      setAddedToFinal(added);
    }

    loadDailyPoints();
  }, [userId, maxCount]);

  // ----------------------------------------
  // Save points whenever count changes (cap at maxCount)
  // ----------------------------------------
  useEffect(() => {
    if (!userId) return;

    async function savePoints() {
      const today = new Date().toISOString().split("T")[0];
      const dayRef = doc(db, "users", userId, "exercises", exerciseId, "days", today);

      const pointsToSave = count > maxCount ? maxCount : count;

      await setDoc(
        dayRef,
        {
          date: today,
          points: pointsToSave,
          addedToFinal: addedToFinal,
        },
        { merge: true }
      );
    }

    savePoints();
  }, [count, userId, maxCount, addedToFinal]);

  // ---------------------------
  // Manual reset button
  // ---------------------------
  const handleManualReset = async () => {
    if (!userId) return;
    const today = new Date().toISOString().split("T")[0];
    const dayRef = doc(db, "users", userId, "exercises", exerciseId, "days", today);

    // reset today points, BUT don't rollback finalScore (keep addedToFinal as-is)
    await setDoc(dayRef, { date: today, points: 0 }, { merge: true });
    setCount(0);
  };

  // ---------------------------
  // Squat Pose Logic (unchanged)
  // ✅ FIX: init Pose ONLY ONCE ([]) to avoid mediapipe "File exists" error
  // ---------------------------
  useEffect(() => {
    let pose;
    let rafId;
    let state = "up"; // track squat motion
    let started = false;

    async function init() {
      // avoid double init in dev
      if (started) return;
      started = true;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch (e) {
        console.error("Camera error", e);
        setStatus("camera error");
        return;
      }

      pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      pose.onResults(onResults);

      async function sendFrame() {
        try {
          if (
            videoRef.current &&
            !videoRef.current.paused &&
            !videoRef.current.ended &&
            pose
          ) {
            await pose.send({ image: videoRef.current });
          }
        } catch (e) {}
        rafId = requestAnimationFrame(sendFrame);
      }

      sendFrame();
    }

    function calculateAngle(a, b, c) {
      const radians =
        Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
      let angle = Math.abs((radians * 180.0) / Math.PI);
      if (angle > 180.0) angle = 360 - angle;
      return angle;
    }

    function onResults(results) {
      const canvas = canvasRef.current;
      if (!canvas) return;
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
        const lelbow = results.poseLandmarks[13];
        const relbow = results.poseLandmarks[14];

        const leftKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
        const rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
        const lefthandangle = calculateAngle(lelbow, lShoulder, lHip);
        const righthandangle = calculateAngle(relbow, rShoulder, rHip);

        const validPosition =
          leftKneeAngle > 50 &&
          rightKneeAngle > 50 &&
          lefthandangle > 80 &&
          righthandangle > 80;

        if (validPosition) {
          if (leftKneeAngle > 160 && rightKneeAngle > 160) {
            if (state === "down") {
              setCount((prev) => {
                const cap = maxCountRef.current;
                if (prev >= cap) return cap;

                const newPoints = prev + 1;

                setAddedToFinal((prevAdded) => {
                  const diff = newPoints - prevAdded;
                  if (diff > 0) {
                    addToFinalScore(diff);
                    return newPoints;
                  }
                  return prevAdded;
                });

                return newPoints;
              });
            }
            state = "up";
            setStatus("up");
          } else if (leftKneeAngle < 100 && rightKneeAngle < 100) {
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

      if (pose) {
        try {
          pose.close();
        } catch (e) {}
      }
    };
  }, []);

  return (
    <div className="squat-container">
      <h2 className="stoke-text"> Squat Counter</h2>

      <div style={{ marginTop: 6, fontSize: 14, opacity: 0.85 }}>
        Max per day: <strong>{maxCount}</strong>
      </div>

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
        <strong>Squats:</strong> {count}/{maxCount} | <strong>Status:</strong> {status}
      </div>

      <button onClick={handleManualReset} className="squat-reset-btn">
        Reset Today
      </button>
    </div>
  );
}
