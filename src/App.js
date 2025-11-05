import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./Home.jsx";
import Pages from "./pages/pages.jsx";
import ScrollToHash from "./components/common/ScrollToTop.jsx";

function App() {
  return (
    <div className="App">
      <Router>
        <ScrollToHash />   {/* 👈 hash change-க்கு scroll */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pages" element={<Pages />} />
          <Route path="/contact" element={<Navigate to="/#contact" replace />} />
          <Route path="/login" element={<Navigate to="/#login" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
