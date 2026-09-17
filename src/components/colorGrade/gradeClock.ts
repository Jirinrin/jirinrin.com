// The single source of truth for "what colour is the site right now".
//
// Everything that needs to know the current palette reads it from here: the
// live SVG filter's attributes, the flat CSS custom properties that stand in
// for that filter on elements which paint one colour (see Phase 2 in
// COLOR-GRADE-CROSS-BROWSER.md), and any future shader uniforms. Before this
// module existed the SVG path and the flat-colour path each carried their own
// idea of the maths and quietly disagreed - see `gradePixel` below.
//
// Nothing in here touches the DOM. It is pure state + pure functions, so the
// same code can be run from a node script to check it against the SVG spec
// (scripts/verify-grade.mjs).

export interface Stop { h: number; s: number; l: number; }

export interface GradeTables { r: number[]; g: number[]; b: number[]; }

export interface GradeState {
  stops: Stop[];
  tables: GradeTables;
  hueDeg: number;
}

export type Rgb01 = [number, number, number];

export const HUE_ROTATE_PERIOD_MS = 50_000;
export const GRADE_BLEND_INTERVAL_MS = 55_000;
export const GRADE_BLEND_DURATION_MS = 16_000;
export const GRADE_STEPS = 25;

// How often the palette is recomputed and written out. The SVG filter's
// attributes changing forces every element referencing it to re-rasterise, so
// this is a real cost knob - but only for graded groups whose *contents* are
// otherwise static between ticks (the page background, an open popup's
// parchment, the Groove Grove treeline). The three biggest graded groups
// (.color-grade-layer, .ServiceBubbles, .opening-clouds-behind) hold
// permanently-animating content, so they are re-graded every frame their
// contents move no matter what this is set to. Slowing it down helps the
// static groups and the cost of the JS writes; it does nothing for the big
// three. See Phase 4 of COLOR-GRADE-CROSS-BROWSER.md.
export const TICK_MS = 150;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function hslToRgb(h: number, s: number, l: number): Rgb01 {
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

export function buildGradeStops(): Stop[] {
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

export function lerpStops(a: Stop[], b: Stop[], t: number): Stop[] {
  return a.map((s, i) => ({
    h: lerp(s.h, b[i].h, t),
    s: lerp(s.s, b[i].s, t),
    l: lerp(s.l, b[i].l, t),
  }));
}

export function stopsToTables(stops: Stop[], steps = GRADE_STEPS): GradeTables {
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

// ---------------------------------------------------------------------------
// The filter maths, transcribed from the SVG spec rather than approximated
// ---------------------------------------------------------------------------

// feComponentTransfer type="table", per the Filter Effects spec:
//
//   n = tableValues.length;  k = floor(C * (n - 1)), clamped to n - 2 at C = 1
//   C' = v[k] + (C * (n - 1) - k) * (v[k + 1] - v[k])
//
// i.e. piecewise-linear between entries, with the top interval doing double
// duty at exactly C = 1 (otherwise k would index one past the end).
export function tableLookup(c: number, values: number[]): number {
  const n = values.length;
  if (n === 0) return c;
  if (n === 1) return values[0];
  const x = clamp01(c) * (n - 1);
  const k = Math.min(Math.floor(x), n - 2);
  return values[k] + (x - k) * (values[k + 1] - values[k]);
}

type Mat3 = [number, number, number, number, number, number, number, number, number];

// feColorMatrix type="hueRotate", the real 3x3 from the spec. This is NOT the
// same thing as shifting H in HSL: it is a rotation in a luma-preserving plane
// of RGB space, it does not preserve HSL saturation, and it routinely lands
// outside [0,1] - which is why the clamp afterwards is load-bearing rather
// than defensive.
export function hueRotateMatrix(deg: number): Mat3 {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    0.213 + c * 0.787 - s * 0.213,  0.715 - c * 0.715 - s * 0.715,  0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143,  0.715 + c * 0.285 + s * 0.140,  0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787,  0.715 - c * 0.715 + s * 0.715,  0.072 + c * 0.928 + s * 0.072,
  ];
}

// feColorMatrix type="saturate" / the CSS `saturate()` filter function - the
// same matrix, which is what lets the flat-colour path below reproduce a
// `filter: url(#...) saturate(0.4)` chain exactly rather than by eye.
export function saturateMatrix(s: number): Mat3 {
  return [
    0.213 + 0.787 * s,  0.715 - 0.715 * s,  0.072 - 0.072 * s,
    0.213 - 0.213 * s,  0.715 + 0.285 * s,  0.072 - 0.072 * s,
    0.213 - 0.213 * s,  0.715 - 0.715 * s,  0.072 + 0.928 * s,
  ];
}

export function applyMatrix(rgb: Rgb01, m: Mat3): Rgb01 {
  const [r, g, b] = rgb;
  return [
    m[0] * r + m[1] * g + m[2] * b,
    m[3] * r + m[4] * g + m[5] * b,
    m[6] * r + m[7] * g + m[8] * b,
  ];
}

// The whole #landscape-color-grade filter, for one pixel, exactly as the
// browser runs it: per-channel table lookup, then the hue-rotation matrix,
// then clamp. `colorInterpolationFilters="sRGB"` on the <filter> means there
// is no linearisation anywhere in here, which is why this is plain arithmetic
// on the sRGB values and not a gamma round-trip.
//
// This replaces `flatGradeColor`'s old approximation, which took the middle
// stop's raw HSL and shifted its hue in HSL space. That was documented as
// "close enough" but it was measurably not: an HSL hue shift and the spec's
// RGB rotation matrix disagree badly at high saturation, so the
// `--color-grade-flat` tints never actually matched the filter they were
// standing in for. One implementation, one answer.
export function gradePixel(rgb01: Rgb01, state: GradeState): Rgb01 {
  const { tables, hueDeg } = state;
  const afterTable: Rgb01 = [
    tableLookup(rgb01[0], tables.r),
    tableLookup(rgb01[1], tables.g),
    tableLookup(rgb01[2], tables.b),
  ];
  const rotated = applyMatrix(afterTable, hueRotateMatrix(hueDeg));
  return [clamp01(rotated[0]), clamp01(rotated[1]), clamp01(rotated[2])];
}

// A flat colour pushed through the grade and then through a trailing CSS
// `saturate()`, i.e. exactly what `filter: url(#landscape-color-grade)
// saturate(x)` produces for an element that paints one colour. Filter
// functions listed *after* the url() token act on already-graded colour, so
// the order here (grade, then saturate, then clamp) is the browser's order.
export function gradeFlatColor(input: Rgb01, state: GradeState, saturate = 1): Rgb01 {
  const graded = gradePixel(input, state);
  if (saturate === 1) return graded;
  const out = applyMatrix(graded, saturateMatrix(saturate));
  return [clamp01(out[0]), clamp01(out[1]), clamp01(out[2])];
}

export const gray01 = (v255: number): Rgb01 => [v255 / 255, v255 / 255, v255 / 255];

export function rgbToCss([r, g, b]: Rgb01): string {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

// ---------------------------------------------------------------------------
// The clock itself
// ---------------------------------------------------------------------------

export interface GradeClock {
  /** Advance to `now` (a performance.now() timestamp) and return the state there. */
  sample(now: number): GradeState;
  readonly initialStops: Stop[];
}

export function createGradeClock(initialStops: Stop[], startedAt: number): GradeClock {
  let fromStops = initialStops;
  let toStops = buildGradeStops();
  let blendStart = startedAt;

  return {
    initialStops,
    sample(now: number): GradeState {
      const blendElapsed = now - blendStart;
      const blendT = Math.min(1, blendElapsed / GRADE_BLEND_DURATION_MS);
      const stops = blendT >= 1 ? toStops : lerpStops(fromStops, toStops, blendT);
      const tables = stopsToTables(stops);

      if (blendElapsed >= GRADE_BLEND_INTERVAL_MS) {
        fromStops = toStops;
        toStops = buildGradeStops();
        blendStart = now;
      }

      // Phase-based rather than accumulated, so a tab that was backgrounded
      // (where rAF stops entirely, unlike setInterval's 1Hz throttle) comes
      // back to the hue the page *would* be sitting at now, not to wherever it
      // was when it went away. The blend above cannot do the same - its next
      // palette is freshly random and there is no replaying that - so a long
      // absence resolves as one clean landing on the pending palette followed
      // by a fresh blend, rather than a rewind.
      const hueElapsed = (now - startedAt) % HUE_ROTATE_PERIOD_MS;
      const hueDeg = (hueElapsed / HUE_ROTATE_PERIOD_MS) * 360;

      return { stops, tables, hueDeg };
    },
  };
}
