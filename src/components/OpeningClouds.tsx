import React, { useMemo } from 'react';

import './OpeningClouds.scss';

// Pre-import the drawn cloud art (Vite replaces require())
const cloudImages = import.meta.glob<string>('../assets/clouds/*.png', { eager: true, import: 'default' });
const CLOUD_URLS = Object.values(cloudImages);

// Hand-placed so the drift feels scattered rather than tiled: each cloud
// picks a different source image, height band, speed, direction and peak
// opacity so no two ever read as the same shape moving in lockstep. `top` is
// scoped to roughly the first viewport, since this lives inside the always-
// fixed color-grade background layer (see App.tsx) and would otherwise sit
// behind every later section too.
interface CloudSpec {
  img: number; // index into CLOUD_URLS
  top: string;
  width: string;
  duration: number;
  delay: number;
  peakOpacity: number;
  direction: 1 | -1;
}

const CLOUDS: CloudSpec[] = [
  { img: 0, top: '2vh',  width: '48vw', duration: 75, delay: -12, peakOpacity: 0.5,  direction: 1 },
  { img: 2, top: '20vh', width: '32vw', duration: 58, delay: -34, peakOpacity: 0.38, direction: -1 },
  { img: 4, top: '-2vh', width: '30vw', duration: 66, delay: -20, peakOpacity: 0.3,  direction: 1 },
  { img: 1, top: '30vh', width: '54vw', duration: 84, delay: -55, peakOpacity: 0.42, direction: -1 },
  { img: 5, top: '11vh', width: '24vw', duration: 50, delay: -6,  peakOpacity: 0.34, direction: 1 },
  { img: 3, top: '38vh', width: '40vw', duration: 70, delay: -44, peakOpacity: 0.26, direction: -1 },
];

// Drawn white/gray cloud shapes drifting slowly through the landing screen's
// fixed background - since they live behind the same color-grade filter as
// everything else, their near-white bodies pick up the current gradient's
// highlight color directly, giving the animated grading actual shapes to
// paint rather than just a subtle texture on the page background.
function OpeningClouds() {
  const clouds = useMemo(() => CLOUDS.filter(c => CLOUD_URLS[c.img]), []);
  return (
    <div className="opening-clouds" aria-hidden="true">
      {clouds.map((c, i) => (
        <img
          key={i}
          src={CLOUD_URLS[c.img]}
          className="opening-clouds__cloud"
          alt=""
          style={{
            top: c.top,
            width: c.width,
            '--drift-duration': `${c.duration}s`,
            '--drift-delay': `${c.delay}s`,
            '--peak-opacity': c.peakOpacity,
            '--drift-direction': c.direction,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export default OpeningClouds;
