/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import "./Big-Toe.css";
import Bigtoeimg from "../../../assets/Bigtoeimg.png";

import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

/* Landmark IDs:
   Left: 11 Sh, 23 Hip, 25 Knee, 27 Ankle, 15 Wrist, 31 BigToe
   Right:12 Sh, 24 Hip, 26 Knee, 28 Ankle, 16 Wrist, 32 BigToe
*/

export default function BigToe() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);

  const [status, setStatus] = useState("loading…");
  const [allGoodState, setAllGoodState] = useState(false);
  const [sideUsed, setSideUsed] = useState("—");

  // popup + stopping
  const [showDone, setShowDone] = useState(false);
  const greenSinceRef = useRef(null);
  const stoppedRef = useRef(false);

  // graph timestamp guard
  const lastTsRef = useRef(0);
  const loopStartedRef = useRef(false);

  // anti-flicker buffer
  const passBuf = useRef(Array(8).fill(false));
  const passIdx = useRef(0);

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
    const vis = i => (lm[i]?.visibility ?? 1);
    const vsL = vis(11)+vis(23)+vis(25)+vis(27)+vis(15)+vis(31);
    const vsR = vis(12)+vis(24)+vis(26)+vis(28)+vis(16)+vis(32);
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

      if (!lm || !v || !c) return;

      if (ts - lastFrameTs > 33) {
        if (v.readyState >= 2) {
          let nowMs = Math.round(performance.now());
          if (nowMs <= lastTsRef.current) nowMs = lastTsRef.current + 1;
          lastTsRef.current = nowMs;

          lm.detectForVideo(v, nowMs, (results) => {
            draw(results);
            process(results);
          });
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
        utils.drawLandmarks(
          results.landmarks[0],
          { color: "#ff3333", radius: 2 }
        );
      }

      ctx.restore();
    }

    function process(results) {
      const c = canvasRef.current,
            W = c.width,
            H = c.height;

      if (!results.landmarks || !results.landmarks[0]) {
        setAllGoodState(false);
        setSideUsed("—");
        greenSinceRef.current = null;
        return;
      }

      const lm = results.landmarks[0];

      const side = chooseSide(lm, W, H);
      setSideUsed(side);

      const SH  = side==="left"?lm[11]:lm[12];
      const HIP = side==="left"?lm[23]:lm[24];
      const KNEE= side==="left"?lm[25]:lm[26];
      const ANK = side==="left"?lm[27]:lm[28];
      const WR  = side==="left"?lm[15]:lm[16];
      const TOE = side==="left"?lm[31]:lm[32];

      const hipAngle  = angleDeg(SH, HIP, KNEE);
      const kneeAngle = angleDeg(HIP, KNEE, ANK);
      const legLen    = distPx(HIP, ANK, W, H) || 1;

      const dToe  = distPx(WR, TOE, W, H);
      const dAnk  = distPx(WR, ANK, W, H);

      const torsoFoldOK   = hipAngle <= 80;
      const legStraightOK = kneeAngle >= 165;
      const toeOK =
        dToe <= 0.40 * legLen ||
        dAnk <= 0.35 * legLen ||
        (Math.abs((WR.x - TOE.x)*W) <= 0.08*W &&
         WR.y*H >= TOE.y*H - 0.06*H);

      const pass = torsoFoldOK && legStraightOK && toeOK;

      passBuf.current[passIdx.current] = pass;
      passIdx.current = (passIdx.current+1) % passBuf.current.length;

      const goodFrames = passBuf.current.reduce((a,b)=>a+(b?1:0),0);
      const finalGood = goodFrames >= 6;

      setAllGoodState(finalGood);

      const now = performance.now();
      if (finalGood) {
        if (!greenSinceRef.current) greenSinceRef.current = now;

        if (!stoppedRef.current && now - greenSinceRef.current >= 60000) {
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
        greenSinceRef.current = null;
      }
    }

    init();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (startLoopTimer) clearTimeout(startLoopTimer);
      loopStartedRef.current = false;
      lastTsRef.current = 0;

      const v = videoRef.current;
      if (v?.srcObject)
        v.srcObject.getTracks().forEach(t=>t.stop());
    };
  }, []);

  return (
    <div className="bt-container">
      <h2>Big Toe Pose – Padangushthasana</h2>

      {/* hidden video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width={640}
        height={480}
        style={{ position: "absolute", left:"-9999px" }}
      />

      <div className="bt-stage">
        <canvas
          ref={canvasRef}
          className={`bt-canvas ${allGoodState ? "good" : "bad"}`}
          width={640}
          height={480}
        />
        <img src={Bigtoeimg} className="bt-pose-img" alt="ref" draggable="false" />
      </div>

      {/* ✅ status USED here (Option-1 fix) */}
      <div className="bt-status">
        <span className="bt-label">AI Status:</span> {allGoodState ? "good (green)" : "adjust posture"}
        <span className="bt-sep" />
        <span className="bt-label">Side:</span> {sideUsed}
        <span className="bt-sep" />
        <span className="bt-label">Camera:</span> {status}
      </div>

      <p className="bt-note">
        Side view only: hip ≤ 80°, knee ≥ 165°, wrist near big toe.
      </p>

      {/* SUCCESS POPUP */}
      {showDone && (
        <div className="bt-done">
          <div className="bt-done-card">
            <h3>Great job! ✅</h3>
            <p>You held the pose for 60 second.</p>
            <button className="resetbutton"onClick={() => window.location.reload()}>
              Restart Camera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
