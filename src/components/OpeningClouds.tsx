import React, { useEffect, useRef } from 'react';

import './OpeningClouds.scss';

// Pre-import the drawn cloud art (Vite replaces require())
const cloudImages = import.meta.glob<string>('../assets/clouds/*.png', { eager: true, import: 'default' });
const CLOUD_URLS = Object.values(cloudImages);

// Hand-placed across the same tall span as ServiceBubbles' own ambient
// bubbles (`top` is a vh offset from the very top of the page, same
// convention as AMBIENT_BUBBLES there), so scrolling down through this
// section reads as descending through layers of cloud toward the landscape
// below. Mostly small/background-sized, with a handful of bigger ones for
// depth. `speed` is the parallax factor applied in the scroll handler below:
// 1 means "scrolls at the same rate as the page" (no extra offset), below 1
// lags behind (reads as further away/higher up), above 1 rushes past faster
// (reads as closer/passing quickly).
interface CloudSpec {
  img: number; // index into CLOUD_URLS
  top: string;
  left: string;
  width: string;
  speed: number;
  duration: number;
  delay: number;
  peakOpacity: number;
  direction: 1 | -1;
}

const CLOUDS: CloudSpec[] = [
  { img: 0, top: '0vh',   left: '6%',  width: '30vw', speed: 0.55, duration: 48, delay: -4,  peakOpacity: 0.4,  direction: 1 },
  { img: 3, top: '4vh',   left: '68%', width: '14vw', speed: 1.3,  duration: 30, delay: -18, peakOpacity: 0.32, direction: -1 },
  { img: 1, top: '14vh',  left: '38%', width: '12vw', speed: 0.9,  duration: 34, delay: -9,  peakOpacity: 0.3,  direction: 1 },
  { img: 5, top: '20vh',  left: '82%', width: '18vw', speed: 0.6,  duration: 42, delay: -25, peakOpacity: 0.34, direction: -1 },
  { img: 2, top: '28vh',  left: '10%', width: '10vw', speed: 1.5,  duration: 26, delay: -3,  peakOpacity: 0.3,  direction: 1 },
  { img: 4, top: '34vh',  left: '55%', width: '15vw', speed: 0.8,  duration: 36, delay: -30, peakOpacity: 0.28, direction: 1 },
  { img: 0, top: '42vh',  left: '25%', width: '20vw', speed: 1.15, duration: 38, delay: -14, peakOpacity: 0.32, direction: -1 },
  { img: 3, top: '50vh',  left: '75%', width: '11vw', speed: 0.7,  duration: 28, delay: -21, peakOpacity: 0.3,  direction: 1 },
  { img: 1, top: '58vh',  left: '4%',  width: '32vw', speed: 0.5,  duration: 52, delay: -36, peakOpacity: 0.4,  direction: -1 },
  { img: 5, top: '66vh',  left: '45%', width: '9vw',  speed: 1.4,  duration: 24, delay: -7,  peakOpacity: 0.28, direction: 1 },
  { img: 2, top: '74vh',  left: '65%', width: '13vw', speed: 0.85, duration: 32, delay: -16, peakOpacity: 0.3,  direction: -1 },
  { img: 4, top: '82vh',  left: '15%', width: '16vw', speed: 1.05, duration: 40, delay: -28, peakOpacity: 0.32, direction: 1 },
  { img: 0, top: '92vh',  left: '85%', width: '10vw', speed: 0.65, duration: 30, delay: -11, peakOpacity: 0.28, direction: -1 },
  { img: 3, top: '102vh', left: '30%', width: '24vw', speed: 1.2,  duration: 44, delay: -33, peakOpacity: 0.34, direction: 1 },
  { img: 1, top: '112vh', left: '58%', width: '9vw',  speed: 0.75, duration: 27, delay: -5,  peakOpacity: 0.26, direction: -1 },
  { img: 5, top: '122vh', left: '8%',  width: '14vw', speed: 1.35, duration: 33, delay: -20, peakOpacity: 0.3,  direction: 1 },
  { img: 2, top: '133vh', left: '72%', width: '19vw', speed: 0.6,  duration: 46, delay: -39, peakOpacity: 0.3,  direction: -1 },
  { img: 4, top: '144vh', left: '40%', width: '11vw', speed: 0.95, duration: 29, delay: -13, peakOpacity: 0.26, direction: 1 },
  { img: 0, top: '155vh', left: '18%', width: '13vw', speed: 1.1,  duration: 35, delay: -24, peakOpacity: 0.28, direction: -1 },
  { img: 3, top: '167vh', left: '62%', width: '10vw', speed: 0.7,  duration: 31, delay: -8,  peakOpacity: 0.24, direction: 1 },
  { img: 1, top: '176vh', left: '32%', width: '22vw', speed: 0.85, duration: 41, delay: -19, peakOpacity: 0.3,  direction: -1 },
  { img: 5, top: '183vh', left: '5%',  width: '12vw', speed: 1.25, duration: 28, delay: -6,  peakOpacity: 0.26, direction: 1 },
  { img: 2, top: '190vh', left: '80%', width: '15vw', speed: 0.65, duration: 37, delay: -31, peakOpacity: 0.28, direction: -1 },
  { img: 4, top: '197vh', left: '52%', width: '9vw',  speed: 1.1,  duration: 25, delay: -12, peakOpacity: 0.24, direction: 1 },
  { img: 0, top: '204vh', left: '20%', width: '11vw', speed: 0.9,  duration: 32, delay: -22, peakOpacity: 0.24, direction: -1 },
];

// Drawn white/gray cloud shapes drifting through the opening section's
// scroll, from the big centered name down toward the landscape below - since
// they sit inside the same color-grade subtree as the rest of ServiceBubbles,
// their near-white bodies pick up the current gradient's highlight color
// directly, giving the animated grading actual shapes to paint. They're
// real, normally-flowing content (not a fixed overlay) so scrolling past
// them feels like descending through cloud layers rather than watching a
// static backdrop; a scroll-linked parallax offset (each cloud's own
// `speed`) makes some drift past faster than others for depth.
function OpeningClouds() {
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Scroll-linked parallax is exactly the kind of motion that can trigger
    // discomfort for motion-sensitive users, so it's skipped entirely here
    // (the clouds still render, just without the differential-speed effect).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onScroll = () => {
      const y = window.scrollY;
      CLOUDS.forEach((c, i) => {
        const el = layerRefs.current[i];
        if (el) el.style.transform = `translateY(${y * (1 - c.speed)}px)`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="opening-clouds" aria-hidden="true">
      {CLOUDS.map((c, i) => (
        <div
          key={i}
          ref={el => { layerRefs.current[i] = el; }}
          className="opening-clouds__layer"
          style={{ top: c.top, left: c.left, width: c.width }}
        >
          <img
            src={CLOUD_URLS[c.img]}
            className="opening-clouds__cloud"
            alt=""
            style={{
              '--drift-duration': `${c.duration}s`,
              '--drift-delay': `${c.delay}s`,
              // A second animation (opacity-only) running on its own,
              // deliberately-unrelated period - see the CSS for why two
              // independent cycles read as much windier/less mechanical
              // than one animation trying to do both jobs.
              '--breathe-duration': `${c.duration * 1.7}s`,
              '--breathe-delay': `${c.delay * 0.6 - 5}s`,
              '--peak-opacity': c.peakOpacity,
              '--drift-direction': c.direction,
            } as React.CSSProperties}
          />
        </div>
      ))}
    </div>
  );
}

export default OpeningClouds;
