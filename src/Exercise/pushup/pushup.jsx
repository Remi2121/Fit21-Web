/* eslint-disable react-hooks/exhaustive-deps */
import React, { useRef, useEffect, useState } from "react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import "./pushup.css";
import Pushup from "../../assets/pushup.png";

// === Firebase imports ===
import { db } from "../../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export default function PushUpCounter() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("waiting");
  const [userId, setUserId] = useState(null);

  // this ensures we don't immediately write to Firestore while initial load is happening
  const [loaded, setLoaded] = useState(false);

  // store readable last-saved timestamp for UI
  const [lastSaved, setLastSaved] = useState(null);

  // new: lock per-day behaviour (if true, user can't increase count anymore today)
  const [locked, setLocked] = useState(false);

  const exerciseId = "pushup"; // Unique exercise identifier

  // ============================
  // 🔵 Detect current logged-in user
  // ============================
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
      else setUserId(null);
    });
    return () => unsubscribe();
  }, []);

  // ============================
  // 🔵 Load daily points + reset once per day
  // ============================
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    async function loadDailyPoints() {
      try {
        const today = new Date().toISOString().split("T")[0];
        const ref = doc(db, "users", userId, "exercises", exerciseId);
        const snap = await getDoc(ref);

        // First time ever → create record (include timestamps)
        if (!snap.exists()) {
          await setDoc(
            ref,
            {
              date: today,
              points: 0,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          if (!cancelled) {
            setCount(0);
            setLocked(false);
            setLastSaved(null);
            setLoaded(true);
          }
          return;
        }

        const data = snap.data();

        // New day → reset once (keep timestamps)
        if (data.date !== today) {
          await setDoc(
            ref,
            {
              date: today,
              points: 0,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          if (!cancelled) {
            setCount(0);
            setLocked(false);
            setLastSaved(new Date().toLocaleString());
            setLoaded(true);
          }
          return;
        }

        // Same day → load existing
        if (!cancelled)
          setCount(typeof data.points === "number" ? data.points : 0);

        // Lock behaviour: if points > 0 (you've already done some push-ups today),
        // we lock the counter so additional visits won't allow extra increments.
        // Modify this rule if you prefer (e.g. lock only when points >= 10).
        if (!cancelled) {
          const pointsNum = typeof data.points === "number" ? data.points : 0;
          setLocked(pointsNum > 0);
        }

        // read saved timestamp (Firestore Timestamp -> toDate), fallback to updatedAtLocal
        if (!cancelled) {
          if (data.updatedAt && typeof data.updatedAt.toDate === "function") {
            setLastSaved(data.updatedAt.toDate().toLocaleString());
          } else if (data.updatedAtLocal) {
            try {
              setLastSaved(new Date(data.updatedAtLocal).toLocaleString());
            } catch {
              setLastSaved(null);
            }
          } else {
            setLastSaved(null);
          }
          setLoaded(true);
        }
      } catch (err) {
        console.error("Error loading daily points:", err);
        if (!cancelled) {
          setLoaded(true); // allow saves after error so app still works
        }
      }
    }

    loadDailyPoints();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ============================
  // 🔵 Save points whenever count changes (cap at 20)
  // ============================
  useEffect(() => {
    if (!userId) return;
    if (!loaded) return; // IMPORTANT: don't save while initial load hasn't finished

    // If locked, don't overwrite server data on automatic saves.
    // Manual reset explicitly writes even if locked.
    if (locked) {
      return;
    }

    let cancelled = false;
    async function savePoints() {
      try {
        const today = new Date().toISOString().split("T")[0];
        const ref = doc(db, "users", userId, "exercises", exerciseId);

        let pointsToSave = count;
        if (pointsToSave > 20) pointsToSave = 20;

        await setDoc(
          ref,
          {
            date: today,
            points: pointsToSave,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        if (!cancelled) {
          setLastSaved(new Date().toLocaleString());
        }
      } catch (err) {
        console.error("Error saving points:", err);
      }
    }

    savePoints();

    return () => {
      cancelled = true;
    };
  }, [count, userId, loaded, locked]);

  // ============================
  // 🔵 Manual reset button handler (confirm + alert)
  // ============================
  const handleManualReset = async () => {
    if (!userId) return;

    const confirmed = window.confirm(
      "Are you sure? Today's push-up points will be reset to 0."
    );
    if (!confirmed) return;

    try {
      const today = new Date().toISOString().split("T")[0];
      const ref = doc(db, "users", userId, "exercises", exerciseId);
      await setDoc(
        ref,
        {
          date: today,
          points: 0,
          updatedAt: serverTimestamp(),
          updatedAtLocal: new Date().toISOString(),
        },
        { merge: true }
      );
      setCount(0);
      setLocked(false); // unlock after manual reset
      setLastSaved(new Date().toLocaleString());
      window.alert("Today's push-up points reset successfully!");
    } catch (err) {
      console.error("Error resetting points:", err);
      window.alert("Failed to reset points. Please try again.");
    }
  };


  // ============================
  // ⚠️ EXISTING Push-Up Pose Logic (unchanged)
  // ============================
  useEffect(() => {
    let pose;
    let rafId;
    let state = "up"; // track push-up motion
    let shownLockedAlert = false;

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
              if (locked) {
                setStatus("locked");
                // show one alert when locked is first observed
                if (!shownLockedAlert) {
                  window.alert(
                    "You've already completed push-ups today. Come back tomorrow or click 'Reset Today' to try again."
                  );
                  shownLockedAlert = true;
                }
              } else {
                setCount((prev) => (prev < 20 ? prev + 1 : 20)); // cap at 20
              }
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
  }, [locked]);

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
        {locked && (
          <span style={{ marginLeft: 12, color: "#ffcc00" }}>
            • You've already recorded push-ups today please reset to try again.
          </span>
        )}
      
      </div>

      <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
        <em>Last saved:</em> {lastSaved || "—"}
      </div>

      <button 
        onClick={handleManualReset} 
        className="reset-btn"
      >
        Reset Today
      </button>
      
    </div>
  );
}


