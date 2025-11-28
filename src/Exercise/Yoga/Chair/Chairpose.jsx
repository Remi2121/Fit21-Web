/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useEffect, useRef, useState } from "react";
import "./Chairpose.css";
import ChairImg from "../../../assets/chairpose.png";

import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

// FIRESTORE
import { db } from "../../../firebase";
import {
  doc,
  onSnapshot,
  getDoc,
  setDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * Landmarks (MediaPipe):
 * L: 11 shoulder, 23 hip, 25 knee, 27 ankle, 13 elbow, 15 wrist
 * R: 12 shoulder, 24 hip, 26 knee, 28 ankle, 14 elbow, 16 wrist
 */

const SHOW_HUD = false;   // set true for live numbers on screen
const LOG_RULES = false;  // set true for console logs

export default function ChairPose({
  holdMs = 10000,       // fallback hold if admin doc not set
  badResetMs = 3000,    // how long "bad" must last to reset timer
}) {
  // --- camera/landmarker refs ---
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);

  // --- UI state ---
  const [status, setStatus] = useState("loading…");
  const [allGoodState, setAllGoodState] = useState(false);
  const [sideUsed, setSideUsed] = useState("—");
  const [showDone, setShowDone] = useState(false);

  // --- timers / smoothing ---
  const greenSinceRef = useRef(null);
  const badSinceRef   = useRef(null);
  const stoppedRef    = useRef(false);
  const passBuf       = useRef(Array(8).fill(false));
  const passIdx       = useRef(0);
  const lastTsRef     = useRef(0);

  // --- admin-configurable values (from Firestore) ---
  const [holdMsState, setHoldMsState] = useState(holdMs);
  const holdRef = useRef(holdMsState);
  const lastConfigTsRef = useRef(0);

  // ✅ Defaults (only these 4 angles + timer can change from admin)
  const defaults = {
    // admin-editable
    kneeMin: 70,
    kneeMax: 150,
    hipMin: 30,
    hipMax: 150,
    // fixed defaults (not admin)
    torsoLeanMin: 0.03,
    shoulderDropMax: 0.04,
    wristLift: 0.015,
    elbowLift: 0.005,
    farVisMin: 0.30,
    feetDxMax: 0.16,
    feetDyMax: 0.06,
  };

  const thresholdsRef = useRef(defaults);
  const [thresholdsUI, setThresholdsUI] = useState(defaults); // for optional debug display

  // --- one-save-per-day state ---
  const savingRef = useRef(false);
  const [alreadyPopup, setAlreadyPopup] = useState(false);

  // Utility: local YYYY-MM-DD
  const todayStrLocal = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // HUD data
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

  // ---------- Admin config: poseRules/chair ----------
  useEffect(() => {
    const cfgRef = doc(db, "poseRules", "chair");

    // one-time read so UI updates even before the live listener fires
    (async () => {
      try {
        const snap = await getDoc(cfgRef);
        if (snap.exists()) {
          const d = snap.data() || {};
          const sec = Number(
            d.holdSeconds != null ? d.holdSeconds :
            d.holdMs != null      ? d.holdMs / 1000 : NaN
          );
          if (Number.isFinite(sec) && sec > 0) {
            setHoldMsState(Math.round(sec * 1000));
          }
          const t = { ...thresholdsRef.current };
          if (d.kneeMin != null) t.kneeMin = Number(d.kneeMin);
          if (d.kneeMax != null) t.kneeMax = Number(d.kneeMax);
          if (d.hipMin  != null) t.hipMin  = Number(d.hipMin);
          if (d.hipMax  != null) t.hipMax  = Number(d.hipMax);
          thresholdsRef.current = t;
          setThresholdsUI(t);
        }
      } catch (e) {
        console.warn("chair initial read failed:", e);
      }
    })();

    const unsub = onSnapshot(cfgRef, (snap) => {
      try {
        if (!snap.exists()) return;
        const d = snap.data() || {};

        // timer: prefer holdSeconds, fallback holdMs
        const sec = Number(
          d.holdSeconds != null ? d.holdSeconds :
          d.holdMs != null      ? d.holdMs / 1000 : NaN
        );
        if (Number.isFinite(sec) && sec > 0) {
          const ms = Math.round(sec * 1000);
          if (ms !== holdRef.current) {
            setHoldMsState(ms);
            // reset runtime so new timer applies immediately
            greenSinceRef.current = null;
            badSinceRef.current = null;
            stoppedRef.current = false;
            passBuf.current = Array(8).fill(false);
            passIdx.current = 0;
            setShowDone(false);
            setAllGoodState(false);
          }
        }

        // only 4 angles from admin
        const t = { ...thresholdsRef.current };
        if (d.kneeMin != null) t.kneeMin = Number(d.kneeMin);
        if (d.kneeMax != null) t.kneeMax = Number(d.kneeMax);
        if (d.hipMin  != null) t.hipMin  = Number(d.hipMin);
        if (d.hipMax  != null) t.hipMax  = Number(d.hipMax);
        thresholdsRef.current = t;
        setThresholdsUI(t);
      } catch (e) {
        console.error("chair config onSnapshot error:", e);
      }
    });

    return () => unsub();
  }, []);

  // keep holdRef synced to state (so stop condition uses latest)
  useEffect(() => {
    holdRef.current = holdMsState;
  }, [holdMsState]);

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

      // mirror selfie
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
      if (!res.landmarks?.[0]) {
        setAllGoodState(false);
        badSinceRef.current ??= performance.now();
        const now = performance.now();
        if (greenSinceRef.current && now - (badSinceRef.current || now) > badResetMs) {
          greenSinceRef.current = null;
        }
        return;
      }
      const lm = res.landmarks[0];

      // choose side by hip visibility
      const side = (vis(lm[23]) >= vis(lm[24])) ? "left" : "right";
      setSideUsed(side);

      // near-side joints
      const SH = side === "left" ? lm[11] : lm[12];
      const HP = side === "left" ? lm[23] : lm[24];
      const KN = side === "left" ? lm[25] : lm[26];
      const AN = side === "left" ? lm[27] : lm[28];
      const EL = side === "left" ? lm[13] : lm[14];
      const WR = side === "left" ? lm[15] : lm[16];

      // far-side for feet together (optional)
      const AN2 = side === "left" ? lm[28] : lm[27];
      const KN2 = side === "left" ? lm[26] : lm[25];

      const T = thresholdsRef.current;

      // --- RULES ---
      // 1) Knee bend
      const kneeAngle = angleDeg(HP, KN, AN);
      const kneeOK = kneeAngle >= T.kneeMin && kneeAngle <= T.kneeMax;

      // 2) Hip flex
      const hipFlex = angleDeg(SH, HP, KN);
      const hipFlexOK = hipFlex >= T.hipMin && hipFlex <= T.hipMax;

      // 3) Torso lean + shoulder not much below hip
      const torsoLeanHoriz = Math.abs(nz(SH.x - HP.x));
      const torsoUp = (HP.y - SH.y) > T.shoulderDropMax ? false : true;
      const torsoOK = torsoLeanHoriz > T.torsoLeanMin && torsoUp;

      // 4) Arms lifted
      const armUpOK =
        (WR?.y ?? 1) < (SH?.y ?? 0) - T.wristLift &&
        (EL?.y ?? 1) < (SH?.y ?? 0) - T.elbowLift;

      // 5) Near foot grounded
      const heel = side === "left" ? (lm[29] ?? AN) : (lm[30] ?? AN);
      const nearFootOK =
        (nz(AN.y - KN.y) >= 0.005) || (nz(heel.y - KN.y) >= 0.005);

      // 6) Feet together (only if far ankle/knee visible)
      let feetTogetherOK = true;
      const farVis = Math.max(vis(AN2), vis(KN2));
      if (farVis > T.farVisMin) {
        const dx = Math.abs(nz(AN.x - AN2.x));
        const dy = Math.abs(nz(AN.y - AN2.y));
        feetTogetherOK = dx < T.feetDxMax && dy < T.feetDyMax;
      }

      // score: need 4/5 core; if far ankle visible, also need feetTogether
      const core = [kneeOK, hipFlexOK, torsoOK, armUpOK, nearFootOK];
      const coreScore = core.reduce((a,b)=>a+(b?1:0),0);
      let pass = coreScore >= 4;
      if (farVis > T.farVisMin) pass = pass && feetTogetherOK;

      // HUD save
      hudRef.current = {
        kneeAngle, kneeOK,
        hipFlex, hipFlexOK,
        torsoLean: torsoLeanHoriz, torsoOK,
        armUpOK, nearFootOK, feetTogetherOK,
        score: coreScore + (farVis > T.farVisMin && feetTogetherOK ? 1 : 0),
      };

      if (LOG_RULES) {
        // eslint-disable-next-line no-console
        console.log({
          side, kneeAngle: kneeAngle.toFixed(1), kneeOK,
          hipFlex: hipFlex.toFixed(1), hipFlexOK,
          torsoLeanHoriz: torsoLeanHoriz.toFixed(3), torsoUp, torsoOK,
          armUpOK, nearFootOK, feetTogetherOK, coreScore, pass
        });
      }

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
          if (v?.srcObject) {
            v.srcObject.getTracks().forEach(t => t.stop());
            v.srcObject = null;
          }
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

  // progress UI text
  const progressSec = greenSinceRef.current
    ? Math.max(0, (performance.now() - greenSinceRef.current) / 1000).toFixed(1)
    : "0.0";

  // ---------- Save once per day + bump finalScore ----------
  const POINTS_CHAIR = 5;

  const saveChairForToday = async () => {
    if (savingRef.current) return;
    try {
      const auth = getAuth();
      const uid = auth.currentUser?.uid;
      if (!uid) { alert("Please sign in first."); return; }

      const dayId = todayStrLocal();

      // per-day record
      const dayRef = doc(db, "users", uid, "exercises", "chair", "days", dayId);
      const existing = await getDoc(dayRef);
      if (existing.exists()) { setAlreadyPopup(true); return; }

      savingRef.current = true;

      await setDoc(dayRef, {
        date: dayId,
        points: POINTS_CHAIR,
        savedAt: serverTimestamp(),
      });

      // bump user's total
      const userRef = doc(db, "users", uid);
      await setDoc(
        userRef,
        { finalScore: increment(POINTS_CHAIR), updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.error("saveChairForToday error:", e);
    } finally {
      savingRef.current = false;
    }
  };

  const T = thresholdsUI;

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
            For this pose, stand in a proper side view facing the camera.
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

      {/* 👇 Rules note just like BigToe bt-note */}
      <p className="bt-note" style={{ maxWidth: 640, margin: "12px auto 0" }}>
        Side view only: knee {T.kneeMin}–{T.kneeMax}°, hip {T.hipMin}–{T.hipMax}°, arms above shoulders.
        (Small flickers won’t reset the timer.)
      </p>

      {showDone && (
        <div className="ch-done">
          <div className="ch-done-card">
            <h3>Nice — Chair held ✅</h3>
            <p>You held the pose for {((holdMsState/1000)|0)} seconds.</p>
            <button
              className="resetbutton"
              onClick={async () => {
                await saveChairForToday(); // per-day + finalScore
                setShowDone(false);
                window.location.reload();
              }}
            >
              Save & Restart
            </button>
          </div>
        </div>
      )}

      {alreadyPopup && (
        <div className="ch-done">
          <div className="ch-done-card">
            <h3>Already finished today 🎉</h3>
            <p>You’ve already completed Chair for {todayStrLocal()}.</p>
            <button className="resetbutton" onClick={() => setAlreadyPopup(false)}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
