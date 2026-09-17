import React, { useEffect, useRef } from 'react';

import { isLowPowerDevice } from '../utils/deviceTier';

import './OpeningClouds.scss';

// Pre-import the drawn cloud art (Vite replaces require()). Two variants of
// each cloud, both generated from the source PNGs by scripts/optimize-assets.mjs:
// `cloud-N.webp` is the crisp art (also what every layer's CSS mask reads
// its silhouette from), and `cloud-N-soft.webp` is the same art with the
// blur pre-baked that the big far-off sets used to get from a per-element
// `filter: blur(3px)` (see the .scss for why that got expensive). Both have
// the old `brightness(1.05)` baked in too. Sorted by name so index N-1 is
// cloud N in both lists.
const byName = (o: Record<string, string>) => Object.keys(o).sort().map(k => o[k]);
export const CLOUD_URLS = byName(import.meta.glob<string>('../assets/clouds/cloud-[0-9].webp', { eager: true, import: 'default' }));
const SOFT_CLOUD_URLS = byName(import.meta.glob<string>('../assets/clouds/cloud-[0-9]-soft.webp', { eager: true, import: 'default' }));

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
const LARGE_CLOUDS: CloudSpec[] = [
  { img: 2, top: '2vh',   left: '48%', width: '51vw', speed: 0.35, duration: 70, delay: -12, peakOpacity: 0.22, direction: 1 },
  { img: 5, top: '16vh',  left: '78%', width: '32vw', speed: 0.5,  duration: 60, delay: -40, peakOpacity: 0.26, direction: -1 },
  { img: 0, top: '30vh',  left: '2%',  width: '40vw', speed: 0.4,  duration: 65, delay: -22, peakOpacity: 0.19, direction: -1 },
  { img: 3, top: '44vh',  left: '58%', width: '54vw', speed: 0.3,  duration: 80, delay: -55, peakOpacity: 0.16, direction: 1 },
  { img: 1, top: '60vh',  left: '18%', width: '35vw', speed: 0.55, duration: 58, delay: -8,  peakOpacity: 0.24, direction: 1 },
  { img: 4, top: '76vh',  left: '70%', width: '46vw', speed: 0.45, duration: 72, delay: -48, peakOpacity: 0.21, direction: -1 },
  { img: 2, top: '92vh',  left: '4%',  width: '30vw', speed: 0.6,  duration: 55, delay: -30, peakOpacity: 0.26, direction: 1 },
  { img: 5, top: '108vh', left: '42%', width: '49vw', speed: 0.38, duration: 76, delay: -18, peakOpacity: 0.18, direction: -1 },
  // Second pass: denser still, and pushing the top end of the size range
  // further out (a couple of genuinely huge, barely-there ones) for more
  // sense of scale/depth up top.
  { img: 1, top: '8vh',   left: '8%',  width: '59vw', speed: 0.32, duration: 85, delay: -60, peakOpacity: 0.16, direction: -1 },
  { img: 4, top: '22vh',  left: '55%', width: '27vw', speed: 0.65, duration: 50, delay: -5,  peakOpacity: 0.27, direction: 1 },
  { img: 0, top: '38vh',  left: '88%', width: '38vw', speed: 0.42, duration: 62, delay: -35, peakOpacity: 0.21, direction: -1 },
  { img: 3, top: '52vh',  left: '34%', width: '60vw', speed: 0.28, duration: 88, delay: -70, peakOpacity: 0.14, direction: 1 },
  { img: 5, top: '68vh',  left: '6%',  width: '27vw', speed: 0.58, duration: 52, delay: -15, peakOpacity: 0.26, direction: -1 },
  { img: 2, top: '84vh',  left: '60%', width: '40vw', speed: 0.44, duration: 66, delay: -42, peakOpacity: 0.19, direction: 1 },
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

// A third layer, behind both sets above: just a couple of genuinely
// screen-filling clouds, at very low opacity, meant to read as an almost-
// solid haze right at the top of the page rather than as individual shapes.
// This is what pushes the hero's existing "dense to sparse" scroll
// progression further at its densest end - CLOUDS/LARGE_CLOUDS alone already
// thin out nicely lower down, but the very top could still read as "a sky
// with clouds in it" rather than "a field of cloud, with sky barely showing
// through". Concentrated in the first ~40vh (rather than spread the full
// page height like the sets above) and wide enough (up to 130vw) to guarantee
// full horizontal coverage regardless of viewport width, so there's no seam
// at the screen edges for the background to leak through.
//
// Kept to just 3 clouds - at 90-110vw each, they're the most expensive thing
// in the hero to blur and to keep promoted as their own compositing layers,
// and any more wouldn't read as more "atmosphere" anyway.
const HUGE_CLOUDS: CloudSpec[] = [
  { img: 3, top: '-6vh',  left: '-15%', width: '95vw',  speed: 0.22, duration: 100, delay: -50, peakOpacity: 0.12, direction: 1 },
  { img: 0, top: '2vh',   left: '35%',  width: '110vw', speed: 0.18, duration: 115, delay: -80, peakOpacity: 0.1,  direction: -1 },
  { img: 4, top: '14vh',  left: '-25%', width: '90vw',  speed: 0.25, duration: 95,  delay: -20, peakOpacity: 0.13, direction: 1 },
];

interface CloudsLayerProps {
  clouds: CloudSpec[];
  layerClassName?: string;
  cloudClassName?: string;
  // Adds a "glass" pane, masked to the cloud's own silhouette, that sits on
  // top of the cloud image and applies backdrop-filter: saturate() to
  // whatever's rendered behind it - the service-bubble cards' "trippy" look,
  // applied to a cloud.
  //
  // This is worth its (considerable - a backdrop-filter forces a snapshot and
  // re-filter of the region behind it, which can't be cached across frames
  // the way an ordinary filter can) cost ONLY where there is something
  // genuinely colorful already painted behind the cloud within the *same*
  // isolated filter group. That's true for BackgroundClouds, which shares a
  // group with the landscape art itself, and false for OpeningClouds, whose
  // group (.ServiceBubbles) has no background of its own at all - there, the
  // only thing behind a cloud is its own near-neutral `__backing` swatch, so
  // saturate()ing it 3.5x achieves almost nothing at maximum expense. Those
  // layers get their color from the grade itself instead; see __backing.
  glass?: boolean;
  // Dissolves the whole layer as its own bottom edge - which is where the
  // landscape below begins - comes into view. Without it the slowest clouds
  // (speed 0.18-0.35 means they barely move against the page) are still
  // sitting on screen long after the landscape has scrolled up behind them,
  // reading as pale smudges over the scenery: they only ever pick up
  // ServiceBubbles' own palette, never the landscape's, so they can't blend
  // with it the way BackgroundClouds does. Only the opening sets want this;
  // BackgroundClouds is *meant* to sit over the landscape.
  fadeAtSectionEnd?: boolean;
  // Draw the pre-blurred variant of each cloud's art (the mask stays crisp).
  // What the --large/--huge sets use instead of a live CSS blur.
  soft?: boolean;
}

// Shared by OpeningClouds (foreground) and BackgroundClouds (landscape-
// blended): drifting cloud art, positioned via vh/% offsets from the top of
// the page, with a scroll-linked parallax offset (each cloud's own `speed`)
// applied directly via ref so it stays independent of the CSS keyframe
// animation on the image inside.
export function CloudsLayer({ clouds, layerClassName = 'opening-clouds', cloudClassName = 'opening-clouds__cloud', glass = false, fadeAtSectionEnd = false, soft = false }: CloudsLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Scroll-linked parallax is exactly the kind of motion that can trigger
    // discomfort for motion-sensitive users, so it's skipped for them (the
    // clouds still render, just without the differential-speed effect). The
    // fade below still runs: it's a plain opacity ramp, not motion, and
    // without it those users would just get clouds stuck over the landscape.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion && !fadeAtSectionEnd) return;

    // The actual work, run at most once per animation frame (see onScroll
    // below) so these writes land in sync with paint. Without that, a
    // `scroll` event fired off-frame - which Firefox does far more readily
    // than Chromium, whose scroll dispatch tends to already track its
    // compositor frame cadence - means these transforms get set mid-frame,
    // which is exactly what reads as jagged/juddery here despite the exact
    // same code being smooth on Chromium.
    const update = () => {
      rafId = null;
      // Layout read first, writes after - measuring once the transforms below
      // have been set would force a synchronous reflow every scroll tick.
      const root = rootRef.current;
      if (fadeAtSectionEnd && root) {
        const vh = window.innerHeight;
        // This layer spans its whole section (inset: 0), so its bottom edge is
        // where the landscape below begins. Measured in viewport heights from
        // that edge rather than in scroll position, so the same numbers hold
        // for both section heights (see .service-bubbles-fade's breakpoint).
        // Full strength until the landscape is ~0.9vh below the fold, fully
        // gone a little before the page bottoms out - by which point
        // BackgroundClouds, which actually blends with the scenery, has taken
        // over.
        const distance = root.getBoundingClientRect().bottom - vh * 1.15;
        root.style.opacity = String(Math.min(1, Math.max(0, distance / (vh * 0.75))));
      }

      if (reduceMotion) return;
      const y = window.scrollY;
      clouds.forEach((c, i) => {
        const el = layerRefs.current[i];
        if (el) el.style.transform = `translateY(${y * (1 - c.speed)}px)`;
      });
    };
    let rafId: number | null = null;
    const onScroll = () => {
      // Coalesce bursts of `scroll` events into a single update per frame,
      // rather than running the (getBoundingClientRect + up to ~19 style
      // writes) work once per event.
      if (rafId == null) rafId = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [clouds, fadeAtSectionEnd]);

  return (
    <div className={layerClassName} ref={rootRef} aria-hidden="true">
      {clouds.map((c, i) => {
        const maskUrl = `url(${CLOUD_URLS[c.img]})`;
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
                silhouette. This is what actually makes these clouds colorful
                (see .opening-clouds__backing in the .scss for the full why) -
                never optional, since without it a cloud has nothing but its
                own near-white art for the grade to read and comes out a flat
                white smudge. It only ever covers the cloud's own footprint,
                so Navbar and the landscape still show through everywhere
                else (compare .color-grade-layer/.ServiceBubbles' own
                section-wide backdrops - those are safe where nothing needs to
                show through, which isn't the case here). */}
            <div className="opening-clouds__backing" />
            <img
              src={(soft ? SOFT_CLOUD_URLS : CLOUD_URLS)[c.img]}
              className={cloudClassName}
              alt=""
            />
            {glass && <div className="opening-clouds__glass" />}
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
// element isolates blending from everything outside it) - and that group has
// no background of its own (see ServiceBubbles.scss), so there is nothing
// colorful behind these clouds to sample. That's why none of these layers
// pass `glass`: their color comes from the grade reading each cloud's own
// __backing+art composite, not from a backdrop-filter. See BackgroundClouds
// for the set that does share a group with the landscape art, where a glass
// pane has something real to grab and earns its cost.
//
// `--legible` (see the .scss) thins each cloud's backing so it never paints
// opaquely over the navbar's white text. Only the near set below still
// crosses in front of the navbar at all (see OpeningCloudsFar), but the far
// sets keep the same class so all three stay tonally identical - that backing
// opacity is also the knob controlling how vivid the grade renders them.
//
// Rendered as separate layers rather than one merged list: each set gets its
// own scroll listener and DOM subtree, and the two bigger sets get an extra
// class on just the cloud `<img>` for a softer look befitting something that
// size (the backing stays exactly as strong as the near set's, so they still
// pick up real color - only the drawn cloud art itself softens).
//
// Every cloud here is two large translucent compositor layers (backing +
// art) that animate forever, so the sheer *count* is what a weak GPU pays
// for - a phone at 2x DPR can easily be holding a couple hundred MB of cloud
// textures for the full set. Low-power devices (see deviceTier.ts) therefore
// get a thinned version: the near set loses the three gap-fillers at the end
// of CLOUDS (the ones a denser first pass was already trimmed back from), the
// far set keeps every other cloud, and the huge haze layer - the three most
// expensive layers on the page - is dropped entirely. Same look, same
// palette, just fewer clouds; it's the difference between a hero that
// drifts and one that stutters there.
const LOW_POWER = isLowPowerDevice();
const NEAR_CLOUDS = LOW_POWER ? CLOUDS.slice(0, 16) : CLOUDS;
const FAR_CLOUDS = LOW_POWER ? LARGE_CLOUDS.filter((_, i) => i % 2 === 0) : LARGE_CLOUDS;

function OpeningClouds() {
  return <CloudsLayer clouds={NEAR_CLOUDS} fadeAtSectionEnd layerClassName="opening-clouds opening-clouds--legible" />;
}

// The two big sets, split out so they can be mounted in their own wrapper
// *behind* the navbar (see ServiceBubbles.tsx/.scss) while the near set above
// keeps drifting in front of it. They can't simply be given a lower z-index
// in place: .ServiceBubbles has both a z-index and a `filter`, so it's a
// single stacking context and everything inside it paints above or below the
// navbar as one unit.
//
// Being a separate compositing group costs these nothing, since each cloud's
// color comes from its own backing plus the grade rather than from sampling
// anything around it - they grade identically wherever they're mounted.
//
// HUGE_CLOUDS renders first so it paints behind LARGE_CLOUDS (DOM order, no
// z-index involved between the two).
export function OpeningCloudsFar() {
  return (
    <>
      {!LOW_POWER && (
        <CloudsLayer
          clouds={HUGE_CLOUDS}
          fadeAtSectionEnd
          soft
          layerClassName="opening-clouds opening-clouds--legible"
          cloudClassName="opening-clouds__cloud opening-clouds__cloud--huge"
        />
      )}
      <CloudsLayer
        clouds={FAR_CLOUDS}
        fadeAtSectionEnd
        soft
        layerClassName="opening-clouds opening-clouds--legible"
        cloudClassName="opening-clouds__cloud opening-clouds__cloud--large"
      />
    </>
  );
}

export default OpeningClouds;
