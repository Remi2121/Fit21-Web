import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "./Home.jsx";
import Pages from "./pages/pages.jsx";
import ScrollToHash from "./components/common/ScrollToTop.jsx";
import Quiz from "./Exercise/quiz/QuizStart.jsx";
import Leaderboard from "./Leaderboard/Leaderboard.jsx";  
import Admin from "./Admin/AdminDashboard.jsx";
import Exercise from "./Exercise/exercise.jsx";
import Yoga from "./Exercise/Yoga/Yogo.jsx";
import PushUp from "./Exercise/pushup/pushup.jsx";
import Plank from "./Exercise/plank/plank.jsx";
import Squat from "./Exercise/Scott/squat.jsx"


function App() {
  return (
    <div className="App">
      <Router>
        <ScrollToHash />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pages" element={<Pages />} />
          <Route path="/admin" element={<Admin />} /> 
          <Route path="/exercise" element={<Exercise />} />
          <Route path="/yoga" element={<Yoga />} />
          <Route path="/pushup" element={<PushUp />} />
          <Route path="/squat" element={<Squat />} />
          <Route path="/plank" element={<Plank />} />
          <Route path="/quizstart" element={<Quiz />} /> 
          <Route path="/leaderboard" element={<Leaderboard />} /> 
          <Route path="/contact" element={<Navigate to="/#contact" replace />} />
          <Route path="/login" element={<Navigate to="/#login" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;