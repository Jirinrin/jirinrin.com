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
  // Per-cloud override for CloudsLayerProps.glass below - lets a layer opt
  // individual clouds out of the backing+glass panes (the priciest part of
  // each cloud, being a masked backdrop-filter) rather than being all-or-
  // nothing for the whole layer. Meant for the biggest/faintest clouds, where
  // the color-pop is least visible anyway and the backdrop-filter area is
  // largest.
  glass?: boolean;
}

// The foreground set: rendered inside ServiceBubbles, above the name/bubbles'
// own sky, spanning the stretch before the landscape below actually becomes
// visible. See BackgroundClouds.tsx for the rest of the original span, moved
// into the landscape's own color-grade layer instead.
//
// Sizes/opacities scaled up from an earlier, much daintier pass (was ~9-32vw
// at 0.26-0.4 peak) without touching the cloud *count* - same 19 clouds, each
// one just covering noticeably more of the screen and reading as more solid,
// so the hero sky feels a lot fuller without any more moving parts to pay for.
const CLOUDS: CloudSpec[] = [
  { img: 0, top: '0vh',   left: '6%',  width: '50vw', speed: 0.55, duration: 48, delay: -4,  peakOpacity: 0.58, direction: 1 },
  { img: 3, top: '4vh',   left: '68%', width: '24vw', speed: 1.3,  duration: 30, delay: -18, peakOpacity: 0.46, direction: -1 },
  { img: 1, top: '14vh',  left: '38%', width: '20vw', speed: 0.9,  duration: 34, delay: -9,  peakOpacity: 0.43, direction: 1 },
  { img: 5, top: '20vh',  left: '82%', width: '30vw', speed: 0.6,  duration: 42, delay: -25, peakOpacity: 0.49, direction: -1 },
  { img: 2, top: '28vh',  left: '10%', width: '17vw', speed: 1.5,  duration: 26, delay: -3,  peakOpacity: 0.43, direction: 1 },
  { img: 4, top: '34vh',  left: '55%', width: '25vw', speed: 0.8,  duration: 36, delay: -30, peakOpacity: 0.41, direction: 1 },
  { img: 0, top: '42vh',  left: '25%', width: '34vw', speed: 1.15, duration: 38, delay: -14, peakOpacity: 0.46, direction: -1 },
  { img: 3, top: '50vh',  left: '75%', width: '19vw', speed: 0.7,  duration: 28, delay: -21, peakOpacity: 0.43, direction: 1 },
  { img: 1, top: '58vh',  left: '4%',  width: '50vw', speed: 0.5,  duration: 52, delay: -36, peakOpacity: 0.58, direction: -1 },
  { img: 5, top: '66vh',  left: '45%', width: '16vw', speed: 1.4,  duration: 24, delay: -7,  peakOpacity: 0.41, direction: 1 },
  { img: 2, top: '74vh',  left: '65%', width: '22vw', speed: 0.85, duration: 32, delay: -16, peakOpacity: 0.43, direction: -1 },
  { img: 4, top: '82vh',  left: '15%', width: '27vw', speed: 1.05, duration: 40, delay: -28, peakOpacity: 0.46, direction: 1 },
  { img: 0, top: '92vh',  left: '85%', width: '17vw', speed: 0.65, duration: 30, delay: -11, peakOpacity: 0.41, direction: -1 },
  { img: 3, top: '102vh', left: '30%', width: '40vw', speed: 1.2,  duration: 44, delay: -33, peakOpacity: 0.49, direction: 1 },
  { img: 1, top: '112vh', left: '58%', width: '16vw', speed: 0.75, duration: 27, delay: -5,  peakOpacity: 0.38, direction: -1 },
  { img: 5, top: '122vh', left: '8%',  width: '24vw', speed: 1.35, duration: 33, delay: -20, peakOpacity: 0.43, direction: 1 },
  // A few extras filling in the gaps between the rows above - trimmed back
  // from a denser first pass, which made the near set feel too busy.
  { img: 1, top: '9vh',   left: '22%', width: '27vw', speed: 1.1,  duration: 25, delay: -6,  peakOpacity: 0.43, direction: -1 },
  { img: 2, top: '38vh',  left: '5%',  width: '44vw', speed: 0.7,  duration: 46, delay: -19, peakOpacity: 0.52, direction: -1 },
  { img: 5, top: '96vh',  left: '55%', width: '19vw', speed: 1.45, duration: 23, delay: -13, peakOpacity: 0.41, direction: 1 },
];

