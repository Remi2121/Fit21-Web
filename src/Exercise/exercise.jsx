import React from "react";
import { Link } from "react-router-dom";
import {
  FaRunning,
  FaArrowUp,
  FaClipboardList,
  FaQuestionCircle,
  FaPrayingHands,
  FaHome,          // ✅ ADD THIS
} from "react-icons/fa";

import Headers from "../components/header/header";
import "./exercise.css"; // optional, create for styles below

const ExerciseSelect = () => {
  const exercises = [
    { name: "Pushup", icon: <FaArrowUp className="ex-icon" aria-hidden />, path: "/pushup" },
    { name: "Plank", icon: <FaRunning className="ex-icon" aria-hidden />, path: "/plank" },
    { name: "Yoga", icon: <FaPrayingHands className="ex-icon" aria-hidden />, path: "/yoga" },
    { name: "Quiz", icon: <FaClipboardList className="ex-icon" aria-hidden />, path: "/quizstart" },
    { name: "Squat", icon: <FaQuestionCircle className="ex-icon" aria-hidden />, path: "/squat" },
  ];

  return (
     <>
    <Headers />
    <div className="exercise-container">
      <div className="glass-card">
        <h2 className="stoke-text">Select Your Exercise for Today</h2>

        <div className="exercise-list">
          {exercises.map((item, i) => (
            <Link to={item.path} key={i} className="exercise-row">
              <div className="exercise-icon">
                {item.icon}
                <span className="ring" aria-hidden="true" />
              </div>
              <span className="exercise-name">{item.name}</span>
              <span className="go">→</span>
            </Link>
          ))}
        </div>

        {/* 🏠 Back Button */}
        <div className="back-container">
          <Link to="/" className="back-btn">
            <FaHome className="home-icon" /> Back to Home
          </Link>
        </div>
      </div>
    </div>
    </>
  );
};

export default ExerciseSelect;
