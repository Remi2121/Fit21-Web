import React from "react";
import "./Fooder.css";
import { Facebook, Instagram } from "lucide-react"; // 👈 new import

const Fooder = () => {
  return (
    <div className="Footer-container">
      <hr className="footer-divider" />

      <footer className="footer">
        {/* Left: Brand */}
        <div className="footer-brand">
          <div className="brand-badge">F21</div>
          <div className="brand-text">
            <h3>FIT 21</h3>
            <span>Faculty of Engineering • USJ</span>
          </div>
        </div>

        {/* Middle: Description */}
        <div className="footer-description">
          <p>
            FIT 21 is a 21-day fitness challenge organized by the Faculty of
            Engineering, University of Sri Jayewardenepura. 💪 Participate,
            stay consistent, and win exciting prizes for your team!
          </p>
        </div>

        {/* Right: Social (icon version) */}
        <nav className="social-links" aria-label="social links">
          <a
            href="https://www.facebook.com/people/Nexus-Club-USJ/61567209233227/?rdid=tPuwWWviXu4gqnkt&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F1G9D5TwSqS%2F"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="social-link"
          >
            <Facebook size={22} strokeWidth={2} />
          </a>
          <a
            href="https://www.instagram.com/nexus_club_usj"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="social-link"
          >
            <Instagram size={22} strokeWidth={2} />
          </a>
        </nav>
      </footer>

      {/* subtle background accents */}
      <div className="blur-f-1"></div>
      <div className="blur-f-2"></div>
    </div>
  );
};

export default Fooder;
