/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import "./Crescent-Lunge.css";
import CrescentLungeImg from "../../../assets/Crescent-Lunge.png"; // <-- renamed

/*
  Mediapipe Pose indices (used here):
  Shoulders: L=11 R=12
  Elbows:    L=13 R=14
  Wrists:    L=15 R=16
  Hips:      L=23 R=24
  Knees:     L=25 R=26
  Ankles:    L=27 R=28
  Heels:     L=29 R=30
  Big Toes:  L=31 R=32
*/

export default function CrescentLunge({ holdMs = 30000, badResetMs = 2500 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);

  const [status, setStatus] = useState("loading…");
  const [allGood, setAllGood] = useState(false);
  const [frontSide, setFrontSide] = useState("—"); // "left" or "right"
  const [showDone, setShowDone] = useState(false);

  const passBuf = useRef(Array(8).fill(false));
  const passIdx = useRef(0);

  const greenSinceRef = useRef(null);
  const badSinceRef = useRef(null);
  const stoppedRef = useRef(false);

  const [, force] = useState(0);
  const loopStartedRef = useRef(false);
  const lastTsRef = useRef(0);

  // --- helpers ---
  const angleDeg = (a, b, c) => {
    const abx = a.x - b.x, aby = a.y - b.y;
    const cbx = c.x - b.x, cby = c.y - b.y;
    const dot = abx * cbx + aby * cby;
    const mag1 = Math.hypot(abx, aby);
    const mag2 = Math.hypot(cbx, cby);
    const cos = Math.min(1, Math.max(-1, dot / ((mag1 * mag2) || 1)));
    return (Math.acos(cos) * 180) / Math.PI;
  };

  // choose which leg is front: knee closer to ~90° gets picked
  const pickFrontSide = (lm) => {
    const kL = angleDeg(lm[23], lm[25], lm[27]); // left knee
    const kR = angleDeg(lm[24], lm[26], lm[28]); // right knee
    const dL = Math.abs(kL - 90);
    const dR = Math.abs(kR - 90);
    if (Math.min(dL, dR) > 40) {
      return "left";
    }
    return dL <= dR ? "left" : "right";
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
        startLoopTimer = setTimeout(sizeCanvasAndStart, 700);

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

      const lm = landmarkerRef.current,
            v  = videoRef.current,
            c  = canvasRef.current;

      if (!lm || !v || !c) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      if (ts - lastFrameTs > 33) {
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

      // mirror like a selfie
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
        utils.drawLandmarks(results.landmarks[0], { color: "#ff3333", radius: 2 });
      }

      ctx.restore();
    }

    function process(results) {
      const c = canvasRef.current, W = c.width, H = c.height;

      if (!results.landmarks || !results.landmarks[0]) {
        setAllGood(false);
        setFrontSide("—");
        badSinceRef.current = badSinceRef.current ?? performance.now();
        const now = performance.now();
        if (greenSinceRef.current && now - (badSinceRef.current || now) > badResetMs) {
          greenSinceRef.current = null;
        }
        return;
      }

      const lm = results.landmarks[0];
      const sideF = pickFrontSide(lm);
      setFrontSide(sideF);
      const sideB = sideF === "left" ? "right" : "left";

      // pick per-side points
      const SH_f = sideF === "left" ? lm[11] : lm[12];
      const HIP_f = sideF === "left" ? lm[23] : lm[24];
      const KNEE_f = sideF === "left" ? lm[25] : lm[26];
      const ANK_f = sideF === "left" ? lm[27] : lm[28];
      const HIP_b = sideB === "left" ? lm[23] : lm[24];
      const KNEE_b = sideB === "left" ? lm[25] : lm[26];
      const ANK_b = sideB === "left" ? lm[27] : lm[28];
      const HEEL_b= sideB === "left" ? lm[29] : lm[30];
      const TOE_b = sideB === "left" ? lm[31] : lm[32];

      // Angles
      const kneeF = angleDeg(HIP_f, KNEE_f, ANK_f); // front knee ~90°
      const kneeB = angleDeg(HIP_b, KNEE_b, ANK_b); // back knee straight
      const elbowL = angleDeg(lm[11], lm[13], lm[15]);
      const elbowR = angleDeg(lm[12], lm[14], lm[16]);

      // 1) Front knee over ankle (~90°) + stacked
      const kneeFrontOK =
        kneeF >= 80 && kneeF <= 110 &&
        Math.abs((KNEE_f.x - ANK_f.x) * W) <= 0.07*W &&
        (KNEE_f.y * H) <= (ANK_f.y * H) - 0.01*H;

      // 2) Back leg straight
      const backStraightOK = kneeB >= 165;

      // 3) Back heel cue (press back/down)
      const heelBehindToeX =
        (sideB === "left")
          ? (HEEL_b.x * W) < (TOE_b.x * W) - 0.02*W
          : (HEEL_b.x * W) > (TOE_b.x * W) + 0.02*W;

      const heelNotTooHighY =
        (HEEL_b.y * H) <= (TOE_b.y * H) + 0.12*H;

      const backHeelCueOK = heelBehindToeX && heelNotTooHighY;

      // 4) Torso upright
      const vxh = (SH_f.x - HIP_f.x) * W, vyh = (SH_f.y - HIP_f.y) * H;
      const mag = Math.hypot(vxh, vyh) || 1;
      const cosToVertical = (-vyh / mag);
      const torsoAngle = Math.acos(Math.min(1, Math.max(-1, cosToVertical))) * 180 / Math.PI;
      const torsoUprightOK = torsoAngle <= 15;

      // 5) Arms straight overhead
      const elbowsStraightOK = elbowL >= 165 && elbowR >= 165;
      const wristsAboveShoulders =
        (lm[15].y * H) <= (lm[11].y * H) - 0.05*H &&
        (lm[16].y * H) <= (lm[12].y * H) - 0.05*H;

      const armsOK = elbowsStraightOK && wristsAboveShoulders;

      const pass =
        kneeFrontOK &&
        backStraightOK &&
        backHeelCueOK &&
        torsoUprightOK &&
        armsOK;

      // anti-flicker voting
      passBuf.current[passIdx.current] = pass;
      passIdx.current = (passIdx.current + 1) % passBuf.current.length;
      const goodFrames = passBuf.current.reduce((a,b)=>a+(b?1:0),0);
      const finalGood = goodFrames >= 5;

      setAllGood(finalGood);

      const now = performance.now();
      if (finalGood) {
        if (!greenSinceRef.current) greenSinceRef.current = now;
        badSinceRef.current = null;
        if (!stoppedRef.current && now - greenSinceRef.current >= holdMs) {
          stoppedRef.current = true;
          setShowDone(true);
          setStatus("completed");
          const v = videoRef.current;
          if (v?.srcObject) {
            v.srcObject.getTracks().forEach(t=>t.stop());
            v.srcObject = null;
          }
        }
      } else {
        if (!badSinceRef.current) badSinceRef.current = now;
        if (greenSinceRef.current && now - badSinceRef.current > badResetMs) {
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
      if (v?.srcObject) v.srcObject.getTracks().forEach(t=>t.stop());
    };
  }, [holdMs, badResetMs]);

  const progressSec = greenSinceRef.current
    ? Math.max(0, ((performance.now() - greenSinceRef.current) / 1000)).toFixed(1)
    : "0.0";

  return (
    <div className="pose-container">
      <h2>Crescent Lunge — Aṣṭa Candrāsana (High Lunge)</h2>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width={640}
        height={480}
        style={{ position: "absolute", left: "-9999px" }}
      />

      <div className="bt-stage">
        <canvas
          ref={canvasRef}
          className={`bt-canvas ${allGood ? "good" : "bad"}`} 
          width={640}
          height={480}
        />

        {/* Right column */}
        <div className="bt-ref-plain">
          <span className="bt-tip-plain">
            For this pose, stand in a proper side view facing the camera.
          </span>
          <img src={CrescentLungeImg} className="bt-pose-img" alt="ref" draggable="false" /> {/* <-- fixed */}
        </div>
      </div>

      <div className="bt-status">
        <span className="bt-label">Side:</span> {frontSide}
        <span className="bt-sep" />

        <span className="bt-label">Camera:</span> {status}
        <span className="bt-sep" />

        <span className="bt-label">Hold:</span> {progressSec}s / {(holdMs/1000)|0}s
      </div>

      <p className="pose-note">
        Rules: front knee stacked over ankle (~90°), back knee straight, back heel presses back/down vs toes, torso upright, arms straight overhead.
      </p>

      {showDone && (
        <div className="pose-done">
          <div className="pose-done-card">
            <h3>Great job! ✅</h3>
            <p>You held Crescent Lunge for {(holdMs/1000)|0} seconds.</p>
            <button className="resetbutton" onClick={() => window.location.reload()}>Restart Camera</button>
          </div>
        </div>
      )}
    </div>
  );
}
