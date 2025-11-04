import React from 'react';
import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Fit from './components/fithome/fithome.jsx';
import Pages from './pages/pages.jsx';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Home Page */}
          <Route path="/" element={<Fit />} />
          
          {/* New Pages Section */}
          <Route path="/pages" element={<Pages />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
