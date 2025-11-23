/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import "./BridgePose.css";
import Bridgeimg from "../../../assets/Bridge.png";

import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

import { db } from "../../../firebase";
import { doc, onSnapshot, getDoc, setDoc, serverTimestamp,increment } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Chair from "../Chair/Chairpose";

// set true only to see debug numbers (unmirrored)
const SHOW_HUD = false;


// ---- tunables (easy to tweak later) ----
const HIP_GAP_MIN = 0.020;      
const KNEE_MIN = 60, KNEE_MAX = 120;
const SHIN_HORIZ_MAX = 0.08;
const NEAR_FOOT_MARGIN = 0.010;
const FAR_FOOT_MARGIN  = 0.006;
const FAR_VIS_MIN = 0.35;
const HEAD_VIS_MIN = 0.50;
const HEAD_FLOOR_MARGIN = -0.50;

export default function BridgePose({ holdMs = 10000, badResetMs = 3000 }) {
  const [nextYoga, setNextYoga] = useState(false);
  const stripRef = useRef(null);
  const bridgeRef = useRef(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);

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

  const [holdMsState, setHoldMsState] = useState(holdMs);
  const holdRef = useRef(holdMsState);
  const lastConfigTsRef = useRef(0);

  // === one-save-per-day ===
  const savingRef = useRef(false);
  // eslint-disable-next-line no-unused-vars
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [alreadyPopup, setAlreadyPopup] = useState(false);

  const todayStrLocal = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };


  // HUD values (only if SHOW_HUD)
  const dbgRef = useRef({
    hipGap: 0, hipGapOK: false,
    kneeAngle: 0, kneeOK: false,
    shinHoriz: 0, shinOK: false,
    feetNearOK: false, feetFarOK: true,
    headDelta: 0, headOK: false,
    score: 0,
  });

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
  const nz = (x, d = 0) => (Number.isFinite(x) ? x : d);
  const vis = (p) => p?.visibility ?? 0;

  // Firestore hold override
  useEffect(() => {
    const cfgRef = doc(db, "poseRules", "bridgepose");
    const unsub = onSnapshot(cfgRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const ts = data?.updatedAt?.toMillis?.() ?? Date.now();
      if (ts <= (lastConfigTsRef.current || 0)) return;
      lastConfigTsRef.current = ts;

      const incoming =
        data?.holdMs ?? (data?.holdSeconds ? data.holdSeconds * 1000 : holdMs);
      if (!Number.isNaN(incoming) && incoming > 0 && incoming !== holdRef.current) {
        setHoldMsState(incoming);
        holdRef.current = incoming;

        // reset runtime
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
  }, []);

    // Check on mount if already saved today
  useEffect(() => {
    (async () => {
      try {
        const auth = getAuth();
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const ref = doc(db, "users", uid, "exercises", "bridge", "days", todayStrLocal());
        const snap = await getDoc(ref);
        if (snap.exists()) setAlreadyDone(true);
      } catch (e) {
        console.error("bridge already-done check failed:", e);
      }
    })();
  }, []);

  const POINTS_BRIDGE = 5;

const saveBridgeForToday = async () => {
  if (savingRef.current) return;
  try {
    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) {
      alert("Please sign in first.");
      return;
    }

    const dayId = todayStrLocal();
    const dayRef = doc(db, "users", uid, "exercises", "bridge", "days", dayId);

    // idempotent: don't double-count on the same day
    const existing = await getDoc(dayRef);
    if (existing.exists()) {
      setAlreadyDone(true);
      setAlreadyPopup(true);
      return;
    }

    savingRef.current = true;

    // 1) Save today’s bridge result
    await setDoc(dayRef, {
      date: dayId,
      points: POINTS_BRIDGE,        // was 5
      savedAt: serverTimestamp(),
    });

    // 2) Atomically add to users/{uid}.finalScore (create if missing)
    const userRef = doc(db, "users", uid);
    await setDoc(
      userRef,
      {
        finalScore: increment(POINTS_BRIDGE),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setAlreadyDone(true);
  } catch (e) {
    console.error("saveBridgeForToday error:", e);
  } finally {
    savingRef.current = false;
  }
};

  useEffect(() => {
  if (nextYoga) {
    // small delay so Bridge slide mounts, then scroll
    requestAnimationFrame(() => {
      bridgeRef.current?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    });
  }
}, [nextYoga]);
  // camera + loop
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
      if (!v || !c || !lm) { rafId = requestAnimationFrame(loop); return; }
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
        const d = dbgRef.current;
        ctx.setTransform(1,0,0,1,0,0);
        ctx.fillStyle = "#fff";
        ctx.font = "14px monospace";
        ctx.fillText(`hipΔ=${d.hipGap.toFixed(3)} ok:${d.hipGapOK}`, 10, 22);
        ctx.fillText(`knee=${d.kneeAngle.toFixed(0)}° ok:${d.kneeOK}`, 10, 40);
        ctx.fillText(`shinX=${d.shinHoriz.toFixed(3)} ok:${d.shinOK}`, 10, 58);
        ctx.fillText(`nearFootOK:${d.feetNearOK} farFootOK:${d.feetFarOK}`, 10, 76);
        ctx.fillText(`headΔ=${d.headDelta.toFixed(3)} ok:${d.headOK}`, 10, 94);
        ctx.fillText(`score=${d.score}`, 10, 112);
      }
    }

    function process(res) {
      if (!res.landmarks?.[0]) { setAllGoodState(false); return; }
      const lm = res.landmarks[0];

      // pick clearer side (by hip visibility)
      const side = (vis(lm[23]) >= vis(lm[24])) ? "left" : "right";
      setSideUsed(side);

      const S  = side === "left" ? lm[11] : lm[12];
      const H  = side === "left" ? lm[23] : lm[24];
      const K  = side === "left" ? lm[25] : lm[26];
      const A  = side === "left" ? lm[27] : lm[28];
      const ear= side === "left" ? lm[7]  : lm[8];

      // The far leg (for optional double-foot contact)
      const K2 = side === "left" ? lm[26] : lm[25];
      const A2 = side === "left" ? lm[28] : lm[27];

      // -------- Rules --------
      // 1) Hip above shoulder with reduced margin
      const hipGap = nz(S.y - H.y);
      const hipGapOK = H.y < S.y && hipGap > HIP_GAP_MIN;

      // 2) Knee ~ 90°
      const kneeAngle = angleDeg(H, K, A);
      const kneeOK = kneeAngle >= KNEE_MIN && kneeAngle <= KNEE_MAX;

      // 3) Shin roughly vertical (x aligned)
      const shinHoriz = Math.abs(nz(A.x - K.x));
      const shinOK = shinHoriz < SHIN_HORIZ_MAX;

      // 4) Foot ON FLOOR (hard-gate) — NEAR leg must be on floor.
      const heel  = side === "left" ? (lm[29] ?? A) : (lm[30] ?? A);
      const fidx  = side === "left" ? (lm[31] ?? lm[29] ?? A) : (lm[32] ?? lm[30] ?? A);
      const nearFootOK =
        (nz(A.y - K.y)    >= NEAR_FOOT_MARGIN) ||
        (nz(heel.y - K.y) >= NEAR_FOOT_MARGIN) ||
        (nz(fidx.y - K.y) >= NEAR_FOOT_MARGIN);

      // far foot: enforce only if reasonably visible (reduce false blocking)
      const farVis = Math.max(vis(K2), vis(A2));
      let farFootOK = true;
      if (farVis > FAR_VIS_MIN) {
        const heel2 = side === "left" ? (lm[30] ?? A2) : (lm[29] ?? A2);
        const fidx2 = side === "left" ? (lm[32] ?? heel2) : (lm[31] ?? heel2);
        farFootOK =
          (nz(A2.y - K2.y)    >= FAR_FOOT_MARGIN) ||
          (nz(heel2.y - K2.y) >= FAR_FOOT_MARGIN) ||
          (nz(fidx2.y - K2.y) >= FAR_FOOT_MARGIN);
      }

      // 5) Head on floor — optional (require only if visible)
      const eye = side === "left" ? (lm[2] ?? lm[7]) : (lm[5] ?? lm[8]);
      const headDelta = Math.max(
        eye ? nz(eye.y - S.y) : -1,
        ear ? nz(ear.y - S.y) : -1
      );
      const headOK = headDelta > HEAD_FLOOR_MARGIN;
      const headVisible = (eye?.visibility ?? 0) > HEAD_VIS_MIN || (ear?.visibility ?? 0) > HEAD_VIS_MIN;

// ----- STRICT SCORING: all 5 must be true (head must be visible + OK) -----
      const fiveChecks = [
        hipGapOK,           // 1) hip above shoulder
        kneeOK,             // 2) knee ~90°
        shinOK,             // 3) shin roughly vertical
        nearFootOK,         // 4) near foot on floor
        (headVisible && headOK), // 5) head must be visible AND correct
      ];

      // HUD save (score shown out of 5; far-foot shown separately)
      dbgRef.current = {
        hipGap, hipGapOK,
        kneeAngle, kneeOK,
        shinHoriz, shinOK,
        feetNearOK: nearFootOK,
        feetFarOK: farFootOK,
        headDelta, headOK,
        headVisible,
        score: fiveChecks.reduce((a,b)=>a+(b?1:0),0),
      };

      // final pass only if ALL 5 conditions are true
      const pass = fiveChecks.every(Boolean);

      // smoothing: 4/8 frames
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
    <div className="yoga-strip" ref={stripRef}>
    {/* Slide 1: Bridge Toe */}
    <section className="yoga-slide">
    <div className="bp-container">
      <h2 className="stoke-text boe">Bridge Pose – Setu Bandha Sarvangasana</h2>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ position: "absolute", left: "-9999px" }}
      />

      <div className="bp-stage">
        <canvas
          ref={canvasRef}
          className={`bp-canvas ${allGoodState ? "good" : "bad"}`}
          width={640}
          height={480}
        />
        <div className="bp-ref-plain">
          <span className="bp-tip-plain">
            Lie down and lift your hips up — keep knees bent and head on the mat.
          </span>
          <img src={Bridgeimg} className="bp-pose-img" alt="ref" draggable="false" />
        </div>
      </div>

      <div className="bp-status">
        <span className="bp-label">Side:</span> {sideUsed}
        <span className="bp-sep" />
        <span className="bp-label">Camera:</span> {status}
        <span className="bp-sep" />
        <span className="bp-label">Hold:</span> {progressSec}s / {(holdMsState / 1000) | 0}s
      </div>

      {/* rules note */}
      <p className="bp-note">
        Rules: hip above shoulder, knee between {KNEE_MIN}–{KNEE_MAX}°, shin near vertical, near foot touching floor, and head visible & on the floor. (Small flickers won’t reset the timer.)
      </p>

      {showDone && !nextYoga &&(
        <div className="bp-done">
          <div className="bp-done-card">
            <h3>Excellent! ✅</h3>
            <p>You held the bridge pose for {(holdMsState / 1000) | 0} seconds.</p>
            
            <button
                className="resetbutton"
                onClick={async () => {
                    await saveBridgeForToday(); // store to Firestore (only once per day)
                    setShowDone(false);
                    setNextYoga(true); // move to next Yoga
                  }}
              >
                Do next Yoga
              </button>
          </div>
        </div>
      )}
      </div>
    </section>

    {/* Slide 2: Bridge */}
        {nextYoga && (
          <section className="yoga-slide" ref={bridgeRef}>
            <Chair />
          </section>
        )}

      {/* already-finished popup */}
      {alreadyPopup && (
        <div className="bp-done">
          <div className="bp-done-card">
            <h3>Already finished today 🎉</h3>
            <p>You’ve already completed Bridge for {todayStrLocal()}.</p>
            <button className="resetbutton" onClick={() => setAlreadyPopup(false)}>OK</button>
          </div>
        </div>
      )}
      
    </div>
  );
}
