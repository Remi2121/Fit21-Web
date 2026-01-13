import React, { useState } from "react";
import BigToe from "./Big Toe/Big-Toe";
import popImg from "../../assets/pop message.png";
import "./Yogo.css";

const Yogo = () => {
  const [started, setStarted] = useState(false);

  if (started) return <BigToe />;

  return (
    <div className="yogo">
      <div className="yogo-card">
        <h1 className="yogo-title">Yoga Instructions</h1>

        <p className="yogo-note">
          For every yoga pose, make sure your <strong>side profile</strong> is visible to the camera.
        </p>

        <h2 className="yogo-subtitle">Yoga List</h2>
        <ol className="yogo-list">
          <li>Big Toe Pose – Padangushthasana</li>
          <li>Bridge Pose – Setu Bandha Sarvangasana</li>
          <li>Chair Pose – Utkatāsana</li>
        </ol>

        <h2 className="yogo-subtitle">How to Perform</h2>
        <ol className="yogo-list">
          <li>Ensure your full body is clearly visible within the camera area.</li>
          <li>
            For each yoga pose, hold your position exactly like the reference image shown on the side.
          </li>
          <li>
            Once you hold the pose for the required time, a pop-up message like the one below will appear.
          </li>
        </ol>

        <div className="yogo-imgwrap">
          <img src={popImg} alt="pop message" className="yogo-image" />
        </div>

        <ol className="yogo-list" start={4}>
          <li>
            When you click “Do next Yoga,” you’ll move to the next pose and 5 points will be added to your account.
          </li>
          <li>
            There are a total of 3 yoga poses. Completing all of them will earn you 15 points in total — good luck!
          </li>
        </ol>

        <button className="yogo-btn" onClick={() => setStarted(true)}>
          Start Yoga
        </button>
      </div>
    </div>
  );
};

export default Yogo;