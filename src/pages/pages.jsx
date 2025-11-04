import React, { useRef, useState } from 'react';
import './pages.css';

import PushUp from './pushup.jsx';
import Jumping from './jumping.jsx';
import Running from './running.jsx';

const Pages = () => {
  const [selected, setSelected] = useState(null); // 'pushup' | 'jumping' | 'running' | null
  const detailRef = useRef(null);

  const openSection = (name) => {
    setSelected(name);
    // wait for render, then smooth-scroll to the detail
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div className="pages-container">
      <h1>Choose Your Workout</h1>

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
        <div ref={detailRef} className="workout-detail fade-in">
          {selected === 'pushup' && <PushUp />}
          {selected === 'jumping' && <Jumping />}
          {selected === 'running' && <Running />}
        </div>
      )}
    </div>
  );
};

export default Pages;