// A second, sparser layer of much bigger clouds (up to ~60vw, vs. the ~16-50vw
// near set) at a fraction of the opacity - interleaved with the set above
// rather than replacing any of it, so the hero reads as having real depth:
// crisp shapes up close, huge pale ones drifting far overhead. Slower
// durations throughout (50-88s vs. 22-52s above) so their sheer size doesn't
// read as darting around - something that big should feel like it's barely
// moving, the way real high clouds do.
//
// Sizes/opacities scaled up the same way as the near set above (same 16
// clouds, more screen each), though by a smaller factor and staying well
// below the near set's peak opacity - these still need to read as farther
// away, just less faint about it than before.
//
// Half of these opt out of `glass` (see CloudSpec/CloudsLayer): a masked
// backdrop-filter costs roughly per pixel of its own footprint, so the
// biggest, faintest clouds here are simultaneously the most expensive ones to
// give it to and the least likely for anyone to actually notice the color-pop
// on, given how transparent and blurred they already are.
const LARGE_CLOUDS: CloudSpec[] = [
  { img: 2, top: '2vh',   left: '48%', width: '51vw', speed: 0.35, duration: 70, delay: -12, peakOpacity: 0.22, direction: 1 },
  { img: 5, top: '16vh',  left: '78%', width: '32vw', speed: 0.5,  duration: 60, delay: -40, peakOpacity: 0.26, direction: -1 },
  { img: 0, top: '30vh',  left: '2%',  width: '40vw', speed: 0.4,  duration: 65, delay: -22, peakOpacity: 0.19, direction: -1, glass: false },
  { img: 3, top: '44vh',  left: '58%', width: '54vw', speed: 0.3,  duration: 80, delay: -55, peakOpacity: 0.16, direction: 1,  glass: false },
  { img: 1, top: '60vh',  left: '18%', width: '35vw', speed: 0.55, duration: 58, delay: -8,  peakOpacity: 0.24, direction: 1 },
  { img: 4, top: '76vh',  left: '70%', width: '46vw', speed: 0.45, duration: 72, delay: -48, peakOpacity: 0.21, direction: -1 },
  { img: 2, top: '92vh',  left: '4%',  width: '30vw', speed: 0.6,  duration: 55, delay: -30, peakOpacity: 0.26, direction: 1 },
  { img: 5, top: '108vh', left: '42%', width: '49vw', speed: 0.38, duration: 76, delay: -18, peakOpacity: 0.18, direction: -1, glass: false },
  // Second pass: denser still, and pushing the top end of the size range
  // further out (a couple of genuinely huge, barely-there ones) for more
  // sense of scale/depth up top.
  { img: 1, top: '8vh',   left: '8%',  width: '59vw', speed: 0.32, duration: 85, delay: -60, peakOpacity: 0.16, direction: -1, glass: false },
  { img: 4, top: '22vh',  left: '55%', width: '27vw', speed: 0.65, duration: 50, delay: -5,  peakOpacity: 0.27, direction: 1 },
  { img: 0, top: '38vh',  left: '88%', width: '38vw', speed: 0.42, duration: 62, delay: -35, peakOpacity: 0.21, direction: -1, glass: false },
  { img: 3, top: '52vh',  left: '34%', width: '60vw', speed: 0.28, duration: 88, delay: -70, peakOpacity: 0.14, direction: 1,  glass: false },
  { img: 5, top: '68vh',  left: '6%',  width: '27vw', speed: 0.58, duration: 52, delay: -15, peakOpacity: 0.26, direction: -1 },
  { img: 2, top: '84vh',  left: '60%', width: '40vw', speed: 0.44, duration: 66, delay: -42, peakOpacity: 0.19, direction: 1,  glass: false },
  { img: 4, top: '100vh', left: '20%', width: '32vw', speed: 0.5,  duration: 58, delay: -25, peakOpacity: 0.22, direction: -1 },
  // Dropped: top 118vh (this set's highest) combined with the lowest speed
  // in the array (0.36) meant this one hadn't caught up to being scrolled
  // off by the time the page was scrolled all the way down - it was still
  // sitting bottom-right, over the landscape's spiral-tower, looking like a
  // pale/gray smudge (this set only ever picks up ServiceBubbles' own pale
  // palette, never the landscape's actual colors - see the CloudsLayer/
  // OpeningClouds comments above) instead of blending in like BackgroundClouds'
  // properly-colored clouds do.
];

