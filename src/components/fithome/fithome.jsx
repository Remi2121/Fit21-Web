import React, { useRef, useState, useEffect } from "react";
import "./fithome.css";
import Headers from "../header/header.jsx";
import Pages from "../../pages/pages.jsx";
import hero_image from "../../assets/hero_image.png";
import hero_image_back from "../../assets/hero_image_back.png";
import { motion } from "framer-motion";
import Login from "../login/login.jsx";

const Fithome = () => {
  const pagesRef = useRef(null);
  const [showLogin, setShowLogin] = useState(false);
  const transition = { type: "spring", duration: 3 };

  // close modal on ESC
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setShowLogin(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleGetStarted = () => {
    const el = pagesRef.current;
    if (!el) return;
    const header = document.querySelector(".header");
    const headerH = header ? header.offsetHeight : 0;
    const y = el.getBoundingClientRect().top + window.pageYOffset - headerH;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <>
      <div className="fit-home-container" id="home">
        <div className="blur blur-f"></div>

        <div className="fit-home-left">
          <Headers />

          <div className="fit-home-content">
            <motion.div
              initial={{ left: "238px" }}
              whileInView={{ left: "8px" }}
              transition={{ ...transition, type: "tween" }}
            />
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
          <button className="btn" onClick={() => setShowLogin(true)}>
            Join Now
          </button>
          <img src={hero_image} alt="Hero" className="fit-home-image" />
          <motion.img
            initial={{ right: "11rem" }}
            whileInView={{ right: "16rem" }}
            transition={transition}
            src={hero_image_back}
            alt="Hero background"
            className="fit-home-image-back"
          />
        </div>
      </div>

      {/* Scroll target for Get Started */}
      <section id="workouts" ref={pagesRef}>
        <Pages />
      </section>

      {/*  Login Popup */}
      <div
        className={`login-popup ${showLogin ? "show" : ""}`}
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

          {/* Your Firebase login form */}
          <Login />
        </div>
      </div>
    </>
  );
};

export default Fithome;
