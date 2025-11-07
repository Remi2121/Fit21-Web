import React, { useRef, useState, useEffect } from "react";
import "./fithome.css";
import Headers from "../header/header.jsx";
import Pages from "../../pages/pages.jsx";
import hero_image from "../../assets/hero_image.png";
import hero_image_back from "../../assets/hero_image_back.png";
import { motion } from "framer-motion";
import Login from "../login/login.jsx";
import { useNavigate } from "react-router-dom";

/* Firebase (✅ use shared instance) */
import { auth, db } from "../../firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const Fithome = () => {
  const pagesRef = useRef(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // ---- STATES ----
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState(null);

  // Admin login form
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [loginMsg, setLoginMsg] = useState("");

  // Grant new admin
  const [showAddAdminForm, setShowAddAdminForm] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [grantMsg, setGrantMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();
  const transition = { type: "spring", duration: 3 };

  // close modals on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setShowLogin(false);
        setShowAdmin(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Watch auth → detect admin from Firestore
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setCheckingAdmin(true);
      setIsAdmin(false);
      setUserEmail(u?.email ?? null);

      if (!u) {
        setCheckingAdmin(false);
        return;
      }

      try {
        const q = query(
          collection(db, "admins"),
          where("email", "==", (u.email || "").toLowerCase())
        );
        const snap = await getDocs(q);
        setIsAdmin(!snap.empty);
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  // open admin modal
  const openAdmin = () => {
    setLoginMsg("");
    setGrantMsg("");
    setShowAdmin(true);
  };

  // handle login
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginMsg("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, adminEmail, adminPass);
      setLoginMsg("✅ Signed in. Checking admin access…");
    } catch (err) {
      setLoginMsg("❌ " + (err.message || "Login failed"));
    } finally {
      setBusy(false);
    }
  };

  // go to admin panel
  const goToAdmin = () => {
    if (isAdmin) {
      setShowAdmin(false);
      navigate("/admin");
    } else {
      setLoginMsg("❌ Admin access only.");
    }
  };

  // Grant new admin after verifying credentials
  const handleGrantAdmin = async (e) => {
    e.preventDefault();
    setGrantMsg("");
    if (!isAdmin) {
      setGrantMsg("❌ Only admins can grant admin.");
      return;
    }

    const newEmail = (newAdminEmail || "").trim().toLowerCase();
    const pass = confirmPass.trim();

    if (!newEmail || !newEmail.includes("@") || !pass) {
      setGrantMsg("❌ Enter valid details.");
      return;
    }

    setBusy(true);
    try {
      // Reauthenticate admin
      const cred = EmailAuthProvider.credential(userEmail, pass);
      await reauthenticateWithCredential(auth.currentUser, cred);

      // Add new admin to Firestore
      await setDoc(
        doc(db, "admins", newEmail),
        {
          email: newEmail,
          role: "admin",
          createdAt: serverTimestamp(),
          createdBy: userEmail,
        },
        { merge: true }
      );

      setGrantMsg("✅ Granted admin access to " + newEmail);
      setNewAdminEmail("");
      setConfirmPass("");
      setShowAddAdminForm(false);
    } catch (err) {
      console.error(err);
      setGrantMsg("❌ " + (err.message || "Failed to grant admin"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="fit-home-container" id="home">
        <div className="fit-home-blur-f"></div>

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
              <span>starts here!</span>
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
            <button className="btn">Learn More</button>
          </div>
        </div>

        <div className="fit-home-right">
          <button className="btn" onClick={() => setShowLogin(true)}>
            Join Now
          </button>

          <button className="ad-btn" onClick={openAdmin}>
            Admin
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
          <Login onSuccess={() => setShowLogin(false)} />
        </div>
      </div>

      {/* Admin Modal */}
      <div
        className={`admin-popup ${showAdmin ? "show" : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={() => setShowAdmin(false)}
      >
        <div
          className="admin-popup-container"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="admin-popup-title">
            <span>Admin Access</span>
            <img
              src="https://img.icons8.com/ios-filled/50/ffffff/delete-sign.png"
              alt="close"
              onClick={() => setShowAdmin(false)}
              aria-label="Close"
              style={{ cursor: "pointer" }}
            />
          </div>

          {/* Login section */}
          <div className="admin-section">
            <h3>Login to Admin</h3>
            <form onSubmit={handleAdminLogin} className="admin-form">
              <input
                type="email"
                placeholder="Email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                required
              />
              <button type="submit" className="btn" disabled={busy}>
                {busy ? "Signing in…" : "Login"}
              </button>
              {loginMsg && <p className="note">{loginMsg}</p>}
            </form>
            <div className="admin-go">
              <button
                className="btn"
                onClick={goToAdmin}
                disabled={checkingAdmin || !userEmail}
              >
                {checkingAdmin ? "Checking…" : "Go to Admin"}
              </button>
            </div>
          </div>

          {/* Add new admin section */}
          {isAdmin && (
            <div className="admin-section">
              <h3>Manage Admins</h3>
              {!showAddAdminForm ? (
                <button
                  className="btn"
                  onClick={() => setShowAddAdminForm(true)}
                >
                  Add New Admin
                </button>
              ) : (
                <form onSubmit={handleGrantAdmin} className="admin-form">
                  <input type="email" value={userEmail || ""} readOnly />
                  <input
                    type="password"
                    placeholder="Your admin password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    required
                  />
                  <input
                    type="email"
                    placeholder="New admin email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn" disabled={busy}>
                    {busy ? "Granting…" : "Grant Admin"}
                  </button>
                </form>
              )}
              {grantMsg && <p className="note">{grantMsg}</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Fithome;
