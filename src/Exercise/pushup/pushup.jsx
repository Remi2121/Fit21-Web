/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useState } from "react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import "./pushup.css";
import PushUpImg from "../../assets/pushup.png";

// Firebase imports
import { db } from "../../firebase";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function PushUpCounter() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("waiting");
  const [userId, setUserId] = useState(null);
  const [maxCount, setMaxCount] = useState(20); // default fallback

  // ✅ prevent double-adding to finalScore (store how much already added today)
  const [addedToFinal, setAddedToFinal] = useState(0);

  // ✅ DEBUG: show rule load status on UI
  const [, setRuleDebug] = useState("rule: not loaded");

  // ✅ fix mediapipe double-init (React StrictMode) using refs
  const userIdRef = useRef(null);
  const maxCountRef = useRef(20);

  const exerciseId = "pushup";

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    maxCountRef.current = maxCount;
  }, [maxCount]);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
    });
    return () => unsub();
  }, []);

  // ✅ REALTIME: load maxCount from admin rules (poseRules/pushup)
  useEffect(() => {
    const ruleRef = doc(db, "poseRules", exerciseId);

    const unsub = onSnapshot(
      ruleRef,
      (ruleSnap) => {
        if (!ruleSnap.exists()) {
          setRuleDebug(`rule: NOT FOUND at poseRules/${exerciseId}`);
          console.log("poseRules doc not found:", `poseRules/${exerciseId}`);
          return;
        }

        const ruleData = ruleSnap.data();
        console.log("poseRules loaded:", `poseRules/${exerciseId}`, ruleData);

        // ✅ handle possible field name differences
        const raw =
          ruleData.maximumcount_perday ??
          ruleData["maximumcount perday"] ??
          ruleData.maximumCountPerDay ??
          ruleData.maximumcountPerDay ??
          ruleData.maximumcount_per_day;

        const m = Number(raw);

        if (!Number.isNaN(m) && m > 0) {
          setMaxCount(m);
          setRuleDebug(`rule: loaded ✅ max=${m}`);
        } else {
          setRuleDebug(
            `rule: loaded but max invalid (value=${String(raw)})`
          );
        }
      },
      (err) => {
        console.error("poseRules read error:", err);
        setRuleDebug(`rule: ERROR ❌ ${err?.message || "unknown"}`);
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

      await updateDoc(userRef, {
        finalScore: prevFinal + diff,
      });
    } catch (e) {
      console.error("Failed to update finalScore:", e);
    }
  };

  useEffect(() => {
    if (!userId) return;

    async function loadDailyPoints() {
      const today = new Date().toISOString().split("T")[0];

      // ✅ Option A: per-day doc path
      const dayRef = doc(
        db,
        "users",
        userId,
        "exercises",
        exerciseId,
        "days",
        today
      );
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

  useEffect(() => {
    if (!userId) return;

    async function savePoints() {
      const today = new Date().toISOString().split("T")[0];

      // ✅ Option A: per-day doc path
      const dayRef = doc(
        db,
        "users",
        userId,
        "exercises",
        exerciseId,
        "days",
        today
      );

      await setDoc(
        dayRef,
        {
          date: today,
          points: count > maxCount ? maxCount : count,
          addedToFinal: addedToFinal,
        },
        { merge: true }
      );
    }

    savePoints();
  }, [count, addedToFinal, userId, maxCount]);

  const handleManualReset = async () => {
    if (!userId) return;
    const today = new Date().toISOString().split("T")[0];

    // ✅ Option A: per-day doc path
    const dayRef = doc(
      db,
      "users",
      userId,
      "exercises",
      exerciseId,
      "days",
      today
    );

    // reset today points, BUT don't rollback finalScore (keep addedToFinal as-is)
    await setDoc(dayRef, { date: today, points: 0 }, { merge: true });
    setCount(0);
  };

  // ---------------------------
  // Pose Logic
  // ✅ FIX: init Pose ONLY ONCE ([]) to avoid mediapipe "File exists" error
  // ---------------------------
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

        const headHipDiff = Math.abs((nose.y - (lHip.y + rHip.y) / 2) * canvas.height);
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
          } else if (leftArmAngle < 70 && rightArmAngle < 70) {
            state = "down";
            setStatus("down");
          }
        }

        ctx.fillStyle = "white";
        ctx.font = "16px Arial";
        ctx.fillText(`Left Arm: ${Math.round(leftArmAngle)}°`, 10, 20);
        ctx.fillText(`Right Arm: ${Math.round(rightArmAngle)}°`, 10, 40);
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
    <div className="pushup-container">
      <h2 className="stoke-text"> Push-Up Counter</h2>

      <div style={{ marginTop: 6, fontSize: 14, opacity: 0.85 }}>
        Max per day: <strong>{maxCount}</strong>
      </div>


      <video ref={videoRef} style={{ display: "none" }} width={640} height={480} />

      <div className="pushup-stage">
        <canvas ref={canvasRef} width={640} height={480} />
        <div className="pushup-plain">
          <span className="pushup-tip-plain">
            Keep your body straight and face sideways to the camera.
          </span>
          <img src={PushUpImg} className="pushup-pose-img" alt="ref" draggable="false" />
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 18 }}>
        <strong>Push-ups:</strong> {count}/{maxCount} | <strong>Status:</strong> {status}
      </div>

      <button onClick={handleManualReset} className="pushup-reset-btn">
        Reset Today
      </button>
    </div>
  );
}
