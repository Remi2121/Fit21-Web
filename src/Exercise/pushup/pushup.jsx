/* eslint-disable react-hooks/exhaustive-deps */
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

      {/* 🔵 Manual reset button */}
      <button 
        onClick={handleManualReset} 
        style={{ marginTop: 10, padding: "6px 12px", fontSize: 16 }}
      >
        Reset Today
      </button>
    </div>
  );
}
