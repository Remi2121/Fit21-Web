import React from 'react';
import './fithome.css';
import Headers from '../header/header.jsx';
import Pages from '../../pages/pages.jsx';
import hero_image from '../../assets/hero_image.png';
import hero_image_back from '../../assets/hero_image_back.png';

const Fithome = () => {
  const handleGetStarted = () => {
    // Scroll smoothly to the bottom of the page
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth',
    });
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
            <button className="btn" onClick={handleGetStarted}>Get Started</button>
            <button className="btn">Learn More</button>
          </div>
        </div>

        <div className="fit-home-right">
          <button className="btn">Join Now</button>
          <img src={hero_image} alt="Hero" className="fit-home-image" />
          <img src={hero_image_back} alt="Hero background" className="fit-home-image-back" />
        </div>
      </div>

      {/* Directly load Pages below */}
      <Pages />
    </>
  );
};

export default Fithome;
