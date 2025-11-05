import React from "react";
import "./header.css";
import Logo from "../../assets/logo.png";
import { Link } from "react-router-dom";

const Header = () => {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const header = document.querySelector(".header");
    const headerH = header ? header.offsetHeight : 0;
    const y = el.getBoundingClientRect().top + window.pageYOffset - headerH;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <div className="header">
      {/* left-pinned logo (doesn't push menu) */}
      <img src={Logo} alt="Fit21 Logo" className="logo" />

      {/* centered menu with slight left shift */}
      <ul className="header-menu">
        <li>
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("home");
            }}
          >
            Home
          </a>
        </li>

        <li>
          {/* keep router link if you have a /leaderboard route */}
          <Link to="/leaderboard">Leader Board</Link>
        </li>

        <li>
          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("contact");
            }}
          >
            Contact Us
          </a>
        </li>
      </ul>
    </div>
  );
};

export default Header;
