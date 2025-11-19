/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import "./BridgePose.css";
import BridgeImg from "../../../assets/Bridge.png";

import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

// Firestore imports (adjust path if your firebase export differs)
import { db } from "../../../firebase";
import { doc, onSnapshot } from "firebase/firestore";

/*
Landmarks used:
  Shoulder: 11 / 12
  Hip:      23 / 24
  Knee:     25 / 26
  Ankle:    27 / 28
  Wrist:    15 / 16
  Foot indices / heels: 29..32 maybe used for toes/heels
*/

export default function BridgePose({
  defaultHoldMs = 20000,    // default hold time (ms)
  badResetMs = 1500,       // how long "bad" must last before resetting green timer
  defaultHipLimit = 140,   // hip extension threshold (deg)
  defaultKneeLimit = 165,  // knee straight threshold (deg)
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);

  const [status, setStatus] = useState("loading…");
  const [allGoodState, setAllGoodState] = useState(false);
  const allGoodRef = useRef(false); // immediate mirror used for drawing
  const [sideUsed, setSideUsed] = useState("—");
  const [showDone, setShowDone] = useState(false);

  // config from Firestore (live)
  const [config, setConfig] = useState({
    hipAngleLimit: defaultHipLimit,
    kneeAngleLimit: defaultKneeLimit,
    holdMs: defaultHoldMs,
  });
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);

  // timer + state
  const greenSinceRef = useRef(null);
  const badSinceRef = useRef(null);
  const stoppedRef = useRef(false);

  // UI repaint trigger for timer text
  const [, force] = useState(0);

  // anti-flicker
  const passBuf = useRef(Array(8).fill(false));
  const passIdx = useRef(0);

  const lastTsRef = useRef(0);
  const loopStartedRef = useRef(false);

  // helpers
  const angleDeg = (a, b, c) => {
    const abx = a.x - b.x, aby = a.y - b.y;
    const cbx = c.x - b.x, cby = c.y - b.y;
    const dot = abx * cbx + aby * cby;
    const mag1 = Math.hypot(abx, aby);
    const mag2 = Math.hypot(cbx, cby);
    const cos = Math.min(1, Math.max(-1, dot / ((mag1 * mag2) || 1)));
    return (Math.acos(cos) * 180) / Math.PI;
  };

  const distPx = (p, q, W, H) =>
    Math.hypot((p.x - q.x) * W, (p.y - q.y) * H);

  const chooseSide = (lm, W, H) => {
    const vis = i => (lm[i]?.visibility ?? 0);
    const vsL = vis(11) + vis(23) + vis(25) + vis(27) + vis(15) + (lm[31] ? vis(31) : 0);
    const vsR = vis(12) + vis(24) + vis(26) + vis(28) + vis(16) + (lm[32] ? vis(32) : 0);
    const dL = (lm[15] && lm[31]) ? distPx(lm[15], lm[31], W, H) : Infinity;
    const dR = (lm[16] && lm[32]) ? distPx(lm[16], lm[32], W, H) : Infinity;

    if (Math.abs(vsL - vsR) < 0.5) return dL <= dR ? "left" : "right";
    return vsL > vsR ? "left" : "right";
  };

  // Firestore live config: collection 'poseRules' doc 'bridge'
  useEffect(() => {
    const ref = doc(db, "poseRules", "bridge");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const hipVal = typeof data.hipAngleLimit === "number" ? data.hipAngleLimit
          : (typeof data.hipAngleLimit === "string" ? Number(data.hipAngleLimit) : undefined);
        const kneeVal = typeof data.kneeAngleLimit === "number" ? data.kneeAngleLimit
          : (typeof data.kneeAngleLimit === "string" ? Number(data.kneeAngleLimit) : undefined);
        const holdVal = typeof data.holdMs === "number" ? data.holdMs
          : (typeof data.holdMs === "string" ? Number(data.holdMs) : undefined);

        setConfig(prev => ({
          hipAngleLimit: Number.isFinite(hipVal) ? hipVal : prev.hipAngleLimit,
          kneeAngleLimit: Number.isFinite(kneeVal) ? kneeVal : prev.kneeAngleLimit ?? prev.kneeAngleLimit,
          holdMs: Number.isFinite(holdVal) ? holdVal : prev.holdMs,
        }));
        console.log("Loaded bridge config:", { hipVal, kneeVal, holdVal });
      } else {
        console.log("poseRules/bridge not present — using defaults");
      }
    }, err => console.error("Firestore listen error (bridge):", err));

    return () => unsub();
  }, []);

  useEffect(() => {
    let rafId;
    let startLoopTimer;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});

        videoRef.current.onloadedmetadata = sizeCanvasAndStart;
        videoRef.current.oncanplay = sizeCanvasAndStart;
        startLoopTimer = setTimeout(sizeCanvasAndStart, 800);

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.1/wasm"
        );

        landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });

        setStatus("camera ready");
      } catch (e) {
        console.error(e);
        setStatus("camera error");
      }
    }

    function sizeCanvasAndStart() {
      const v = videoRef.current, c = canvasRef.current;
      if (!v || !c) return;
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 480;
      if (!loopStartedRef.current) {
        loopStartedRef.current = true;
        requestAnimationFrame(loop);
      }
    }

    let lastFrameTs = 0;
    const loop = (ts) => {
      if (stoppedRef.current) return;
      const lm = landmarkerRef.current, v = videoRef.current, c = canvasRef.current;
      if (!lm || !v || !c) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (ts - lastFrameTs > 33) {
        if (v.readyState >= 2) {
          let nowMs = Math.round(performance.now());
          if (nowMs <= lastTsRef.current) nowMs = lastTsRef.current + 1;
          lastTsRef.current = nowMs;

          // detect -> process first so draw reads immediate ref
          lm.detectForVideo(v, nowMs, (results) => {
            process(results);
            draw(results);
          });

          force(x => x ^ 1);
        }
        lastFrameTs = ts;
      }
      rafId = requestAnimationFrame(loop);
    };

    function draw(results) {
      const c = canvasRef.current;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);

      ctx.save();
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);

      if (videoRef.current?.readyState >= 2) {
        ctx.drawImage(videoRef.current, 0, 0, c.width, c.height);
      }

      if (results.landmarks && results.landmarks[0]) {
        const isGood = !!allGoodRef.current;
        const connectorColor = isGood ? "#11ff44" : "#f04d4d";
        const landmarkColor = isGood ? "#11ff44" : "#ff3333";

        const utils = new DrawingUtils(ctx);
        utils.drawConnectors(results.landmarks[0], PoseLandmarker.POSE_CONNECTIONS, {
          color: connectorColor, lineWidth: 2
        });
        utils.drawLandmarks(results.landmarks[0], { color: landmarkColor, radius: 2 });
      }

      ctx.restore();
    }

    function process(results) {
      const c = canvasRef.current, W = c.width, H = c.height;

      if (!results.landmarks || !results.landmarks[0]) {
        setAllGoodState(false); allGoodRef.current = false;
        setSideUsed("—");
        badSinceRef.current = badSinceRef.current ?? performance.now();
        const now = performance.now();
        if (greenSinceRef.current && now - (badSinceRef.current || now) > badResetMs) greenSinceRef.current = null;
        return;
      }

      const lm = results.landmarks[0];
      const side = chooseSide(lm, W, H);
      setSideUsed(side);

      const SH = side === "left" ? lm[11] : lm[12];
      const HIP = side === "left" ? lm[23] : lm[24];
      const KNEE = side === "left" ? lm[25] : lm[26];
      const ANK = side === "left" ? lm[27] : lm[28];
      const WR = side === "left" ? lm[15] : lm[16];

      const hipAngle = angleDeg(SH, HIP, KNEE); // extension
      const kneeAngle = angleDeg(HIP, KNEE, ANK);
      const legLen = distPx(HIP, ANK, W, H) || 1;

      // wrist distance to hip (hands should be tucked under body)
      const dWristHip = WR && HIP ? distPx(WR, HIP, W, H) : Infinity;

      // toes-up check using foot index / heel if available
      const footIndex = side === "left" ? (lm[31] || lm[29]) : (lm[32] || lm[30]);
      const heel = side === "left" ? (lm[29] || lm[31]) : (lm[30] || lm[32]);
      const toesUpOK = (footIndex && heel) ? ((footIndex.y * H) <= (heel.y * H) - 0.02 * H) : true; // permissive fallback true

      const hipLimit = configRef.current?.hipAngleLimit ?? defaultHipLimit;
      const kneeLimit = configRef.current?.kneeAngleLimit ?? defaultKneeLimit;
      const holdMsCurrent = configRef.current?.holdMs ?? defaultHoldMs;

      const hipLiftOK = hipAngle >= hipLimit;
      const legStraightOK = kneeAngle >= kneeLimit;
      const wristNearHipOK = dWristHip <= 0.24 * legLen; // tuned constant
      const pass = hipLiftOK && legStraightOK && wristNearHipOK && toesUpOK;

      passBuf.current[passIdx.current] = pass;
      passIdx.current = (passIdx.current + 1) % passBuf.current.length;
      const goodFrames = passBuf.current.reduce((a,b)=>a+(b?1:0),0);
      const finalGood = goodFrames >= 4; // 4/8

      // update immediate-ref first so draw() can use it in same frame
      allGoodRef.current = finalGood;
      setAllGoodState(finalGood);

      const now = performance.now();

      if (finalGood) {
        if (!greenSinceRef.current) greenSinceRef.current = now;
        badSinceRef.current = null;

        if (!stoppedRef.current && now - greenSinceRef.current >= holdMsCurrent) {
          stoppedRef.current = true;
          setShowDone(true);
          setStatus("completed");

          const v = videoRef.current;
          if (v?.srcObject) {
            v.srcObject.getTracks().forEach(t => t.stop());
            v.srcObject = null;
          }

          try { landmarkerRef.current?.close?.(); } catch(e) {}
          landmarkerRef.current = null;
        }
      } else {
        if (!badSinceRef.current) badSinceRef.current = now;
        if (greenSinceRef.current && now - badSinceRef.current > badResetMs) greenSinceRef.current = null;
      }
    }

    init();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (startLoopTimer) clearTimeout(startLoopTimer);
      loopStartedRef.current = false;
      lastTsRef.current = 0;

      const v = videoRef.current;
      if (v?.srcObject) v.srcObject.getTracks().forEach(t => t.stop());
      try { landmarkerRef.current?.close?.(); } catch(e) {}
      landmarkerRef.current = null;
    };
  }, [badResetMs, defaultHipLimit, defaultKneeLimit, defaultHoldMs]);

  const progressSec = greenSinceRef.current
    ? Math.max(0, ((performance.now() - greenSinceRef.current) / 1000)).toFixed(1)
    : "0.0";

  return (
    <div className="bridge-container">
      <h2 className="stoke-text boe">Bridge Pose — Setu Bandha Sarvāṅgāsana</h2>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width={640}
        height={480}
        style={{ position: "absolute", left: "-9999px" }}
      />

      <div className="bridge-stage">
        <canvas
          ref={canvasRef}
          className={`bridge-canvas ${allGoodState ? "good" : "bad"}`}
          width={640}
          height={480}
        />

        <div className="bridge-right">
          <span className="bridge-tip">For this pose, stand in a proper side view facing the camera.</span>
          <img src={BridgeImg} alt="bridge reference" className="bridge-img" draggable="false" />
        </div>
      </div>

      <div className="bridge-status">
        <span className="label">Side:</span> {sideUsed}
        <span className="sep" />
        <span className="label">Camera:</span> {status}
        <span className="sep" />
        <span className="label">Hold:</span> {progressSec}s / {((configRef.current?.holdMs ?? defaultHoldMs)/1000)|0}s
      </div>

      <p className="bridge-note">
        Rules: hip ≥ {configRef.current?.hipAngleLimit ?? defaultHipLimit}°, knee ≥ {configRef.current?.kneeAngleLimit ?? defaultKneeLimit}°, wrists near hips, toes active.
      </p>

      {showDone && (
        <div className="bridge-done">
          <div className="bridge-done-card">
            <h3>Nice — Bridge held ✅</h3>
            <p>You held the pose for {(((configRef.current?.holdMs ?? defaultHoldMs))/1000)|0} seconds.</p>
            <button className="resetbutton" onClick={() => window.location.reload()}>Restart</button>
          </div>
        </div>
      )}
    </div>
  );
}
