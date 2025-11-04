import React, { useRef, useState } from 'react';
import './pages.css';

import PushUp from './pushup/pushup.jsx';
import Jumping from './jumping/jumping.jsx';
import Running from './running/running.jsx';

const Pages = () => {
  const [selected, setSelected] = useState(null); // 'pushup' | 'jumping' | 'running' | null
  const detailRef = useRef(null);

  const openSection = (name) => {
    setSelected(name);

    requestAnimationFrame(() => {
      const el = detailRef.current;
      if (!el) return;

      const headerOffset = 80; // adjust if your sticky header is taller/shorter
      const rect = el.getBoundingClientRect();
      const isFullyVisible =
        rect.top >= headerOffset && rect.bottom <= window.innerHeight;

      if (!isFullyVisible) {
        // scroll the card into view, then nudge by headerOffset so nothing hides behind header
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.scrollBy({ top: -headerOffset, left: 0, behavior: 'smooth' });
      }
    });
  };

  return (
    <div className="pages-container">

        <h1 className="stoke-text">Choose Your Workout</h1>
        

        <div className="circle-container">
          <button
            className={`circle ${selected === 'pushup' ? 'active' : ''}`}
            onClick={() => openSection('pushup')}
            aria-pressed={selected === 'pushup'}
          >
            Push-Ups
          </button>

          <button
            className={`circle ${selected === 'jumping' ? 'active' : ''}`}
            onClick={() => openSection('jumping')}
            aria-pressed={selected === 'jumping'}
          >
            Jumping
          </button>

          <button
            className={`circle ${selected === 'running' ? 'active' : ''}`}
            onClick={() => openSection('running')}
            aria-pressed={selected === 'running'}
          >
            Running
          </button>
      </div>

      {selected && (
        <div ref={detailRef} className="workout-detail ">
          {selected === 'pushup' && <PushUp />}
          {selected === 'jumping' && <Jumping />}
          {selected === 'running' && <Running />}
        </div>
      )}
    </div>
  );
};

export default Pages;
