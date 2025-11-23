// Login.jsx (updated with password toggle)
import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import "./login.css";

const provider = new GoogleAuthProvider();

const Login = ({ onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 👇 ADD: show/hide state
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      if (isRegister) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCred.user;
        await updateProfile(user, { displayName: username });
        await setDoc(doc(db, "users", user.uid), {
          username,
          email,
          createdAt: serverTimestamp(),
        });
        setMessage(`✅ Welcome ${username}! Account created successfully.`);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          navigate("/");
        }, 1200);
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const user = userCred.user;
        setMessage(`🔥 Welcome back, ${user.displayName || "User"}!`);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          navigate("/");
        }, 1000);
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ " + (err.message || "Something went wrong"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setMessage("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (result._tokenResponse && result._tokenResponse.isNewUser) {
        await setDoc(doc(db, "users", user.uid), {
          username: user.displayName || "",
          email: user.email || "",
          createdAt: serverTimestamp(),
          provider: "google",
        });
      }

      setMessage(`✅ Signed in as ${user.displayName || user.email}`);
      if (onSuccess) onSuccess();
      navigate("/");
    } catch (err) {
      console.error("Google sign-in error", err);
      setMessage("❌ " + (err.message || "Google sign-in failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-box" id="login">
      <form onSubmit={handleSubmit} className="login-popup-inputs">
        {isRegister && (
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="name"
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        {/* 👇 Wrap password input and add toggle button */}
        <div className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isRegister ? "new-password" : "current-password"}
          />
          <button
            type="button"
            className="toggle-password"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((s) => !s)}
            onMouseDown={(e) => e.preventDefault()} // keep input focus
            disabled={loading}
            title={showPassword ? "Hide" : "Show"}
          >
            {/* simple inline SVGs so you don't need any icon lib */}
            {showPassword ? (
              // eye-off
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a18.88 18.88 0 0 1 5.06-6.94"/>
                <path d="M1 1l22 22"/>
                <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88"/>
                <path d="M14.12 14.12L20.49 20.49"/>
                <path d="M10.58 5.51A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a18.84 18.84 0 0 1-2.24 3.4"/>
              </svg>
            ) : (
              // eye
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s3-8 11-8 11 8 11 8-3 8-11 8S1 12 1 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Please wait…" : isRegister ? "Sign Up" : "Login"}
        </button>

        <button
          type="button"
          className="google-btn flex items-center justify-center gap-2"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? "Please wait…" : "Sign in with Google"}
        </button>

        {message && <p className="note">{message}</p>}

        <p
          onClick={() => {
            setIsRegister(!isRegister);
            setMessage("");
          }}
          className="toggle-link click"
        >
          {isRegister ? "Already have an account? Login" : "New user? Register here"}
        </p>
      </form>
    </div>
  );
};

export default Login;
