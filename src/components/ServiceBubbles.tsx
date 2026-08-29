import React, { useEffect, useState } from 'react';

import './ServiceBubbles.scss';

// Static so bubbles don't reshuffle on every re-render; values are hand-picked
// for a scattered, non-repeating spread rather than randomized.
const AMBIENT_BUBBLES = [
  { size: 16, top: '58%', left: '8%',  duration: 11, delay: -2 },
  { size: 34, top: '42%', left: '18%', duration: 15, delay: -7 },
  { size: 12, top: '70%', left: '30%', duration: 9,  delay: -4 },
  { size: 26, top: '50%', left: '46%', duration: 13, delay: -1 },
  { size: 18, top: '66%', left: '62%', duration: 10, delay: -6 },
  { size: 40, top: '38%', left: '76%', duration: 17, delay: -9 },
  { size: 20, top: '60%', left: '88%', duration: 12, delay: -3 },
];

function ServiceBubbles() {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const vh = window.innerHeight;
      const fadeStart = vh * 0.1;
      const fadeEnd = vh * 0.4;
      setOpacity(Math.min(1, Math.max(0, (window.scrollY - fadeStart) / (fadeEnd - fadeStart))));
    };

    handleScroll(); // set initial value
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Subtle mouse-driven tilt so each bubble catches the light like a real
  // glass sphere as the cursor passes over it.
  const handleTilt = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--tilt-x', x.toFixed(3));
    el.style.setProperty('--tilt-y', y.toFixed(3));
  };

  const resetTilt = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.setProperty('--tilt-x', '0');
    e.currentTarget.style.setProperty('--tilt-y', '0');
  };

  return (
    <div className="ServiceBubbles color-grade">
      {AMBIENT_BUBBLES.map((b, i) => (
        <span
          key={i}
          className="ambient-bubble"
          style={{
            '--bubble-size': `${b.size}px`,
            top: b.top,
            left: b.left,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          } as React.CSSProperties}
        />
      ))}
      <div
        className="service-bubbles"
        style={{
          opacity,
          transform: `translateY(${(1 - opacity) * 24}px) scale(${0.9 + opacity * 0.1})`,
          filter: `blur(${(1 - opacity) * 6}px)`,
        }}
      >
        <a
          className="service-bubble float-a"
          href="https://kinoko.nosk.be"
          target="_blank"
          rel="noopener noreferrer"
          onMouseMove={handleTilt}
          onMouseLeave={resetTilt}
        >
          <span className="bubble-title">LOOK WITHIN</span>
          <span className="bubble-sub">Sacred Mushroom Journeys, guided by a soul who cares</span>
        </a>
        <a
          className="service-bubble float-b"
          href="https://kodamap.app"
          target="_blank"
          rel="noopener noreferrer"
          onMouseMove={handleTilt}
          onMouseLeave={resetTilt}
        >
          <span className="bubble-title">KODAMAP</span>
          <span className="bubble-sub">Find a tree that wants to be climbed ♡</span>
        </a>
        {/* <a className="service-bubble float-b" href="#" target="_blank" rel="noopener noreferrer">
          <span className="bubble-title">Sample Service</span>
          <span className="bubble-sub">sample description</span>
        </a> */}
      </div>
    </div>
  );
}

export default ServiceBubbles;
