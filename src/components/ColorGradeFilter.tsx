import { useEffect, useMemo, useRef } from 'react';
import { useAppSelector } from '../store';
import { measuredTier } from '../utils/deviceTier';
import {
  buildGradeStops,
  createGradeClock,
  gradeFlatColor,
  gray01,
  rgbToCss,
  stopsToTables,
  TICK_MS,
  type GradeState,
} from './colorGrade/gradeClock';

// Maps the landscape's (and bubbles', and background's) grayscale/near-neutral
// pixels onto a randomly generated dark/mid/light color gradient via an SVG
// feComponentTransfer lookup table - a true per-brightness remap, so even
// literal black can come out as a deep purple or teal rather than staying
// black. On top of that, feColorMatrix continuously hue-rotates the whole
// result, AND the underlying gradient itself slowly blends into a fresh
// random one every GRADE_BLEND_INTERVAL_MS - so the palette is never just
// spinning in place, it's actually evolving.
//
// This intentionally uses a custom SVG filter rather than native CSS filter
// functions (grayscale/sepia/hue-rotate/saturate) - an earlier pass swapped
// to native functions for performance (url()-referenced SVG filters are
// commonly not GPU-shader accelerated), but sepia+hue-rotate can only ever
// produce ONE coherent hue-family duotone (and can never recolor true black,
// since every one of those filter functions preserves (0,0,0)) - a real
// visual downgrade from an actual per-tone gradient.
//
// The palette maths itself lives in colorGrade/gradeClock.ts, not here. This
// component is only the DOM end of it: it owns the <filter> element, runs the
// clock, and writes the results out. Keeping the two apart is what lets the
// flat CSS custom properties below be computed by *the same* code that drives
// the filter, rather than by a lookalike that drifts away from it.
export const COLOR_GRADE_FILTER_ID = 'landscape-color-grade';

// Every element with `filter: url(#landscape-color-grade)` has to be
// re-rasterized on *every* tick, whether or not that element itself is
// otherwise animating - referencing a filter whose own attributes just
// changed forces a repaint of it, full stop. That's a fine cost when only a
// handful of things reference it at once (the landscape image, one open
// popup's background), but the Groove Grove can have a dozen-plus small tint
// overlays (one per visible vinyl) all referencing it simultaneously, and
// paying that cost 6-7 times a second for a dozen elements is what read as
// broad, scroll-independent jank there specifically.
//
// So a second, much cheaper channel exists alongside the live filter: flat CSS
// custom properties holding the *color* a given flat input would currently
// come out as if it really were pushed through the filter (see
// `gradeFlatColor` in gradeClock.ts - same tables, same hue-rotation, just
// evaluated once in JS instead of per-pixel in SVG). Anything that paints one
// colour and has no children can read those instead of ever touching the
// filter. `--color-grade-flat` is written rarely and consumed through a slow
// CSS transition, which is what gives the vinyl tints their drift.
const FLAT_GRADE_TICK_MS = 8_000;

// The link colours, by contrast, are written every tick. They used to ride the
// live filter on the text elements themselves, so this is what keeps them
// moving exactly as they did before - and the thing being removed in exchange
// (an SVG filter re-rasterizing live text glyphs 6-7 times a second) is far
// more expensive than four setProperty calls at the same rate. See Phase 2 of
// COLOR-GRADE-CROSS-BROWSER.md.
//
// Each entry is [css variable, input gray, trailing saturate()] - the inputs
// being the greys these links used to hand to the filter, and the saturate
// being the rest of their old `filter` chain. Reproducing that chain here
// rather than approximating it is the whole point: `filter: url(#...)
// saturate(0.4)` applies saturate to already-graded colour, and gradeFlatColor
// does the same, in the same order.
const LINK_VARS: [name: string, input: number, saturate: number][] = [
  ['--grade-link',             70, 0.4],
  ['--grade-link-hover',       25, 0.4],
  ['--grade-link-dark',       205, 0.4],
  ['--grade-link-dark-hover', 240, 0.4],
];

