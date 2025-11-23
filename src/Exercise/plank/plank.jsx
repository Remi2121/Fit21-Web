/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useState } from "react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import "./plank.css";
import Plankexercise from "../../assets/plank.png";

// Firebase
import { db } from "../../firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  increment,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function PlankTimerOptimized() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // UI states
  const [status, setStatus] = useState("waiting");
  const [time, setTime] = useState(0);
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState(null);
  const [alreadyDone, setAlreadyDone] = useState(false);

  // Admin config
  const [targetSeconds, setTargetSeconds] = useState(60);
  const [maxPoints, setMaxPoints] = useState(10);

  const [msg, setMsg] = useState("");

  const holdingRef = useRef(false);
  const startTimeRef = useRef(null);

  const plankRef = doc(db, "poseRules", "plank");

  // Auth
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
    });
  }, []);

  // Load admin rules (Seconds + maxPoints)
  useEffect(() => {
    const unsub = onSnapshot(plankRef, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (typeof d.Seconds === "number") setTargetSeconds(d.Seconds);
      if (typeof d.maxPoints === "number") setMaxPoints(d.maxPoints);
    });
    return () => unsub();
  }, []);

  // Check if user already completed plank today
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const dayRef = doc(db, "users", userId, "exercises", "plank", "days", today);
      const daySnap = await getDoc(dayRef);
      if (daySnap.exists()) {
        setAlreadyDone(true);
        setMsg("Already finished today's plank 🏁 Try again tomorrow!");
      } else {
        setAlreadyDone(false);
      }
    })();
  }, [userId]);

  // Save result when success
  async function savePlankResult(points) {
    if (!userId) return;
    try {
      const today = new Date().toISOString().split("T")[0];
      const dayRef = doc(db, "users", userId, "exercises", "plank", "days", today);
      const daySnap = await getDoc(dayRef);
      if (daySnap.exists()) return; // 🔥 already done today

      // 1️⃣ Save today's record
      await setDoc(dayRef, {
        date: today,
        secondsHeld: targetSeconds,
        points,
        savedAt: serverTimestamp(),
      });

      // 2️⃣ Update user's total finalScore atomically
      const userRef = doc(db, "users", userId);
      await setDoc(
        userRef,
        {
          finalScore: increment(points),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMsg("✅ Plank completed and saved!");
    } catch (err) {
      console.error("Save plank error:", err);
      setMsg("❌ Failed to save plank result.");
    }
  }

  useEffect(() => {
    if (alreadyDone) return; // ✅ Don’t even start camera if finished today
    let pose;
    let rafId;

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
        const lKnee = results.poseLandmarks[25];
        const rKnee = results.poseLandmarks[26];

        const leftArmAngle = calculateAngle(lShoulder, lElbow, lWrist);
        const rightArmAngle = calculateAngle(rShoulder, rElbow, rWrist);
        const bodyAngleLeft = calculateAngle(lShoulder, lHip, lKnee);
        const bodyAngleRight = calculateAngle(rShoulder, rHip, rKnee);

        const headHipDiff = Math.abs(
          (nose.y - (lHip.y + rHip.y) / 2) * canvas.height
        );
        const validPosition = headHipDiff < 60;

        const goodPlank =
          validPosition &&
          leftArmAngle > 70 &&
          leftArmAngle < 110 &&
          rightArmAngle > 70 &&
          rightArmAngle < 110 &&
          bodyAngleLeft > 160 &&
          bodyAngleRight > 160;

        const now = Date.now();

        if (goodPlank && !success) {
          if (!holdingRef.current) {
            holdingRef.current = true;
            startTimeRef.current = now;
            setStatus("holding");
          }

          const elapsed = (now - startTimeRef.current) / 1000;
          setTime(elapsed.toFixed(1));

          if (elapsed >= targetSeconds) {
            setSuccess(true);
            setStatus(`✅ Success! ${targetSeconds}s completed!`);
            savePlankResult(maxPoints);
            if (pose) pose.close();
          }
        } else {
          if (holdingRef.current && !success) {
            holdingRef.current = false;
            startTimeRef.current = null;
            setTime(0);
            setStatus("incorrect form — timer reset ⏱️");
          }
        }

        ctx.fillStyle = "white";
        ctx.font = "16px Arial";
        ctx.fillText(`Head-Hip Diff: ${headHipDiff.toFixed(1)} px`, 10, 25);
      } else {
        setStatus("waiting");
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
  }, [success, targetSeconds, alreadyDone]);

  return (
    <div className="plank-container">
      <h2 className="stoke-text">Perfect Plank Challenge</h2>

      {alreadyDone ? (
        <div className="plank-finished">
          <h3>🏁 You’ve already completed the plank for today!</h3>
          <p>Come back tomorrow for another challenge 💪</p>
        </div>
      ) : (
        <>
          <video ref={videoRef} style={{ display: "none" }} width={640} height={480} />

          <div className="plank-stage">
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              style={{ border: "2px solid #444", borderRadius: "8px" }}
            />

            <div className="plank-plain">
              <span className="plank-tip-plain">
                Maintain a proper side view facing the camera for accurate tracking.
              </span>
              <img
                src={Plankexercise}
                className="plank-pose-img"
                alt="ref"
                draggable="false"
              />
            </div>
          </div>

          <h3>Status: {status}</h3>
          <h3>
            Time: {time}s / {targetSeconds}s
          </h3>
          {success && (
            <h2 style={{ color: "lime" }}>
              🎉 Great job! You held the plank successfully!
            </h2>
          )}
        </>
      )}

      {msg && <div style={{ color: "yellow", marginTop: 12 }}>{msg}</div>}
    </div>
  );
}




/*
import React, { useRef, useEffect, useState } from 'react';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import './plank.css'
import Plankexercise from "../../assets/plank.png"

export default function PlankTimerOptimized() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [Plank, setPlank] = useState("waiting");
  const [time, setTime] = useState(0);
  const [success, setSuccess] = useState(false);

  const holdingRef = useRef(false);
  const startTimeRef = useRef(null);

  useEffect(() => {
    let pose;
    let rafId;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      } catch (e) {
        console.error('Camera error', e);
        setPlank('camera error');
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
        if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
          await pose.send({ image: videoRef.current });
        }
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
      const ctx = canvas.getContext('2d');
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
        const lKnee = results.poseLandmarks[25];
        const rKnee = results.poseLandmarks[26];

        const leftArmAngle = calculateAngle(lShoulder, lElbow, lWrist);
        const rightArmAngle = calculateAngle(rShoulder, rElbow, rWrist);
        const bodyAngleLeft = calculateAngle(lShoulder, lHip, lKnee);
        const bodyAngleRight = calculateAngle(rShoulder, rHip, rKnee);

        const headHipDiff = Math.abs((nose.y - ((lHip.y + rHip.y) / 2)) * canvas.height);
        const validPosition = headHipDiff < 50;

        const goodPlank =
          validPosition &&
          leftArmAngle > 70 && leftArmAngle < 110 &&
          rightArmAngle > 70 && rightArmAngle < 110 &&
          bodyAngleLeft > 160 && bodyAngleRight > 160;

        const now = Date.now();

        if (goodPlank && !success) {
          if (!holdingRef.current) {
            holdingRef.current = true;
            startTimeRef.current = now;
            setPlank("holding");
          }

          const elapsed = (now - startTimeRef.current) / 1000;
          setTime(elapsed.toFixed(1));

          if (elapsed >= 5) { // 1 minute plank
            setSuccess(true);
            setPlank("✅ Success! 1 minute completed!");
            if (pose) pose.close();
          }
        } else {
          if (holdingRef.current) {
            holdingRef.current = false;
            startTimeRef.current = null;
            setTime(0);
            if (!success) setPlank("incorrect form — timer reset ⏱️");
          }
        }

        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText(`Head-Hip Diff: ${headHipDiff.toFixed(1)} px`, 10, 25);
      } else {
        setPlank("waiting");
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
  }, [success]);

  return (
    <div className="plank-container">
      <h2 className="stoke-text">Perfect Plank Challenge 1</h2>
      <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} />

        <div className="plank-stage">
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{ border: '2px solid #444', borderRadius: '8px' }}
      />

     <div className="plank-plain">
          <span className="plank-tip-plain">
            For this pose, stand in a proper side view facing the camera.
          </span>
          <img src={Plankexercise} className="plank-pose-img" alt="ref" draggable="false" />
        </div>

      </div>
      <h3>Status: {Plank}</h3>
      <h3>Time: {time}s</h3>
      {success && (
        <h2 style={{ color: 'lime' }}>🎉 Great job! You held the plank for 1 minute! 🎉</h2>
      )}
    </div>
  );
}
  */