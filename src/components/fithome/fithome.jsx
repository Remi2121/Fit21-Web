/* eslint-disable react-hooks/exhaustive-deps */
// Fithome.jsx
import React, { useState, useEffect, useRef } from "react";
import "./fithome.css";
import Headers from "../header/header.jsx";
import hero_image from "../../assets/hero_image.png";
import hero_image_back from "../../assets/hero_image_back.png";
import { motion } from "framer-motion";
import Login from "../login/login";
import { useNavigate } from "react-router-dom";

/* Firebase */
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
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

const Fithome = () => {
  const [showLogin, setShowLogin] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState("Guest");

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [loginMsg, setLoginMsg] = useState("");

  const [showAddAdminForm, setShowAddAdminForm] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [grantMsg, setGrantMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // New states for prompts/toasts
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const promptShownRef = useRef(false); // ensure prompt happens only once per mount
  const attendanceMarkedRef = useRef(false); // ensure we only mark once per session

  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef(null);

  const navigate = useNavigate();
  const transition = { type: "spring", duration: 3 };

  // ---------------- DATE HELPERS (Colombo timezone) ----------------
  function getTodayYYYYMMDD(timeZone = "Asia/Colombo") {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const map = {};
    parts.forEach((p) => (map[p.type] = p.value));
    return `${map.year}-${map.month}-${map.day}`;
  }

  // ---------------- TOAST ----------------
  const showToastMessage = (msg, ms = 4000) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastMessage(msg);
    setShowToast(true);
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
      toastTimerRef.current = null;
    }, ms);
  };

  // ---------------- MARK ATTENDANCE ----------------
  // returns "marked" | "already" | "error"
  const markAttendanceForUser = async (u) => {
    if (!u) return "error";
    // prevent re-marking same session
    if (attendanceMarkedRef.current) {
      return "already";
    }
    try {
      const uid = u.uid;
      const today = getTodayYYYYMMDD();
      const attRef = doc(db, "users", uid, "attendance", today);

      const snap = await getDoc(attRef);
      if (snap && snap.exists()) {
        attendanceMarkedRef.current = true;
        return "already";
      } else {
        await setDoc(
          attRef,
          {
            userId: uid,
            date: today,
            markedAt: serverTimestamp(),
            userName: u.displayName || null,
            email: u.email || null,
          },
          { merge: true }
        );
        attendanceMarkedRef.current = true;
        return "marked";
      }
    } catch (err) {
      console.error("markAttendance error:", err);
      return "error";
    }
  };

  // Close modals on ESC
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

  // Watch auth → detect admin from Firestore + derive username + attendance marking
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setCheckingAdmin(true);
      setIsAdmin(false);
      setUserEmail(u?.email ?? null);

      if (u) {
        const friendly =
          (u.displayName && u.displayName.trim()) ||
          (u.email ? u.email.split("@")[0] : "User");
        setUserName(friendly);

        // mark attendance immediately after we detect signed-in user
        const result = await markAttendanceForUser(u);
        if (result === "marked") {
          showToastMessage("Attendance marked for today ✅", 4500);
        } else if (result === "already") {
          showToastMessage("Attendance already marked for today", 3500);
        } else {
          showToastMessage("Could not mark attendance. Try again later.", 3500);
        }

      } else {
        setUserName("Guest");

        // If not signed in and not shown prompt yet, show small prompt for 5s then open login modal.
        if (!promptShownRef.current) {
          promptShownRef.current = true;
          setShowLoginPrompt(true);
          setTimeout(() => {
            setShowLoginPrompt(false);
            setShowLogin(true);
          }, 5000);
        }
      }

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

  const openAdmin = () => {
    setLoginMsg("");
    setGrantMsg("");
    setShowAdmin(true);
  };

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

  const goToAdmin = () => {
    if (isAdmin) {
      setShowAdmin(false);
      navigate("/admin");
    } else {
      setLoginMsg("❌ Admin access only.");
    }
  };

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
      const cred = EmailAuthProvider.credential(userEmail, pass);
      await reauthenticateWithCredential(auth.currentUser, cred);

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

  // Called when Login component reports success
  const onLoginSuccess = async () => {
    setShowLogin(false);
    // mark attendance now that user is logged in
    const u = auth.currentUser;
    if (u) {
      const result = await markAttendanceForUser(u);
      if (result === "marked") {
        showToastMessage("Attendance marked for today ✅", 4500);
      } else if (result === "already") {
        showToastMessage("Attendance already marked for today", 3500);
      } else {
        showToastMessage("Could not mark attendance. Try again later.", 3500);
      }
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
            <span>
              Welcome to FitLife at Sjp — <strong>@{userName}</strong>
            </span>
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
          <div className="button-stack">
            <button className="buttbtn" onClick={() => setShowLogin(true)}>
              Join Now
            </button>
            <button className="ad-btn" onClick={openAdmin}>
              Admin
            </button>
          </div>

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

      {/* Login prompt popup (appears for 5s when user is not signed in on page load) */}
      <div className={`login-prompt ${showLoginPrompt ? "show" : ""}`}>
        <div className="login-prompt-inner">
          To mark attendance, please log in.
        </div>
      </div>

      {/* Toast message */}
      <div className={`app-toast ${showToast ? "show" : ""}`}>
        {toastMessage}
      </div>

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

          <Login onSuccess={onLoginSuccess} />
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
