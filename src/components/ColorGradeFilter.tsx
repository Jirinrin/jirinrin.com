import { useEffect, useMemo, useRef } from 'react';
import { useAppSelector } from '../store';
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

// Firefox measured 650-870ms max frame gaps with this filter sitting above
// continuously-animating content (vs ~150ms with no filter), independent of
// whether the filter's values ever change - a bad trade for a cosmetic
// effect, so Firefox still gets no color grade rather than a janky one.
// Safari (desktop and iOS) doesn't render this filter at all - it mounts
// but produces no visible effect - so it needs the same off-and-fallback
// treatment rather than silently rendering nothing.
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
  const ua = navigator.userAgent;
  if (/firefox/i.test(ua)) return 'off';
  if (/safari/i.test(ua) && !/chrome|chromium|crios|android/i.test(ua)) return 'off';
  return 'on';
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
    return () => cancelAnimationFrame(frame);
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