interface CloudsLayerProps {
  clouds: CloudSpec[];
  layerClassName?: string;
  cloudClassName?: string;
  // Adds a "glass" pane, masked to the cloud's own silhouette, that sits on
  // top of the cloud image and applies backdrop-filter: saturate() to
  // whatever's rendered behind it. This is the actual mechanism behind the
  // service-bubble cards' "trippy" look (their glassy backdrop-filter
  // sampling+saturating the color-graded content behind them) - a plain
  // mix-blend-mode on the cloud doesn't reproduce it, since blending a
  // near-white source mostly just washes toward white rather than picking up
  // the backdrop's actual hue. Only meaningful where there's something
  // colorful already painted behind the cloud within the *same* isolated
  // filter group - see BackgroundClouds.
  glass?: boolean;
}

// Shared by OpeningClouds (foreground) and BackgroundClouds (landscape-
// blended): drifting cloud art, positioned via vh/% offsets from the top of
// the page, with a scroll-linked parallax offset (each cloud's own `speed`)
// applied directly via ref so it stays independent of the CSS keyframe
// animation on the image inside.
export function CloudsLayer({ clouds, layerClassName = 'opening-clouds', cloudClassName = 'opening-clouds__cloud', glass = false }: CloudsLayerProps) {
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
      {clouds.map((c, i) => {
        const maskUrl = `url(${CLOUD_URLS[c.img]})`;
        const cloudGlass = c.glass ?? glass;
        return (
          <div
            key={i}
            ref={el => { layerRefs.current[i] = el; }}
            className="opening-clouds__layer"
            style={{
              top: c.top,
              left: c.left,
              width: c.width,
              // Set here (rather than on the <img> directly) so the glass
              // pane below - a sibling, not a descendant, of the image -
              // inherits the same drift timing via plain CSS custom property
              // inheritance and stays glued to the image's silhouette as it
              // sways, instead of drifting out of alignment with it.
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
              '--cloud-mask': maskUrl,
            } as React.CSSProperties}
          >
            {/* Behind the cloud image itself, masked to the exact same
                silhouette - gives the glass pane below real (if flat/small)
                content of its own to grab within this isolated filter group,
                without making anything bigger than the cloud's own shape
                opaque (compare .color-grade-layer/.ServiceBubbles' own
                section-wide backdrops - those are safe where nothing else
                needs to show through, but here Navbar and the landscape both
                sit right behind this section, so only the cloud's own
                footprint can afford to stop being transparent). */}
            {cloudGlass && <div className="opening-clouds__backing" />}
            <img
              src={CLOUD_URLS[c.img]}
              className={cloudClassName}
              alt=""
            />
            {cloudGlass && <div className="opening-clouds__glass" />}
          </div>
        );
      })}
    </div>
  );
}

// Drawn white/gray cloud shapes drifting through the opening section's
// scroll, from the big centered name down toward where the landscape below
// starts showing through. They sit inside ServiceBubbles' own color-grade
// subtree, which is its own isolated compositing group (a `filter` on an
// element isolates blending from everything outside it) - so `glass` here
// only ever picks up color from what's actually painted inside *this* group
// (ServiceBubbles' own graded backdrop, see its .scss, plus the ambient/
// service-bubble cards), never the landscape's own art, which lives in a
// separate, independently-filtered group. See BackgroundClouds for the
// clouds meant to blend with that scenery instead.
//
// `--legible` (see the .scss) keeps these clouds visible over the navbar
// (a z-index tie broken by DOM order, see ServiceBubbles.scss) without
// painting fully opaque over its white text - only applied here, not on
// BackgroundClouds, whose glass panes are deliberately kept at full
// strength for the landscape's own color-pop effect.
//
// Rendered as two separate layers rather than one merged list: the near set
// (CLOUDS) and the big, faint, far-off set (LARGE_CLOUDS, see above) each get
// their own scroll listener and DOM subtree, and the large ones get an extra
// class on just the cloud `<img>` for a softer look befitting something that
// size (the backing/glass panes stay exactly as strong as the near set's, so
// they still pick up real color - only the drawn cloud art itself softens).
function OpeningClouds() {
  return (
    <>
      <CloudsLayer clouds={CLOUDS} glass layerClassName="opening-clouds opening-clouds--legible" />
      <CloudsLayer
        clouds={LARGE_CLOUDS}
        glass
        layerClassName="opening-clouds opening-clouds--legible"
        cloudClassName="opening-clouds__cloud opening-clouds__cloud--large"
      />
    </>
  );
}

export default OpeningClouds;
