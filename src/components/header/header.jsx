// Header.jsx
import React, { useState, useRef, useMemo, useEffect } from "react";
import "./header.css";
import Logo from "../../assets/logo.png";
import { NavLink } from "react-router-dom";
import emailjs from "@emailjs/browser";

const Header = () => {
  const [showContact, setShowContact] = useState(false);

  // MOBILE DROPDOWN UNDER LOGO
  const [showLogoMenu, setShowLogoMenu] = useState(false);
  const logoRef = useRef(null);   // the button/icon that toggles menu
  const menuRef = useRef(null);   // the dropdown menu itself

  const formRef = useRef(null);
  const nowStr = useMemo(() => new Date().toLocaleString(), []);

  // ESC KEY CLOSE CONTACT POPUP
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setShowContact(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ESC CLOSE MOBILE DROPDOWN
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setShowLogoMenu(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // CLOSE DROPDOWN WHEN CLICK OUTSIDE (supports mouse and touch)
  useEffect(() => {
    const onDocPointer = (e) => {
      // if refs are not ready, ignore
      if (!logoRef.current || !menuRef.current) return;
      const target = e.target;
      // if click/touch inside button or inside the menu, do nothing
      if (logoRef.current.contains(target) || menuRef.current.contains(target)) {
        return;
      }
      // otherwise close menu
      setShowLogoMenu(false);
    };

    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("touchstart", onDocPointer);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer);
    };
  }, []);

  // SEND EMAIL
  const sendEmail = async (e) => {
    e.preventDefault();
    try {
      await emailjs.sendForm(
        "service_dfb7bwm",
        "template_3dickjd",
        formRef.current,
        { publicKey: "1O9eu4fEcwq4DNk3F" }
      );
      alert("Message sent!");
      e.target.reset();
      setShowContact(false);
    } catch (err) {
      alert("Sending failed. Please try again.");
    }
  };

  return (
    <>
      <div className="header">
        <img src={Logo} alt="Fit21 Logo" className="logo" />

        {/* MOBILE LOGO BUTTON (DESKTOP hides via CSS) */}
        <button
          className="logo-btn"
          ref={logoRef}
          onClick={() => setShowLogoMenu(v => !v)}
          aria-expanded={showLogoMenu}
          aria-controls="mobile-logo-menu"
          aria-label="Open site menu"
        >
          <span className={`logo-caret ${showLogoMenu ? "open" : ""}`}>▼</span>
        </button>

        {/* DESKTOP MENU (mobile hidden via CSS) */}
        <ul className="header-menu" role="menubar" aria-label="Main navigation">
          <li role="none">
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              role="menuitem"
            >
              Home
            </NavLink>
          </li>
          <li role="none">
            <NavLink
              to="/exercise"
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              role="menuitem"
            >
              Exercise
            </NavLink>
          </li>
          <li role="none">
            <NavLink
              to="/leaderboard"
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              role="menuitem"
            >
              Leader Board
            </NavLink>
          </li>
          <li role="none">
            <NavLink
              to="/attendance"
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              role="menuitem"
            >
              Attendance
            </NavLink>
          </li>
          <li role="none">
            <button
              className="nav-contact"
              onClick={() => setShowContact(true)}
              aria-haspopup="dialog"
            >
              Contact Us
            </button>
          </li>
        </ul>

        {/* MOBILE DROPDOWN BELOW LOGO */}
        <div
          id="mobile-logo-menu"
          ref={menuRef}
          className={`logo-menu ${showLogoMenu ? "show" : ""}`}
          role="menu"
          aria-hidden={!showLogoMenu}
        >
          <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-link-m active" : "nav-link-m")} onClick={() => setShowLogoMenu(false)}>Home</NavLink>
          <NavLink to="/exercise" className={({ isActive }) => (isActive ? "nav-link-m active" : "nav-link-m")} onClick={() => setShowLogoMenu(false)}>Exercise</NavLink>
          <NavLink to="/leaderboard" className={({ isActive }) => (isActive ? "nav-link-m active" : "nav-link-m")} onClick={() => setShowLogoMenu(false)}>Leader Board</NavLink>
          <NavLink to="/attendance" className={({ isActive }) => (isActive ? "nav-link-m active" : "nav-link-m")} onClick={() => setShowLogoMenu(false)}>Attendance</NavLink>
          <button
            className="logo-menu-contact"
            onClick={() => { setShowContact(true); setShowLogoMenu(false); }}
          >
            Contact Us
          </button>
        </div>
      </div>

      {/* Contact Popup */}
      <div
        className={`contact-popup ${showContact ? "show" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-title"
        onClick={() => setShowContact(false)}        /* close on backdrop */
      >
        <div
          className="contact-popup-container"
          onClick={(e) => e.stopPropagation()}       /* prevent backdrop close */
          role="document"
        >
          <div className="contact-popup-title">
            <span id="contact-title" className="stoke-text">Contact Us • Get in Touch</span>
            <button
              onClick={() => setShowContact(false)}
              aria-label="Close contact form"
              style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>

          <p className="contact-popup-sub">
            We would love to hear from you! Feel free to reach out for any inquiries or feedback.
          </p>
          <ul className="contact-popup-info">
            <li><strong>Club-</strong> Fit21</li>
            <li><strong>Preferred reply time:</strong> within 24 hours</li>
          </ul>

          {/* EmailJS form (same names as your template variables) */}
          <form ref={formRef} className="contact-form contact-form--popup" onSubmit={sendEmail}>
            <input type="text" name="name" placeholder="Your Name" required />
            <input type="email" name="email" placeholder="Your Email" required />
            <textarea name="message" rows="5" placeholder="Your Message" required />
            <input type="hidden" name="time" value={nowStr} />
            <button type="submit" className="btn-contact-btn">Send Message</button>
          </form>
        </div>
      </div>
    </>
  );
};

export default Header;
