import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import "./login.css";

const Login = ({ onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
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

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <button type="submit" disabled={loading}>
          {loading ? "Please wait…" : isRegister ? "Sign Up" : "Login"}
        </button>

        {message && <p className="note">{message}</p>}

        <p
          onClick={() => {
            setIsRegister(!isRegister);
            setMessage("");
          }}
          className="toggle-link click"
        >
          {isRegister
            ? "Already have an account? Login"
            : "New user? Register here"}
        </p>
      </form>
    </div>
  );
};

export default Login;
