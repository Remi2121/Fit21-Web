import React from "react";
import "./Fooder.css";
import facebook from "../../assets/facebook.png";
import instagram from "../../assets/instagram.png";

const Fooder = () => {
  return (
    <div className="Footer-container">
      <hr />
      <div className="footer">
        {/* Description Section */}
        <div className="footer-description">
          <h3>FIT 21</h3>
          <p>
            FIT 21 is a 21-day fitness challenge organized by the Faculty of
            Engineering, University of Sri Jayewardenepura. 💪 Participate,
            stay consistent, and win exciting prizes for your team!
          </p>
        </div>

        {/* Social Links Section */}
        <div className="social-links">
          <a
            href="https://www.facebook.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={facebook} alt="facebook" />
          </a>
          <a
            href="https://www.instagram.com/dhano_r.k.r/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={instagram} alt="instagram" />
          </a>
        </div>

        <div className="blur-f-1"></div>
        <div className="blur-f-2"></div>
      </div>
    </div>
  );
};

export default Fooder;
