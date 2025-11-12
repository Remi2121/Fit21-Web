/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import "./BridgePose.css";
import Bridge from "../../../assets/Bridge.png"

export default function BridgePose({ holdMs = 20000, badResetMs = 2500 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const drawingUtilsRef = useRef(null);

  const [status, setStatus] = useState("loading…");
  const [allGoodState, setAllGoodState] = useState(false);
  const [sideUsed, setSideUsed] = useState("—");
  const [showDone, setShowDone] = useState(false);

  const greenSinceRef = useRef(null);
  const badSinceRef = useRef(null);
  const stoppedRef = useRef(false);

  const passBuf = useRef(Array(8).fill(false));
  const passIdx = useRef(0);
  const lastTsRef = useRef(0);
  const loopStartedRef = useRef(false);

  // Utility functions
  const angleDeg = (a, b, c) => {
    const abx = a.x - b.x, aby = a.y - b.y;
    const cbx = c.x - b.x, cby = c.y - b.y;
    const dot = abx * cbx + aby * cby;
    const mag1 = Math.hypot(abx, aby);
    const mag2 = Math.hypot(cbx, cby);
    const cos = Math.min(1, Math.max(-1, dot / ((mag1 * mag2) || 1)));
    return (Math.acos(cos) * 180) / Math.PI;
  };

  const distPx = (p, q, W, H) => Math.hypot((p.x - q.x) * W, (p.y - q.y) * H);

  const chooseSide = (lm, W, H) => {
    const vis = (i) => lm[i]?.visibility ?? 1;
    const vsL = vis(11) + vis(23) + vis(25) + vis(27) + vis(15) + vis(31);
    const vsR = vis(12) + vis(24) + vis(26) + vis(28) + vis(16) + vis(32);
    const dL = distPx(lm[15], lm[31], W, H);
    const dR = distPx(lm[16], lm[32], W, H);
    if (Math.abs(vsL - vsR) < 0.5) return dL <= dR ? "left" : "right";
    return vsL > vsR ? "left" : "right";
  };

  useEffect(() => {
    let rafId, startLoopTimer;

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
      if (videoRef.current?.readyState >= 2) ctx.drawImage(videoRef.current, 0, 0, c.width, c.height);
      if (results.landmarks && results.landmarks[0]) {
        if (!drawingUtilsRef.current) drawingUtilsRef.current = new DrawingUtils(ctx);
        const utils = drawingUtilsRef.current;
        if (utils.setContext) utils.setContext(ctx);
        utils.drawConnectors(results.landmarks[0], PoseLandmarker.POSE_CONNECTIONS, { color: "#333", lineWidth: 2 });
        utils.drawLandmarks(results.landmarks[0], { color: "#ff3333", radius: 2 });
      }
      ctx.restore();
    }

    function process(results) {
      const c = canvasRef.current, W = c.width, H = c.height;
      if (!results.landmarks || !results.landmarks[0]) {
        setAllGoodState(false);
        setSideUsed("—");
        badSinceRef.current = badSinceRef.current ?? performance.now();
        const now = performance.now();
        if (greenSinceRef.current && now - (badSinceRef.current || now) > badResetMs) {
          greenSinceRef.current = null;
        }
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

      const bodyH = Math.abs((SH.y - ANK.y) * H) || 1;
      const hipLiftOK = (SH.y - HIP.y) * H > Math.max(0.10 * bodyH, 30);
      const thighParallelOK = Math.abs((HIP.y - KNEE.y) * H) < Math.max(0.12 * bodyH, 20);
      const kneeAngle = angleDeg(HIP, KNEE, ANK);
      const kneeAngleOK = kneeAngle > 70 && kneeAngle < 110;
      const legLen = Math.max(distPx(HIP, ANK, W, H), 1);
      const wrDist = distPx(WR, HIP, W, H);
      const wristSupportOK = wrDist < 0.45 * legLen;

      const pass = hipLiftOK && thighParallelOK && kneeAngleOK && wristSupportOK;
      passBuf.current[passIdx.current] = pass;
      passIdx.current = (passIdx.current + 1) % passBuf.current.length;
      const goodFrames = passBuf.current.reduce((a, b) => a + (b ? 1 : 0), 0);
      const finalGood = goodFrames >= 4;
      setAllGoodState(finalGood);

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
            v.srcObject.getTracks().forEach((t) => t.stop());
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
      if (v?.srcObject) v.srcObject.getTracks().forEach((t) => t.stop());
      try {
        if (landmarkerRef.current?.close) landmarkerRef.current.close();
        else if (landmarkerRef.current?.dispose) landmarkerRef.current.dispose();
      } catch (e) {
        console.warn("Error closing landmarker:", e);
      }
    };
  }, [holdMs, badResetMs]);

  const restart = async () => {
    stoppedRef.current = false;
    setShowDone(false);
    setStatus("restarting…");
    greenSinceRef.current = null;
    badSinceRef.current = null;
    const v = videoRef.current;
    if (v?.srcObject) v.srcObject.getTracks().forEach((t) => t.stop());
    try {
      if (landmarkerRef.current?.close) landmarkerRef.current.close();
    } catch (e) {}
    setTimeout(() => {
      setStatus("loading…");
      navigator.mediaDevices
        .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } })
        .then((stream) => {
          if (!videoRef.current) return;
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setStatus("camera ready");
        })
        .catch((e) => {
          console.warn(e);
          setStatus("camera error");
        });
    }, 350);
  };

  const progressSec = greenSinceRef.current
    ? Math.max(0, ((performance.now() - greenSinceRef.current) / 1000)).toFixed(1)
    : "0.0";

  return (
    <div className="bp-container">
      <h2>Bridge — Setu Bandha Sarvāṅgāsana (Bridge)</h2>

      <video ref={videoRef} autoPlay playsInline muted width={640} height={480} style={{ position: "absolute", left: "-9999px" }} />

      <div className="bp-stage">
        <canvas ref={canvasRef} className={`bp-canvas ${allGoodState ? "good" : "bad"}`} width={640} height={480} />
        <div className="bp-ref">
          <div className="bp-tip">Side view: lie on your back with feet rooted, lift hips</div>
          <img src={Bridge} alt="Bridge pose " draggable="false" />
        </div>
      </div>

      <div className="bp-status">
        <span><strong>Side:</strong> {sideUsed}</span>
        <span className="bp-sep" />
        <span><strong>Camera:</strong> {status}</span>
        <span className="bp-sep" />
        <span><strong>Hold:</strong> {progressSec}s / {Math.floor(holdMs / 1000)}s</span>
      </div>

      <p className="bp-note">
        Heuristics: hip raised above shoulders, thighs roughly parallel to the ground, knees near right angle, and hands/wrists tucked under the body. Small flickers won't immediately reset the hold.
      </p>

      {showDone && (
        <div className="bp-done">
          <div className="bp-done-card">
            <h3>Nice — Bridge held! ✅</h3>
            <p>You held the pose for {Math.floor(holdMs / 1000)} seconds.</p>
            <div className="bp-btns">
              <button className="bp-button" onClick={restart}>Restart Camera</button>
              <button className="bp-button" onClick={() => setShowDone(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
