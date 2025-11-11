import React, { useState, useRef, useMemo, useEffect } from "react";
import "./header.css";
import Logo from "../../assets/logo.png";
import { Link } from "react-router-dom";
import emailjs from "@emailjs/browser";

const Header = () => {
  const [showContact, setShowContact] = useState(false);
  const formRef = useRef(null);

  // pretty timestamp for the email
  const nowStr = useMemo(() => new Date().toLocaleString(), []);

  // ESC to close + lock body scroll when open
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setShowContact(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!showContact) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [showContact]);

  const sendEmail = async (e) => {
    e.preventDefault();
    try {
      const result = await emailjs.sendForm(
        "service_dfb7bwm",                 // your EmailJS service ID
        "template_3dickjd",                // your template ID
        formRef.current,
        { publicKey: "1O9eu4fEcwq4DNk3F" } // your public key
      );
      console.log("SUCCESS!", result.status, result.text);
      alert("Message sent!");
      e.target.reset();
      setShowContact(false);
    } catch (err) {
      console.error("FAILED…", err);
      alert("Sending failed. Please try again.");
    }
  };

  return (
    <>
      <div className="header">
        <img src={Logo} alt="Fit21 Logo" className="logo" />

        <ul className="header-menu">
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/exercise">Exercise</Link>
          </li>

          <li>
            <Link to="/leaderboard">Leader Board</Link>
         </li>

          <li>
            {/* 👉 like your Login Popup */}
            <a href="#contact" onClick={(e) => { e.preventDefault(); setShowContact(true); }}>
              Contact Us
            </a>
          </li>
        </ul>
      </div>

      {/* Contact Popup */}
      <div
        className={`contact-popup ${showContact ? "show" : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={() => setShowContact(false)}        /* close on backdrop */
      >
        <div
          className="contact-popup-container"
          onClick={(e) => e.stopPropagation()}       /* prevent backdrop close */
          role="document"
        >
          <div className="contact-popup-title">
            <span className="stoke-text">Contact Us • Get in Touch</span>
            
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
