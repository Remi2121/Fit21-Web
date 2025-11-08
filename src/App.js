// src/App.js (or App.jsx)

import React from "react";
import "./App.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Home from "./Home.jsx";
import Pages from "./pages/pages.jsx";
import AdminDashboard from "./Admin/AdminDashboard.jsx";
import ScrollToHash from "./components/common/ScrollToTop.jsx";
import Leaderboard from "./Leaderboard/Leaderboard.jsx";

function App() {
  return (
    <div className="App">
      <Router>
        {/* hash (#section) maariyum pothu top-ku scroll pannadhu */}
        <ScrollToHash />

        <Routes>
          {/* main pages */}
          <Route path="/" element={<Home />} />
          <Route path="/pages" element={<Pages />} />

          {/* leaderboard page */}
          <Route path="/leaderboard" element={<Leaderboard />} />

          {/* admin dashboard */}
          <Route path="/admin" element={<AdminDashboard />} />

          {/* contact/login hash redirect */}
          <Route path="/contact" element={<Navigate to="/#contact" replace />} />
          <Route path="/login" element={<Navigate to="/#login" replace />} />

          {/* unknown path -> home ku redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
