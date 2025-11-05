import React, { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import "./login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Account created successfully ✅");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        alert("Logged in successfully 🔥");
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="login-box" id="login">
      <form onSubmit={handleSubmit} className="login-popup-inputs">
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
        <button type="submit">{isRegister ? "Sign Up" : "Login"}</button>
        <p onClick={() => setIsRegister(!isRegister)} className="toggle-link click">
          {isRegister ? "Already have an account? Login" : "New user? Register here"}
        </p>
      </form>
    </div>
  );
};

export default Login;
