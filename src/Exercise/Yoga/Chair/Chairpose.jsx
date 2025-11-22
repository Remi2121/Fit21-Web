/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import "./Chairpose.css";
import ChairImg from "../../../assets/chairpose.png";

import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

// Optional: live hold override from Firestore (keep if you already use it)
import { db } from "../../../firebase";
import { doc, onSnapshot } from "firebase/firestore";

// set true only when you want to see debug numbers (drawn un-mirrored)
const SHOW_HUD = false;

export default function ChairPose({
  holdMs = 10000,         // required hold time (ms)
  badResetMs = 3000,      // how long "bad" must last to reset timer
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);

  const [status, setStatus] = useState("loading…");
  const [allGoodState, setAllGoodState] = useState(false);
  const [sideUsed, setSideUsed] = useState("—");
  const [showDone, setShowDone] = useState(false);

  // timing / smoothing
  const greenSinceRef = useRef(null);
  const badSinceRef = useRef(null);
  const stoppedRef = useRef(false);
  const passBuf = useRef(Array(8).fill(false));
  const passIdx = useRef(0);
  const lastTsRef = useRef(0);

  // live hold from Firestore (optional)
  const [holdMsState, setHoldMsState] = useState(holdMs);
  const holdRef = useRef(holdMsState);
  const lastConfigTsRef = useRef(0);

  // HUD numbers (only if SHOW_HUD)
  const hudRef = useRef({
    kneeAngle: 0, kneeOK: false,
    hipFlex: 0, hipFlexOK: false,
    torsoLean: 0, torsoOK: false,
    armUpOK: false,
    nearFootOK: false, feetTogetherOK: true,
    score: 0,
  });

  // ---------- helpers ----------
  const angleDeg = (a, b, c) => {
    const abx = a.x - b.x, aby = a.y - b.y;
    const cbx = c.x - b.x, cby = c.y - b.y;
    const dot = abx * cbx + aby * cby;
    const mag1 = Math.hypot(abx, aby);
    const mag2 = Math.hypot(cbx, cby);
    const cos = Math.min(1, Math.max(-1, dot / ((mag1 * mag2) || 1)));
    return (Math.acos(cos) * 180) / Math.PI;
  };
  const nz = (x, d=0) => (Number.isFinite(x) ? x : d);
  const vis = (p) => p?.visibility ?? 0;

  // ---------- Firestore (optional hold override) ----------
  useEffect(() => {
    try {
      const cfgRef = doc(db, "poseRules", "chair");
      const unsub = onSnapshot(cfgRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const ts = data?.updatedAt?.toMillis?.() ?? Date.now();
        if (ts <= (lastConfigTsRef.current || 0)) return;
        lastConfigTsRef.current = ts;

        const incoming = data?.holdMs ?? (data?.holdSeconds ? data.holdSeconds * 1000 : holdMs);
        if (!Number.isNaN(incoming) && incoming > 0 && incoming !== holdRef.current) {
          setHoldMsState(incoming);
          holdRef.current = incoming;

          // reset runtime so new value applies immediately
          greenSinceRef.current = null;
          badSinceRef.current = null;
          stoppedRef.current = false;
          passBuf.current = Array(8).fill(false);
          passIdx.current = 0;
          setShowDone(false);
          setAllGoodState(false);
        }
      });
      return () => unsub();
    } catch {
      // If you don’t use Firestore here, it’s fine.
    }
  }, []);

  // ---------- Camera + loop ----------
  useEffect(() => {
    let rafId;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

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
        requestAnimationFrame(loop);
      } catch (e) {
        console.error(e);
        setStatus("camera error");
      }
    }

    const loop = () => {
      if (stoppedRef.current) return;
      const v = videoRef.current, c = canvasRef.current, lm = landmarkerRef.current;
      if (!v || !c || !lm) {
        rafId = requestAnimationFrame(loop);
        return;
      }
      let nowMs = performance.now();
      if (nowMs <= lastTsRef.current) nowMs = lastTsRef.current + 1;
      lastTsRef.current = nowMs;

      lm.detectForVideo(v, nowMs, (res) => {
        process(res);
        draw(res);
      });

      rafId = requestAnimationFrame(loop);
    };

    function draw(res) {
      const c = canvasRef.current;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);

      // mirror for selfie view
      ctx.save();
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);

      if (videoRef.current?.readyState >= 2) {
        ctx.drawImage(videoRef.current, 0, 0, c.width, c.height);
      }
      if (res.landmarks?.[0]) {
        const utils = new DrawingUtils(ctx);
        utils.drawConnectors(res.landmarks[0], PoseLandmarker.POSE_CONNECTIONS, {
          color: "#333", lineWidth: 3,
        });
        utils.drawLandmarks(res.landmarks[0], { color: "#fff", radius: 4 });
      }
      ctx.restore();

      if (SHOW_HUD) {
        const d = hudRef.current;
        ctx.setTransform(1,0,0,1,0,0);
        ctx.fillStyle = "#fff";
        ctx.font = "14px monospace";
        ctx.fillText(`knee=${d.kneeAngle.toFixed(0)}° ok:${d.kneeOK}`, 10, 22);
        ctx.fillText(`hipFlex=${d.hipFlex.toFixed(0)}° ok:${d.hipFlexOK}`, 10, 40);
        ctx.fillText(`torsoLean=${d.torsoLean.toFixed(3)} ok:${d.torsoOK}`, 10, 58);
        ctx.fillText(`armUpOK:${d.armUpOK}`, 10, 76);
        ctx.fillText(`nearFootOK:${d.nearFootOK} feetTogetherOK:${d.feetTogetherOK}`, 10, 94);
        ctx.fillText(`score=${d.score}`, 10, 112);
      }
    }

    function process(res) {
      if (!res.landmarks?.[0]) { setAllGoodState(false); return; }
      const lm = res.landmarks[0];

      // choose clearer side by hip visibility
      const side = (vis(lm[23]) >= vis(lm[24])) ? "left" : "right";
      setSideUsed(side);

      // near side joints
      const SH = side === "left" ? lm[11] : lm[12];
      const HP = side === "left" ? lm[23] : lm[24];
      const KN = side === "left" ? lm[25] : lm[26];
      const AN = side === "left" ? lm[27] : lm[28];
      const EL = side === "left" ? lm[13] : lm[14];
      const WR = side === "left" ? lm[15] : lm[16];

      // far side for optional “feet together”
      const AN2 = side === "left" ? lm[28] : lm[27];
      const KN2 = side === "left" ? lm[26] : lm[25];

      // --- Rules (tuned for side view) ---
      // 1) Knees bent ~90°
      const kneeAngle = angleDeg(HP, KN, AN);
      const kneeOK = kneeAngle >= 60 && kneeAngle <= 110;

      // 2) Hip flexed (torso meets thigh) – angle at hip small-ish
      // hipFlex = angle(SH, HP, KN); 180 = straight; smaller = flexed
      const hipFlex = angleDeg(SH, HP, KN);
      const hipFlexOK = hipFlex >= 40 && hipFlex <= 110;

      // 3) Torso lean forward (shoulder forward of hip and higher)
      const torsoLeanHoriz = Math.abs(nz(SH.x - HP.x));  // how far forward/back in x
      const torsoUp = (HP.y - SH.y) > 0.02 ? false : true; // shoulder above hip
      const torsoOK = torsoLeanHoriz > 0.05 && torsoUp;

      // 4) Arms lifted (wrist & elbow above shoulder line)
      const armUpOK =
        (WR?.y ?? 1) < (SH?.y ?? 0) - 0.03 &&
        (EL?.y ?? 1) < (SH?.y ?? 0) - 0.01;

      // 5) Near foot firmly on floor (ankle/heel below knee)
      const heel = side === "left" ? (lm[29] ?? AN) : (lm[30] ?? AN);
      const nearFootOK =
        (nz(AN.y - KN.y) >= 0.01) || (nz(heel.y - KN.y) >= 0.01);

      // 6) Feet together if far ankle visible (optional gate)
      let feetTogetherOK = true;
      const farVis = Math.max(vis(AN2), vis(KN2));
      if (farVis > 0.35) {
        // side view → the two ankles should be close in x and similar in y
        const dx = Math.abs(nz(AN.x - AN2.x));
        const dy = Math.abs(nz(AN.y - AN2.y));
        feetTogetherOK = dx < 0.12 && dy < 0.05;
      }

      // scoring: need 4 of the core 5 (knee, hipFlex, torso, armUp, nearFoot).
      const core = [kneeOK, hipFlexOK, torsoOK, armUpOK, nearFootOK];
      const coreScore = core.reduce((a,b)=>a+(b?1:0),0);
      let pass = coreScore >= 4;
      if (farVis > 0.35) pass = pass && feetTogetherOK;

      // save HUD
      hudRef.current = {
        kneeAngle, kneeOK,
        hipFlex, hipFlexOK,
        torsoLean: torsoLeanHoriz, torsoOK,
        armUpOK, nearFootOK, feetTogetherOK,
        score: coreScore + (farVis>0.35 && feetTogetherOK ? 1 : 0),
      };

      // anti-flicker smoothing (≥4 of last 8 frames)
      passBuf.current[passIdx.current] = pass;
      passIdx.current = (passIdx.current + 1) % passBuf.current.length;
      const goodFrames = passBuf.current.reduce((a,b)=>a+(b?1:0),0);
      const finalGood = goodFrames >= 4;

      setAllGoodState(finalGood);

      const now = performance.now();
      if (finalGood) {
        if (!greenSinceRef.current) greenSinceRef.current = now;
        badSinceRef.current = null;
        if (!stoppedRef.current && now - greenSinceRef.current >= holdRef.current) {
          stoppedRef.current = true;
          setShowDone(true);
          setStatus("completed");
          const v = videoRef.current;
          if (v?.srcObject) v.srcObject.getTracks().forEach(t => t.stop());
        }
      } else {
        if (!badSinceRef.current) badSinceRef.current = now;
        if (greenSinceRef.current && now - badSinceRef.current > badResetMs)
          greenSinceRef.current = null;
      }
    }

    init();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      const v = videoRef.current;
      if (v?.srcObject) v.srcObject.getTracks().forEach(t => t.stop());
    };
  }, []);

  const progressSec = greenSinceRef.current
    ? Math.max(0, (performance.now() - greenSinceRef.current) / 1000).toFixed(1)
    : "0.0";

  return (
    <div className="ch-container">
      <h2 className="stoke-text boe">Chair Pose — Utkatāsana</h2>

      {/* hidden video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width={640}
        height={480}
        style={{ position: "absolute", left: "-9999px" }}
      />

      <div className="ch-stage">
        <canvas
          ref={canvasRef}
          className={`ch-canvas ${allGoodState ? "good" : "bad"}`}
          width={640}
          height={480}
        />

        <div className="ch-right">
          <span className="ch-tip">
           Lie down and lift your hips up — keep knees bent and head on the mat.
          </span>
          <img src={ChairImg} className="ch-img" alt="chair reference" draggable="false" />
        </div>
      </div>

      <div className="ch-status">
        <span className="label">Side:</span> {sideUsed}
        <span className="sep" />
        <span className="label">Camera:</span> {status}
        <span className="sep" />
        <span className="label">Hold:</span> {progressSec}s / {(holdMsState/1000)|0}s
      </div>

      {showDone && (
        <div className="ch-done">
          <div className="ch-done-card">
            <h3>Nice — Chair held ✅</h3>
            <p>You held the pose for {((holdMsState/1000)|0)} seconds.</p>
            <button className="resetbutton" onClick={() => window.location.reload()}>
              Restart Camera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
