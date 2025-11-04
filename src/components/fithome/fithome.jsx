import React, { useRef, useState } from 'react';
import './fithome.css';
import Headers from '../header/header.jsx';
import Pages from '../../pages/pages.jsx';

const Fithome = () => {
  const workoutsRef = useRef(null);
  const [showWorkouts, setShowWorkouts] = useState(false);

  const handleGetStarted = () => {
    // make section visible first
    setShowWorkouts(true);
    setTimeout(() => {
      workoutsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  };

  return (
    <>
      <div className="fit-home-container">
        <div className="fit-home-left">
          <Headers />

          <div className="fit-home-content">
            <div></div>
            <span>Welcome to FitLife at Sjp</span>
          </div>

          <div className="fit-home-tag">
            <div>
              <span className="stoke-text">Your fitness journey </span>
              <span>starts here !</span>
            </div>
            <div>
              <span className="stoke-text">Get ready to </span>
              <span>achieve your goals!</span>
            </div>
          </div>

          <div className="fit-home-figures">
            <div>
              <span>+250</span>
              <span>Members</span>
            </div>
          </div>

          <div className="fit-home-buttons">
            <button className="btn" onClick={handleGetStarted}>
              Get Started
            </button>
            <button className="btn">Learn More</button>
          </div>
        </div>

        <div className="fit-home-right"></div>
      </div>

      {/* Workout section - only render after Get Started */}
      {showWorkouts && (
        <section
          id="workouts"
          ref={workoutsRef}
          className="workouts-section fade-in"
        >
          <Pages />
        </section>
      )}
    </>
  );
};

export default Fithome;
