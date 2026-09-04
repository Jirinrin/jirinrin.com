import React, { useEffect, useRef } from 'react';

import './OpeningClouds.scss';

// Pre-import the drawn cloud art (Vite replaces require())
const cloudImages = import.meta.glob<string>('../assets/clouds/*.png', { eager: true, import: 'default' });
export const CLOUD_URLS = Object.values(cloudImages);

// `top`/`left` are vh/% offsets from the very top of the page (same
// convention as ServiceBubbles' own AMBIENT_BUBBLES), so a cloud's position
// is just "how far down the document", regardless of which layer renders it.
// `speed` is the parallax factor applied in the scroll handler below: 1 means
// "scrolls at the same rate as the page" (no extra offset), below 1 lags
// behind (reads as further away/higher up), above 1 rushes past faster
// (reads as closer/passing quickly).
export interface CloudSpec {
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

// The foreground set: rendered inside ServiceBubbles, above the name/bubbles'
// own sky, spanning the stretch before the landscape below actually becomes
// visible. See BackgroundClouds.tsx for the rest of the original span, moved
// into the landscape's own color-grade layer instead.
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
];

interface CloudsLayerProps {
  clouds: CloudSpec[];
  layerClassName?: string;
  cloudClassName?: string;
}

// Shared by OpeningClouds (foreground) and BackgroundClouds (landscape-
// blended): drifting cloud art, positioned via vh/% offsets from the top of
// the page, with a scroll-linked parallax offset (each cloud's own `speed`)
// applied directly via ref so it stays independent of the CSS keyframe
// animation on the image inside.
export function CloudsLayer({ clouds, layerClassName = 'opening-clouds', cloudClassName = 'opening-clouds__cloud' }: CloudsLayerProps) {
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Scroll-linked parallax is exactly the kind of motion that can trigger
    // discomfort for motion-sensitive users, so it's skipped entirely here
    // (the clouds still render, just without the differential-speed effect).
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onScroll = () => {
      const y = window.scrollY;
      clouds.forEach((c, i) => {
        const el = layerRefs.current[i];
        if (el) el.style.transform = `translateY(${y * (1 - c.speed)}px)`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [clouds]);

  return (
    <div className={layerClassName} aria-hidden="true">
      {clouds.map((c, i) => (
        <div
          key={i}
          ref={el => { layerRefs.current[i] = el; }}
          className="opening-clouds__layer"
          style={{ top: c.top, left: c.left, width: c.width }}
        >
          <img
            src={CLOUD_URLS[c.img]}
            className={cloudClassName}
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

// Drawn white/gray cloud shapes drifting through the opening section's
// scroll, from the big centered name down toward where the landscape below
// starts showing through. They sit inside ServiceBubbles' own color-grade
// subtree, so their near-white bodies pick up the current gradient's
// highlight color directly - but that subtree is its own isolated
// compositing group (a `filter` on an element isolates its blending from
// everything outside it), so these can only ever visually interact with
// other things in *this* group (the ambient bubbles, the glassy service-
// bubble cards) - never with the landscape's own art, which lives in a
// separate, independently-filtered group. See BackgroundClouds for the
// clouds meant to actually blend with that scenery instead.
function OpeningClouds() {
  return <CloudsLayer clouds={CLOUDS} />;
}

export default OpeningClouds;
