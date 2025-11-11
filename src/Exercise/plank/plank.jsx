import React, { useRef, useEffect, useState } from 'react';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

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
    <div style={{ textAlign: 'center', paddingTop: 20 }}>
      <h2>Perfect Plank Challenge 1</h2>
      <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{ border: '2px solid #444', borderRadius: '8px' }}
      />
      <h3>Status: {Plank}</h3>
      <h3>Time: {time}s</h3>
      {success && (
        <h2 style={{ color: 'lime' }}>🎉 Great job! You held the plank for 1 minute! 🎉</h2>
      )}
    </div>
  );
}