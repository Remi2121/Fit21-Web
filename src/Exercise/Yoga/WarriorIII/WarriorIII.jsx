/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import "./WarriorIII.css";

// reference image
import warriorImg from "../../../assets/warrior3-ref.png";

// Mediapipe
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

export default function WarriorIII({ holdMs = 2000, badResetMs = 3000 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);

  // UI state
  const [status, setStatus] = useState("loading…");
  const [sideUsed, setSideUsed] = useState("—");
  const [poseGood, setPoseGood] = useState(false); // 🔴 / 🟢 glow control
  const [showDone, setShowDone] = useState(false);

  const greenSinceRef = useRef(null);
  const badSinceRef = useRef(null);
  const stoppedRef = useRef(false);

  const [, force] = useState(0); // timer UI repaint
  const lastTsRef = useRef(0);
  const loopStartedRef = useRef(false);

  // anti-flicker buffer
  const passBuf = useRef(Array(8).fill(false));
  const passIdx = useRef(0);

  const angleDeg = (a, b, c) => {
    const abx = a.x - b.x,
      aby = a.y - b.y;
    const cbx = c.x - b.x,
      cby = c.y - b.y;
    const dot = abx * cbx + aby * cby;
    const mag1 = Math.hypot(abx, aby);
    const mag2 = Math.hypot(cbx, cby);
    const cos = Math.min(1, Math.max(-1, dot / ((mag1 * mag2) || 1)));
    return (Math.acos(cos) * 180) / Math.PI;
  };

  const distPx = (p, q, W, H) =>
    Math.hypot((p.x - q.x) * W, (p.y - q.y) * H);

  const chooseSide = (lm, W, H) => {
    const vis = (i) => lm[i]?.visibility ?? 1;
    const vsL =
      vis(11) + vis(23) + vis(25) + vis(27) + vis(15) + vis(31);
    const vsR =
      vis(12) + vis(24) + vis(26) + vis(28) + vis(16) + vis(32);
    const dL = distPx(lm[15], lm[31], W, H);
    const dR = distPx(lm[16], lm[32], W, H);
    if (Math.abs(vsL - vsR) < 0.5) return dL <= dR ? "left" : "right";
    return vsL > vsR ? "left" : "right";
  };

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

        landmarkerRef.current = await PoseLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          }
        );

        setStatus("camera ready");
      } catch (e) {
        console.error(e);
        setStatus("camera error");
      }
    }

    function sizeCanvasAndStart() {
      const v = videoRef.current,
        c = canvasRef.current;
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

      const lm = landmarkerRef.current,
        v = videoRef.current,
        c = canvasRef.current;

      if (!lm || !v || !c) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (ts - lastFrameTs > 80) {
        if (v.readyState >= 2) {
          let nowMs = Math.round(performance.now());
          if (nowMs <= lastTsRef.current) nowMs = lastTsRef.current + 1;
          lastTsRef.current = nowMs;

          lm.detectForVideo(v, nowMs, (results) => {
            draw(results);
            process(results);
          });

          force((x) => x ^ 1);
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

      if (videoRef.current?.readyState >= 2)
        ctx.drawImage(videoRef.current, 0, 0, c.width, c.height);

      if (results.landmarks && results.landmarks[0]) {
        const utils = new DrawingUtils(ctx);
        utils.drawConnectors(
          results.landmarks[0],
          PoseLandmarker.POSE_CONNECTIONS,
          { color: "#333", lineWidth: 2 }
        );
        utils.drawLandmarks(results.landmarks[0], {
          color: "#ff3333",
          radius: 2,
        });
      }

      ctx.restore();
    }

    function process(results) {
      const c = canvasRef.current,
        W = c.width,
        H = c.height;

      if (!results.landmarks || !results.landmarks[0]) {
        setSideUsed("—");
        setPoseGood(false);
        badSinceRef.current = badSinceRef.current ?? performance.now();
        const now = performance.now();
        if (
          greenSinceRef.current &&
          now - (badSinceRef.current || now) > badResetMs
        ) {
          greenSinceRef.current = null;
        }
        setStatus("pose not detected");
        return;
      }

      const lm = results.landmarks[0];
      const side = chooseSide(lm, W, H);
      setSideUsed(side);

      const SH = side === "left" ? lm[11] : lm[12];
      const HIP = side === "left" ? lm[23] : lm[24];
      const KNEE = side === "left" ? lm[25] : lm[26];
      const ANK = side === "left" ? lm[27] : lm[28];
      const WR_FWD = side === "left" ? lm[15] : lm[16]; // front arm
      const ANK_BACK = side === "left" ? lm[28] : lm[27]; // rough back leg

      // --- Simple Warrior III checks (EASY MODE) ---

      // torso roughly horizontal (more lenient)
      const dxTorso = (SH.x - HIP.x) * W;
      const dyTorso = (SH.y - HIP.y) * H;
      const torsoAngle = (Math.atan2(dyTorso, dxTorso) * 180) / Math.PI;
      // before: Math.abs(torsoAngle) < 40
      const torsoHorizontal = Math.abs(torsoAngle) < 55; // allow more tilt

      // standing leg fairly straight (more lenient)
      const kneeAngle = angleDeg(HIP, KNEE, ANK);
      // before: kneeAngle >= 140
      const legStraight = kneeAngle >= 130;

      // back leg lifted (more lenient on height)
      const backLegDy = (ANK_BACK.y - HIP.y) * H;
      // before:
      //   Math.abs(ANK_BACK.y*H - HIP.y*H) < 120 && ANK_BACK.y*H <= HIP.y*H + 60
      // now: just make sure leg is not hanging too low
      const backLegLifted =
        backLegDy < 140 && // ankle not too much below hip
        backLegDy > -220;  // not forcing perfect straight line

      // arms inline with torso (more lenient)
      const dxArm = (WR_FWD.x - SH.x) * W;
      const dyArm = (WR_FWD.y - SH.y) * H;
      const armAngle = (Math.atan2(dyArm, dxArm) * 180) / Math.PI;
      // before: Math.abs(armAngle - torsoAngle) < 25
      const armsInline = Math.abs(armAngle - torsoAngle) < 35;

      const pass =
        torsoHorizontal && legStraight && backLegLifted && armsInline;

      // anti-flicker buffer (more forgiving)
      passBuf.current[passIdx.current] = pass;
      passIdx.current =
        (passIdx.current + 1) % passBuf.current.length;

      const goodFrames = passBuf.current.reduce(
        (a, b) => a + (b ? 1 : 0),
        0
      );
      // before: goodFrames >= 4
      const finalGood = goodFrames >= 3;

      setPoseGood(finalGood);
      setStatus(finalGood ? "holding pose" : "adjust pose");

      const now = performance.now();

      if (finalGood) {
        if (!greenSinceRef.current) greenSinceRef.current = now;
        badSinceRef.current = null;

        if (
          !stoppedRef.current &&
          now - greenSinceRef.current >= holdMs
        ) {
          stoppedRef.current = true;
          setShowDone(true);
          setStatus("completed");

          const v = videoRef.current;
          if (v?.srcObject) {
            v.srcObject.getTracks().forEach((t) => t.stop());
            v.srcObject = null;
          }
          try {
            landmarkerRef.current?.close?.();
          } catch (e) {}
          landmarkerRef.current = null;
        }
      } else {
        if (!badSinceRef.current) badSinceRef.current = now;
        if (
          greenSinceRef.current &&
          now - badSinceRef.current > badResetMs
        ) {
          greenSinceRef.current = null;
        }
      }
    }

    init();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (startLoopTimer) clearTimeout(startLoopTimer);
      loopStartedRef.current = false;
      lastTsRef.current = 0;

      const v = videoRef.current;
      if (v?.srcObject) v.srcObject.getTracks().forEach((t) => t.stop());

      try {
        landmarkerRef.current?.close?.();
      } catch (e) {}
      landmarkerRef.current = null;
    };
  }, [badResetMs, holdMs]);

  const progressSec = greenSinceRef.current
    ? Math.max(
        0,
        (performance.now() - greenSinceRef.current) / 1000
      ).toFixed(1)
    : "0.0";

  return (
    <div className="war3-container">
      <h2 className="stoke-text war3-title">Warrior III — Virabhadrasana C</h2>

      {/* hidden raw video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width={640}
        height={480}
        style={{ position: "absolute", left: "-9999px" }}
      />

      <div className="war3-stage">
        <canvas
          ref={canvasRef}
          className={`war3-canvas ${poseGood ? "good" : "bad"}`} // 🔴 / 🟢
          width={640}
          height={480}
        />

        <div className="war3-ref-plain">
          <span className="war3-tip-plain">
            Stand in a proper side view facing the camera.
          </span>

          <img
            src={warriorImg}
            className="war3-pose-img"
            alt="ref"
            draggable="false"
          />
        </div>
      </div>

      <div className="war3-status">
        <span>Side: {sideUsed}</span>
        <span className="war3-sep" />
        <span>Camera: {status}</span>
        <span className="war3-sep" />
        <span>
          Hold: {progressSec}s / {(holdMs / 1000) | 0}s
        </span>
      </div>

      <p className="war3-note">
        Keep torso roughly horizontal, standing leg fairly straight,
        back leg lifted, arms roughly inline with torso. Small
        variations are OK 👍
      </p>

      {showDone && (
        <div className="war3-done">
          <div className="war3-done-card">
            <h3>Great job! ✅</h3>
            <p>
              You held Warrior III for {(holdMs / 1000) | 0} seconds.
            </p>
            <button
              className="war3-reset"
              onClick={() => window.location.reload()}
            >
              Restart Camera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
