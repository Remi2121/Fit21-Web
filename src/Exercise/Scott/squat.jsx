/* eslint-disable react-hooks/exhaustive-deps */
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
