import React from "react";
import "./exercise.css";
import { Link } from "react-router-dom";
import { FaRunning, FaDumbbell, FaQuestionCircle, FaArrowUp, FaHome } from "react-icons/fa";
import Headers from "../components/header/header";

const ExerciseSelect = () => {
  const exercises = [
    { name: "Pushup", icon: <FaArrowUp />, path: "/pushup" },
    { name: "Jumping", icon: <FaRunning />, path: "/jumping" },
    { name: "Running", icon: <FaDumbbell />, path: "/running" },
    { name: "Quiz", icon: <FaQuestionCircle />, path: "/quizstart" },
  ];

  return (
     <>
    <Headers />
    <div className="exercise-container">
      <div className="glass-card">
        <h2>Select Your Exercise for Today</h2>

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
