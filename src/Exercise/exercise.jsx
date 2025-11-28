import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaRunning,
  FaArrowUp,
  FaClipboardList,
  FaPrayingHands,
  FaHome,
  FaDumbbell,
} from "react-icons/fa";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import Headers from "../components/header/header";
import "./exercise.css";
import Login from "../components/login/login"; // 👈 for the popup

const ExerciseSelect = () => {
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
  const [selectedPath, setSelectedPath] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const exercises = [
    { name: "Pushup", icon: <FaArrowUp className="ex-icon" />, path: "/pushup" },
    { name: "Plank", icon: <FaRunning className="ex-icon" />, path: "/plank" },
    { name: "Squat", icon: <FaDumbbell className="ex-icon" />, path: "/squat" },
    { name: "Yoga", icon: <FaPrayingHands className="ex-icon" />, path: "/yogo" },
    { name: "Quiz", icon: <FaClipboardList className="ex-icon" />, path: "/quizstart" },
  ];

  const handleExerciseClick = (path, e) => {
    if (!user) {
      e.preventDefault();
      setSelectedPath(path);
      setLoginMessage("⚠️ Please login first to continue");
      setShowLogin(true);
    }
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    setLoginMessage("");
    if (selectedPath) navigate(selectedPath);
  };

  return (
    <>
      <Headers />
      <div className="exercise-container">
        <div className="glass-card">
          <h2 className="stoke-text">Select Your Exercise for Today</h2>
          <span className="exercise-subtitle">
            Dress in fit wears to accurately perform the exercise
            <br />
          </span>

          {loginMessage && <p className="login-warning">{loginMessage}</p>}

          <div className="exercise-list">
            {exercises.map((item, i) => (
              <Link
                to={item.path}
                key={i}
                className="exercise-row"
                onClick={(e) => handleExerciseClick(item.path, e)}
              >
                <div className="exercise-icon">
                  {item.icon}
                  <span className="ring" aria-hidden="true" />
                </div>
                <span className="exercise-name">{item.name}</span>
                <span className="go">→</span>
              </Link>
            ))}
          </div>

          <div className="back-container">
            <Link to="/" className="back-btn">
              <FaHome className="home-icon" /> Back to Home
            </Link>
          </div>
        </div>
      </div>

      {/* 🔥 Login popup — same as in Fithome */}
      {showLogin && (
        <div
          className="login-popup show"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="login-popup-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="login-popup-title">
              <span>Welcome to FitLife</span>
              <img
                src="https://img.icons8.com/ios-filled/50/ffffff/delete-sign.png"
                alt="close"
                onClick={() => setShowLogin(false)}
                aria-label="Close"
              />
            </div>

            {/* ✅ Login imported and used directly */}
            <Login onSuccess={handleLoginSuccess} />
          </div>
        </div>
      )}
    </>
  );
};

export default ExerciseSelect;
