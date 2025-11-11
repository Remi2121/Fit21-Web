import React, { useState, useRef, useMemo } from "react";
import "./contactus.css";
import emailjs from "@emailjs/browser";

const ContactUs = () => {
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef(null);

  // Freeze a readable timestamp for this render
  const nowStr = useMemo(() => new Date().toLocaleString(), []);

  const sendEmail = async (e) => {
    e.preventDefault();

    try {
      const result = await emailjs.sendForm(
        "service_dfb7bwm",            // ✅ your EmailJS service ID
        "template_3dickjd",           // ⬅️ replace in EmailJS
        formRef.current,
        { publicKey: "1O9eu4fEcwq4DNk3F" } // ⬅️ replace in EmailJS
      );
      console.log("SUCCESS!", result.status, result.text);
      alert("Message sent!");
      e.target.reset();
      setShowForm(false);
    } catch (err) {
      console.error("FAILED…", err);
      alert("Sending failed. Please try again.");
    }
  };

  return (
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
          {/* These input names MUST match your EmailJS template variables */}
          <input type="text" name="name" placeholder="Name" required />
          <input type="email" name="email" placeholder="Email" required />
          <textarea name="message" rows="5" placeholder="Message" required />
          {/* hidden field for {{time}} */}
          <input type="hidden" name="time" value={nowStr} />
          <button type="submit" className="btn-contact-btn">Send Message</button>
        </form>
      </div>
    </div>
  );
};

export default ContactUs;
