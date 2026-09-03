import React, { useEffect, useRef, useState } from 'react';

import OpeningClouds from './OpeningClouds';

import './ServiceBubbles.scss';

// Static so bubbles don't reshuffle on every re-render; values are hand-picked
// for a scattered, non-repeating spread rather than randomized. `top` is a
// vh offset from the very top of the page (the section starts at document
// y=0) rather than a percentage of the section's own height, so the spread
// stays consistent regardless of how tall the section is on a given
// breakpoint. The lowest `top` values sit within the first viewport on
// purpose: combined with the tall rise distance in the keyframe below, those
// bubbles are already mid-rise, visible drifting up from below, while the
// big centered name is still the only other thing on screen.
const AMBIENT_BUBBLES = [
  { size: 14, top: '22vh',  left: '12%', duration: 12, delay: -3 },
  { size: 22, top: '48vh',  left: '82%', duration: 16, delay: -9 },
  { size: 10, top: '68vh',  left: '25%', duration: 10, delay: -1 },
  { size: 30, top: '80vh',  left: '55%', duration: 18, delay: -12 },
  { size: 16, top: '92vh',  left: '6%',  duration: 11, delay: -5 },
  { size: 36, top: '105vh', left: '70%', duration: 19, delay: -2 },
  { size: 12, top: '118vh', left: '38%', duration: 9,  delay: -7 },
  { size: 24, top: '130vh', left: '90%', duration: 14, delay: -10 },
  { size: 18, top: '145vh', left: '16%', duration: 13, delay: -4 },
  { size: 42, top: '158vh', left: '60%', duration: 20, delay: -15 },
  { size: 15, top: '172vh', left: '32%', duration: 10, delay: -6 },
  { size: 26, top: '186vh', left: '78%', duration: 15, delay: -11 },
  { size: 20, top: '200vh', left: '46%', duration: 12, delay: -8 },
];

function ServiceBubbles() {
  const [opacity, setOpacity] = useState(0);
  // Separate fade applied to the whole section (real bubbles + ambient ones)
  // so everything dissolves away again before it scrolls up underneath the
  // fixed navbar, instead of overlapping nav items like ABOUT.
  const [sectionOpacity, setSectionOpacity] = useState(1);
  const bubblesWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const vh = window.innerHeight;
      const fadeStart = vh * 0.1;
      const fadeEnd = vh * 0.4;
      setOpacity(Math.min(1, Math.max(0, (window.scrollY - fadeStart) / (fadeEnd - fadeStart))));

      let fadeOut = 1;
      const nav = document.querySelector('nav');
      const wrapper = bubblesWrapperRef.current;
      if (nav && wrapper) {
        const navBottom = nav.getBoundingClientRect().bottom;
        const rect = wrapper.getBoundingClientRect();
        // A small lead-in so the section has finished dissolving a little
        // before it would actually start overlapping the navbar, rather
        // than right as it touches.
        const buffer = 40;
        const effectiveNavBottom = navBottom + buffer;
        // Scale the fade with how much of the whole bubble cluster (top to
        // bottom) is still below the navbar: stays fully visible until the
        // top edge starts sliding under it, and only reaches 0 once the
        // entire cluster has passed underneath. Using the full top-to-bottom
        // span (rather than just the top edge against a fixed distance)
        // means tall stacked layouts on narrow screens - where the bottom
        // bubble can be far below the top one - don't dissolve away early
        // just because the top edge alone got close to the navbar.
        fadeOut = Math.min(1, Math.max(0, (rect.bottom - effectiveNavBottom) / (rect.bottom - rect.top)));
      }
      setSectionOpacity(fadeOut);
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
    <div className="ServiceBubbles color-grade" style={{ opacity: sectionOpacity }}>
      <OpeningClouds />
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
        ref={bubblesWrapperRef}
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
