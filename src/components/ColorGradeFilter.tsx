import { useEffect, useMemo, useRef } from 'react';

// Maps the landscape's black->white artwork onto a randomly generated
// dark/mid/light color gradient, picked fresh on every page load, then
// slowly drifts its hue over time for a living, trippy effect.
export const COLOR_GRADE_FILTER_ID = 'landscape-color-grade';

const HUE_ROTATE_PERIOD_MS = 60_000;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)        [r, g, b] = [c, x, 0];
  else if (h < 120)  [r, g, b] = [x, c, 0];
  else if (h < 180)  [r, g, b] = [0, c, x];
  else if (h < 240)  [r, g, b] = [0, x, c];
  else if (h < 300)  [r, g, b] = [x, 0, c];
  else               [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

interface Stop { t: number; h: number; s: number; l: number; }

function buildGradeStops(): Stop[] {
  const h0 = rand(0, 360);
  // Random hue travel across the tonal range: sometimes a moody near-monochrome
  // duotone, sometimes a wild rainbow sweep from shadows to highlights.
  const spread = rand(40, 200) * (Math.random() < 0.5 ? 1 : -1);
  return [
    { t: 0,   h: h0,                s: rand(0.5, 0.85),  l: rand(0.06, 0.16) },
    { t: 0.5, h: h0 + spread * 0.5, s: rand(0.55, 0.9),  l: rand(0.42, 0.58) },
    { t: 1,   h: h0 + spread,       s: rand(0.15, 0.45), l: rand(0.86, 0.97) },
  ];
}

function buildGradeTables(steps = 33) {
  const stops = buildGradeStops();
  const r: number[] = [], g: number[] = [], b: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const [from, to] = t <= 0.5 ? [stops[0], stops[1]] : [stops[1], stops[2]];
    const localT = t <= 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
    const [rr, gg, bb] = hslToRgb(
      lerp(from.h, to.h, localT),
      lerp(from.s, to.s, localT),
      lerp(from.l, to.l, localT),
    );
    r.push(rr); g.push(gg); b.push(bb);
  }
  return { r, g, b };
}

export type ColorGradeMode = 'overlay' | 'scoped' | 'off';

// `backdrop-filter: url(#svgFilter)` only actually recolors the backdrop on
// Chromium engines today; Firefox and Safari accept the syntax (CSS.supports
// even lies and says yes) but silently no-op it. navigator.userAgentData is
// itself a Chromium-only API, so its presence doubles as a proxy for "this
// engine will actually honor the backdrop-filter overlay" -> the full-page
// overlay handles the grading there.
//
// Elsewhere we fall back to a plain `filter: url()` applied directly to the
// landscape/bubbles subtree. That works fine on WebKit, but on Firefox an SVG
// filter sitting above continuously-animating content (the shine/float
// keyframes) forces a full re-composite of the whole filtered subtree every
// single frame those animations tick — measured at 650-870ms max frame gaps
// vs ~150ms with no filter at all, independent of whether the filter's own
// values ever change. That's a bad trade for a cosmetic effect, so Firefox
// gets no color grade rather than a janky one.
export function getColorGradeMode(): ColorGradeMode {
  if (typeof navigator === 'undefined') return 'off';
  if ('userAgentData' in navigator) return 'overlay';
  if (/firefox/i.test(navigator.userAgent)) return 'off';
  return 'scoped';
}

function ColorGradeFilter() {
  const tables = useMemo(() => buildGradeTables(), []);
  const hueRef = useRef<SVGFEColorMatrixElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Re-evaluating the filter chain (component-transfer + hue-rotate) over the
    // whole graded subtree is expensive, especially in Firefox. The rotation is
    // slow enough that updating a few times a second is visually indistinguishable
    // from every frame, but avoids hammering the main thread on every rAF tick.
    const start = performance.now();
    const id = window.setInterval(() => {
      const elapsed = (performance.now() - start) % HUE_ROTATE_PERIOD_MS;
      hueRef.current?.setAttribute('values', String((elapsed / HUE_ROTATE_PERIOD_MS) * 360));
    }, 150);
    return () => clearInterval(id);
  }, []);

  return (
    <svg aria-hidden focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        <filter id={COLOR_GRADE_FILTER_ID} colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncR type="table" tableValues={tables.r.join(' ')} />
            <feFuncG type="table" tableValues={tables.g.join(' ')} />
            <feFuncB type="table" tableValues={tables.b.join(' ')} />
          </feComponentTransfer>
          <feColorMatrix ref={hueRef} type="hueRotate" values="0" />
        </filter>
      </defs>
    </svg>
  );
}

export function ColorGradeOverlay() {
  return <div className="color-grade-overlay" aria-hidden />;
}

export default ColorGradeFilter;