// Whether the colour grade runs at all on this page load. There are only two things
// left that get decided by a browser's name, and both are about whether the
// technique *works*, never about whether it is fast enough - that second
// question is now measured instead, by the frame-budget watchdog.
//
// Firefox used to be hard-coded off here, on the strength of a comment
// claiming 650-870ms max frame gaps with no version, hardware or methodology
// attached. That was finally re-measured on 2026-09-17, Firefox 155.0
// (20260903215306) on Windows 11 build 26200, Intel Core Ultra 7 155H, with
// hardware WebRender confirmed active (ANGLE -> D3D11 -> NVIDIA, in a separate
// GPU process). Over ~10s captures on both device tiers, with the grade on:
//
//   compositor frame interval   median 16.68ms, max 33.4ms (high) / 35.7ms (low)
//   intervals over 50ms         zero, in either tier, including page load
//   Renderer-thread markers >50ms   zero
//   this component's own JS     4 samples ~ 8ms out of 10,330ms (0.08%)
//
// A flat 60Hz. The old figure did not reproduce in any form; the values in
// that band that do exist in the profiles are a RefreshObserver *registration
// lifetime* marker (872ms, payload "Accessibility notifications") and the
// parent-process refresh driver idling with no chrome UI to animate - neither
// of which is a frame gap. So the Firefox test is gone.
//
// That is still one machine, and a fast one. The condition the old number most
// plausibly came from - software WebRender with no usable GPU, which is what
// the original comment's own "no real GPU available in the sandbox" describes
// - is real and undetectable by user agent. That case is now covered by
// measurement rather than by a guess: see frameBudgetWatchdog.ts, whose
// verdict lands in the shared device tier and is read back here.
//
// Safari (desktop and iOS) stays off, and as of 2026-09-18 we know exactly
// why - it is NOT that WebKit cannot render this filter. Measured on iPad
// Safari with `?gradeprobe=1`, every one of these works there: the filter
// itself, in sRGB, matching the spec prediction exactly; a 5000px-tall
// filtered element; a filter list with a transition on it; will-change:
// filter; a fixed-position filtered element; a filtered element with a
// continuously animating child; and a static child inheriting the grade
// from an ancestor group.
//
// The one thing that does NOT work is the one the page depends on: an
// element that runs a compositable animation is promoted to its own layer,
// and WebKit composites that layer PAST an ancestor filter rather than
// through it. So the landscape art and the clouds - which animate inside
// .color-grade-layer and .ServiceBubbles - render ungraded, while the popup
// and the groove-grove image, which carry `filter: url(#...)` themselves,
// grade correctly. `?gradebisect=noanim` colours the whole page in, which is
// the proof; probes M (static, inherits, coloured) and N (animated,
// inherits, grey) are the isolated repro.
//
// No flattening hint fixes it: isolation, contain: paint, translateZ(0) and
// backface-visibility were all tried on the device and all refused
// (`?gradebisect=fixa`..`fixd`). The remaining approach is to move the
// filter off the groups and onto the leaves, since a promoted layer does
// honour its OWN filter (probe O) - see `?gradebisect=perel2` and
// COLOR-GRADE-CROSS-BROWSER.md. Until that lands and looks right, the
// fallback stays. Re-test on the device, not by editing this.
export function getColorGradeMode(): 'on' | 'off' {
  if (typeof window === 'undefined') return 'off';

  // `?grade=on` / `?grade=off` forces the mode, the same way `?perf=` forces
  // the device tier (see deviceTier.ts). This exists so that checking whether
  // a given engine can actually render the filter does not require editing
  // this function and rebuilding - which is how the stale Firefox verdict
  // above got to be so hard to re-test in the first place. `on` deliberately
  // overrides the reduced-motion check too, since otherwise it cannot be used
  // to test on a device that has reduced motion set at the OS level.
  const forced = new URLSearchParams(window.location.search).get('grade');
  if (forced === 'on') return 'on';
  if (forced === 'off') return 'off';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';

  // A verdict the watchdog measured on a previous visit - on any engine, on
  // this specific machine. Deliberately only the *measured* half of the device
  // tier, not isLowPowerDevice(): that one also counts every phone as low
  // power, and phones render this perfectly well today.
  if (measuredTier() === true) return 'off';

  const ua = navigator.userAgent;
  if (/safari/i.test(ua) && !/chrome|chromium|crios|android/i.test(ua)) return 'off';
  return 'on';
}

/** True when ?grade= pinned the mode, in which case the watchdog must not override it. */
export function isGradeModeForced(): boolean {
  if (typeof window === 'undefined') return false;
  const forced = new URLSearchParams(window.location.search).get('grade');
  return forced === 'on' || forced === 'off';
}

