import { useEffect, useMemo, useRef } from 'react';
import { useAppSelector } from '../store';

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
// visual downgrade from an actual per-tone gradient. Given the performance
// claim couldn't be conclusively verified either way (no real GPU available
// in the sandbox this was profiled in) and the visual loss was clear and
// immediate, this reverts to the table-based approach. If it does turn out
// to be too heavy on real hardware, the next lever is reducing GRADE_STEPS/
// update frequency/graded area, not the filter technique itself.
export const COLOR_GRADE_FILTER_ID = 'landscape-color-grade';

const HUE_ROTATE_PERIOD_MS = 50_000;
const GRADE_BLEND_INTERVAL_MS = 55_000;
const GRADE_BLEND_DURATION_MS = 16_000;
const TICK_MS = 150;
const GRADE_STEPS = 25;

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

interface Stop { h: number; s: number; l: number; }

function buildGradeStops(): Stop[] {
  const h0 = rand(0, 360);
  // Random hue travel across the tonal range: sometimes a moody near-monochrome
  // duotone, sometimes a wild rainbow sweep from shadows to highlights - e.g.
  // cyan shadows into magenta highlights, or yellow into blue.
  const spread = rand(60, 260) * (Math.random() < 0.5 ? 1 : -1);
  return [
    // Shadows are kept off pure black and away from max saturation - a
    // near-black + fully-saturated (esp. red/purple) shadow reads as
    // "evil"/horror rather than trippy, so the floor is raised and the
    // saturation ceiling capped a bit.
    { h: h0,                s: rand(0.45, 0.75), l: rand(0.14, 0.24) },
    { h: h0 + spread * 0.5, s: rand(0.65, 0.95), l: rand(0.42, 0.58) },
    { h: h0 + spread,       s: rand(0.35, 0.65), l: rand(0.8, 0.92) },
  ];
}

function lerpStops(a: Stop[], b: Stop[], t: number): Stop[] {
  return a.map((s, i) => ({
    h: lerp(s.h, b[i].h, t),
    s: lerp(s.s, b[i].s, t),
    l: lerp(s.l, b[i].l, t),
  }));
}

function stopsToTables(stops: Stop[], steps = GRADE_STEPS) {
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

// Firefox measured 650-870ms max frame gaps with this filter sitting above
// continuously-animating content (vs ~150ms with no filter), independent of
// whether the filter's values ever change - a bad trade for a cosmetic
// effect, so Firefox still gets no color grade rather than a janky one.
export function getColorGradeMode(): 'on' | 'off' {
  if (typeof window === 'undefined') return 'off';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';
  if (/firefox/i.test(navigator.userAgent)) return 'off';
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let fromStops = initialStops;
    let toStops = buildGradeStops();
    let blendStart = performance.now();
    const hueStart = performance.now();

    const id = window.setInterval(() => {
      const now = performance.now();

      const blendElapsed = now - blendStart;
      const blendT = Math.min(1, blendElapsed / GRADE_BLEND_DURATION_MS);
      const currentStops = blendT >= 1 ? toStops : lerpStops(fromStops, toStops, blendT);
      const tables = stopsToTables(currentStops);
      funcRRef.current?.setAttribute('tableValues', tables.r.join(' '));
      funcGRef.current?.setAttribute('tableValues', tables.g.join(' '));
      funcBRef.current?.setAttribute('tableValues', tables.b.join(' '));

      if (blendElapsed >= GRADE_BLEND_INTERVAL_MS) {
        fromStops = toStops;
        toStops = buildGradeStops();
        blendStart = now;
      }

      const hueElapsed = (now - hueStart) % HUE_ROTATE_PERIOD_MS;
      hueRef.current?.setAttribute('values', String((hueElapsed / HUE_ROTATE_PERIOD_MS) * 360));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [initialStops]);

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
