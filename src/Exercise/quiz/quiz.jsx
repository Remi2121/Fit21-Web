import React, { useState } from "react";
import "./quiz.css";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";

export default function Quiz() {
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);

  const handleStartQuiz = () => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setShowPopup(true);
      return;
    }
    navigate("/quizstart");
  };

  const closePopup = () => setShowPopup(false);

  return (
    <div className="quiz-wrap">
      <h1 className="stoke-text quiz-title">Quiz</h1>
      <button className="start-btn" onClick={handleStartQuiz}>
        Start Quiz
      </button>

      {/* === LOGIN POPUP === */}
      {showPopup && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>🔒 Please login before starting the quiz 🙂</h3>
            <div className="popup-buttons">
              <button className="popup-btn close" onClick={closePopup}>
                Close
              </button>
              <button
                className="popup-btn login"
                onClick={() => {
                  closePopup();
                  navigate("/login");
                }}
              >
                Login Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