function ColorGradeFilter() {
  const funcRRef = useRef<SVGFEFuncRElement>(null);
  const funcGRef = useRef<SVGFEFuncGElement>(null);
  const funcBRef = useRef<SVGFEFuncBElement>(null);
  const hueRef = useRef<SVGFEColorMatrixElement>(null);

  const initialStops = useMemo(() => buildGradeStops(), []);
  const initialTables = useMemo(() => stopsToTables(initialStops), [initialStops]);

  // With a popup open, the grading needs to visually back off - a loud
  // shifting gradient right behind (or even on top of) a text box makes it
  // hard to read. See `.color-grade-dimmed` in App.scss for the actual
  // response (chains an extra `saturate()` onto the filter list, which - since
  // the list structure stays the same - is what lets a plain CSS transition
  // animate it smoothly without any JS involvement).
  const showPopup = useAppSelector(state => state.currentPage.showPopup);
  useEffect(() => {
    document.body.classList.toggle('color-grade-dimmed', showPopup);
    return () => document.body.classList.remove('color-grade-dimmed');
  }, [showPopup]);

  useEffect(() => {
    const root = document.documentElement;

    const writeLinkVars = (state: GradeState) => {
      for (const [name, input, saturate] of LINK_VARS) {
        root.style.setProperty(name, rgbToCss(gradeFlatColor(gray01(input), state, saturate)));
      }
    };
    const writeFlatVar = (state: GradeState) => {
      root.style.setProperty('--color-grade-flat', rgbToCss(gradeFlatColor(gray01(128), state)));
    };

    const initialState: GradeState = { stops: initialStops, tables: initialTables, hueDeg: 0 };
    writeFlatVar(initialState);
    writeLinkVars(initialState);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const startedAt = performance.now();
    const clock = createGradeClock(initialStops, startedAt);
    let lastTick = -Infinity;
    let lastFlatWrite = 0;
    let frame = 0;

    // rAF rather than setInterval, for two reasons. It stops entirely in a
    // background tab (setInterval is merely throttled to 1Hz), so a tab left
    // open behind another one stops recomputing 75 table values and rewriting
    // four SVG attributes every second for nobody. And setInterval can land
    // mid-frame, letting the SVG attribute write and the custom-property write
    // paint one frame apart - a palette tear between a graded element and the
    // graded background behind it. Here every write for a tick happens
    // synchronously inside one callback, in order.
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const now = performance.now();
      if (now - lastTick < TICK_MS) return;
      lastTick = now;

      const state = clock.sample(now);

      funcRRef.current?.setAttribute('tableValues', state.tables.r.join(' '));
      funcGRef.current?.setAttribute('tableValues', state.tables.g.join(' '));
      funcBRef.current?.setAttribute('tableValues', state.tables.b.join(' '));
      hueRef.current?.setAttribute('values', String(state.hueDeg));

      writeLinkVars(state);

      if (now - lastFlatWrite >= FLAT_GRADE_TICK_MS) {
        lastFlatWrite = now;
        writeFlatVar(state);
      }
    };
    frame = requestAnimationFrame(loop);

    // Clearing the properties on the way out is load-bearing, not tidiness.
    // This component really can unmount mid-session - the frame-budget
    // watchdog downgrades a struggling machine while the page is open (see
    // App.tsx) - and a custom property left behind on :root would keep its
    // last graded value forever. The links and the vinyl tints would go on
    // showing a colour from a palette that is no longer running, on a page
    // that has otherwise just gone black and white: exactly the half-graded
    // look the .color-grade-off fallback exists to prevent. Removing them
    // hands every consumer back to the var() fallback in its own rule.
    return () => {
      cancelAnimationFrame(frame);
      root.style.removeProperty('--color-grade-flat');
      for (const [name] of LINK_VARS) root.style.removeProperty(name);
    };
  }, [initialStops, initialTables]);

  return (
    <svg aria-hidden focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        <filter id={COLOR_GRADE_FILTER_ID} colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncR ref={funcRRef} type="table" tableValues={initialTables.r.join(' ')} />
            <feFuncG ref={funcGRef} type="table" tableValues={initialTables.g.join(' ')} />
            <feFuncB ref={funcBRef} type="table" tableValues={initialTables.b.join(' ')} />
          </feComponentTransfer>
          <feColorMatrix ref={hueRef} type="hueRotate" values="0" />
        </filter>
      </defs>
    </svg>
  );
}

export default ColorGradeFilter;
