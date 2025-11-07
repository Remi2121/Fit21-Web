import React, { useState, useRef, useMemo, useEffect } from "react";
import "./contactus.css";
import emailjs from "@emailjs/browser";

const ContactUs = () => {
  const [showForm, setShowForm] = useState(false);   // your existing toggle (kept)
  const [showModal, setShowModal] = useState(false); // 🆕 modal visibility
  const formRef = useRef(null);

  // Freeze a readable timestamp for this render
  const nowStr = useMemo(() => new Date().toLocaleString(), []);

  // Listen for header click -> open this modal
  useEffect(() => {
    const onOpen = () => setShowModal(true);
    window.addEventListener("open-contact-modal", onOpen);
    return () => window.removeEventListener("open-contact-modal", onOpen);
  }, []);

  const sendEmail = async (e) => {
    e.preventDefault();
    try {
      const result = await emailjs.sendForm(
        "service_dfb7bwm",                 // ✅ your EmailJS service ID
        "template_3dickjd",                // ⬅️ replace in EmailJS if needed
        formRef.current,
        { publicKey: "1O9eu4fEcwq4DNk3F" } // ⬅️ replace in EmailJS if needed
      );
      console.log("SUCCESS!", result.status, result.text);
      alert("Message sent!");
      e.target.reset();
      setShowModal(false); // close modal after success
      setShowForm(false);
    } catch (err) {
      console.error("FAILED…", err);
      alert("Sending failed. Please try again.");
    }
  };

  const closeModal = () => setShowModal(false);

  return (
    <>
      {/* Your original inline section (kept, if you still want it on the page) */}
      <div className="contactus" id="contact">
        <div className="left-c">
          <hr />
          <div>
            <span className="stoke-text">Contact Us</span>
            <span className="stoke-text">  Get in Touch</span>
          </div>
          <div>
            <span>We would love to hear from you! </span>
            <span className="stoke-text">
              Feel free to reach out for any inquiries or feedback.
            </span>
          </div>

          <button
            className="btn-contact-toggle"
            onClick={() => setShowForm((s) => !s)}
            aria-expanded={showForm}
            aria-controls="contact-form-area"
          >
            {showForm ? "Close Form" : "Contact Us"}
          </button>
        </div>

        <div
          id="contact-form-area"
          className={`right-c ${showForm ? "show" : "hide"}`}
        >
          <form ref={formRef} className="contact-form" onSubmit={sendEmail}>
            <input type="text" name="name" placeholder="Name" required />
            <input type="email" name="email" placeholder="Email" required />
            <textarea name="message" rows="5" placeholder="Message" required />
            <input type="hidden" name="time" value={nowStr} />
            <button type="submit" className="btn-contact-btn">Send Message</button>
          </form>
        </div>
      </div>

      {/* 🧊 MODAL POPUP (opens when Header -> Contact Us is clicked) */}
      {showModal && (
        <div className="contact-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="contactModalTitle">
          <div className="contact-modal">
            <button className="contact-modal-close" onClick={closeModal} aria-label="Close">
              ×
            </button>

            <div className="contact-modal-header">
              <h2 id="contactModalTitle">Contact Us • Get in Touch</h2>
              <p className="contact-modal-sub">
                We would love to hear from you! Feel free to reach out for any inquiries or feedback.
              </p>
              {/* optional: include quick info lines */}
              <ul className="contact-quick-info">
                <li><strong>Club:</strong> Fit21</li>
                <li><strong>Preferred reply time:</strong> within 24 hours</li>
                <li><strong>Timestamp:</strong> {nowStr}</li>
              </ul>
            </div>

            <form ref={formRef} className="contact-form contact-form--modal" onSubmit={sendEmail}>
              <input type="text" name="name" placeholder="Your Name" required />
              <input type="email" name="email" placeholder="Your Email" required />
              <textarea name="message" rows="5" placeholder="Your Message" required />
              <input type="hidden" name="time" value={nowStr} />
              <button type="submit" className="btn-contact-btn">Send Message</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ContactUs;
