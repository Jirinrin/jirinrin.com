// Checks that src/components/colorGrade/gradeClock.ts really is the SVG filter
// spec and not a lookalike. Run it by hand:
//
//   node --experimental-strip-types scripts/verify-grade.mjs
//
// (on Node 22.18+ the flag is the default and can be dropped.)
//
// This is the thing that makes "exactly the current style" checkable rather
// than eyeballed. The reference implementations below are deliberately written
// a *different* way from the ones they check - the table lookup walks segments
// instead of doing floor arithmetic, and the hue matrix is assembled from the
// spec's own A + cos*B + sin*C decomposition instead of the pre-expanded
// constants - so a transcription slip in either copy shows up as a mismatch
// rather than being duplicated into both.

import {
  buildGradeStops,
  gradeFlatColor,
  gradePixel,
  gray01,
  hueRotateMatrix,
  saturateMatrix,
  stopsToTables,
  tableLookup,
  GRADE_STEPS,
} from '../src/components/colorGrade/gradeClock.ts';

const TOL = 1 / 255;
let failures = 0;
let checks = 0;

function check(name, actual, tol = TOL) {
  checks++;
  const ok = actual <= tol;
  if (!ok) failures++;
  const verdict = ok ? 'PASS' : 'FAIL';
  console.log(`  [${verdict}] ${name}  (max delta ${actual.toExponential(3)}, tol ${tol.toExponential(3)})`);
}

// --- reference implementations ---------------------------------------------

// feComponentTransfer type="table", written as an explicit walk over the n-1
// segments rather than via floor(). Same function, different arithmetic.
function refTableLookup(c, v) {
  const n = v.length;
  if (n === 0) return c;
  if (n === 1) return v[0];
  const x = Math.min(1, Math.max(0, c));
  if (x >= 1) return v[n - 1];
  const seg = 1 / (n - 1);
  for (let k = 0; k < n - 1; k++) {
    const lo = k * seg;
    const hi = (k + 1) * seg;
    if (x >= lo && x < hi) return v[k] + ((x - lo) / seg) * (v[k + 1] - v[k]);
  }
  return v[n - 1];
}

// The spec's hueRotate as three separate matrices summed, per
// https://www.w3.org/TR/filter-effects-1/#feColorMatrixElement
const HUE_A = [0.213, 0.715, 0.072, 0.213, 0.715, 0.072, 0.213, 0.715, 0.072];
const HUE_B = [0.787, -0.715, -0.072, -0.213, 0.285, -0.072, -0.213, -0.715, 0.928];
const HUE_C = [-0.213, -0.715, 0.928, 0.143, 0.140, -0.283, -0.787, 0.715, 0.072];

function refHueMatrix(deg) {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return HUE_A.map((a, i) => a + c * HUE_B[i] + s * HUE_C[i]);
}

function refApply(rgb, m) {
  return [
    m[0] * rgb[0] + m[1] * rgb[1] + m[2] * rgb[2],
    m[3] * rgb[0] + m[4] * rgb[1] + m[5] * rgb[2],
    m[6] * rgb[0] + m[7] * rgb[1] + m[8] * rgb[2],
  ];
}

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

function refGradePixel(rgb, state) {
  const t = [
    refTableLookup(rgb[0], state.tables.r),
    refTableLookup(rgb[1], state.tables.g),
    refTableLookup(rgb[2], state.tables.b),
  ];
  return refApply(t, refHueMatrix(state.hueDeg)).map(clamp01);
}

// --- fixtures ---------------------------------------------------------------

// A fixed set of palettes plus random ones: the fixed ones make a regression
// reproducible, the random ones stop the whole thing from passing by accident
// on a palette that happens to be forgiving.
const PALETTES = [
  [{ h: 0, s: 0.6, l: 0.18 }, { h: 120, s: 0.8, l: 0.5 }, { h: 240, s: 0.5, l: 0.86 }],
  [{ h: 350, s: 0.75, l: 0.14 }, { h: 200, s: 0.95, l: 0.58 }, { h: 40, s: 0.35, l: 0.92 }],
  [{ h: 60, s: 0.45, l: 0.24 }, { h: 60, s: 0.65, l: 0.42 }, { h: 60, s: 0.65, l: 0.8 }],
  ...Array.from({ length: 12 }, () => buildGradeStops()),
];
const HUES = [0, 1.08, 37, 90, 180, 270, 359.2, 360];
const RAMP = Array.from({ length: 256 }, (_, i) => i / 255);

const states = [];
for (const stops of PALETTES) {
  const tables = stopsToTables(stops);
  for (const hueDeg of HUES) states.push({ stops, tables, hueDeg });
}

console.log(`\nverify-grade: ${PALETTES.length} palettes x ${HUES.length} hue angles x ${RAMP.length} ramp steps\n`);

// --- 1. the table lookup ----------------------------------------------------

console.log('feComponentTransfer type="table"');
{
  let max = 0;
  for (const st of states) {
    for (const c of RAMP) {
      max = Math.max(max, Math.abs(tableLookup(c, st.tables.r) - refTableLookup(c, st.tables.r)));
      max = Math.max(max, Math.abs(tableLookup(c, st.tables.g) - refTableLookup(c, st.tables.g)));
      max = Math.max(max, Math.abs(tableLookup(c, st.tables.b) - refTableLookup(c, st.tables.b)));
    }
  }
  check('matches an independent transcription over a 256-step ramp', max);

  // The spec's C == 1 case: k is clamped to n-2 so the top segment covers it.
  // Get this wrong and you index one past the end, which reads as undefined
  // and poisons the whole channel with NaN - silently, since NaN in a
  // tableValues attribute just makes the browser drop the filter.
  let endMax = 0;
  for (const st of states) {
    endMax = Math.max(endMax, Math.abs(tableLookup(1, st.tables.r) - st.tables.r[GRADE_STEPS - 1]));
    endMax = Math.max(endMax, Math.abs(tableLookup(0, st.tables.b) - st.tables.b[0]));
  }
  check('C == 1 lands exactly on the last entry, C == 0 on the first', endMax);

  const nan = states.some(st => RAMP.some(c => !Number.isFinite(tableLookup(c, st.tables.r))));
  check('produces no NaN/Infinity anywhere on the ramp', nan ? 1 : 0, 0);
}

// --- 2. the hue rotation ----------------------------------------------------

console.log('\nfeColorMatrix type="hueRotate"');
{
  let max = 0;
  for (const deg of [...HUES, 45, 123.456, -30, 720]) {
    const a = hueRotateMatrix(deg);
    const b = refHueMatrix(deg);
    for (let i = 0; i < 9; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
  }
  check('expanded constants match the spec A + cos*B + sin*C form', max, 1e-12);

  const id = hueRotateMatrix(0);
  const expectId = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  check('0 degrees is the identity matrix', Math.max(...id.map((v, i) => Math.abs(v - expectId[i]))), 1e-12);

  const wrap = hueRotateMatrix(360);
  check('360 degrees wraps back to 0', Math.max(...wrap.map((v, i) => Math.abs(v - id[i]))), 1e-12);

  // Every row summing to 1 is what makes a neutral grey stay neutral - the
  // property the whole "grade a greyscale site" idea leans on.
  let rowMax = 0;
  for (const deg of [0, 37, 90, 180, 270]) {
    const m = hueRotateMatrix(deg);
    for (let r = 0; r < 3; r++) {
      rowMax = Math.max(rowMax, Math.abs(m[r * 3] + m[r * 3 + 1] + m[r * 3 + 2] - 1));
    }
  }
  check('rows sum to 1, so greyscale input stays neutral', rowMax, 1e-12);
}

// --- 3. saturate ------------------------------------------------------------

console.log('\nfeColorMatrix type="saturate" / css saturate()');
{
  const one = saturateMatrix(1);
  const expectId = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  check('saturate(1) is the identity', Math.max(...one.map((v, i) => Math.abs(v - expectId[i]))), 1e-12);

  const zero = saturateMatrix(0);
  const luma = [0.213, 0.715, 0.072];
  let lumaMax = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) lumaMax = Math.max(lumaMax, Math.abs(zero[r * 3 + c] - luma[c]));
  }
  check('saturate(0) collapses every row to the luma coefficients', lumaMax, 1e-12);
}

// --- 4. the whole pipeline --------------------------------------------------

console.log('\ngradePixel, the full filter');
{
  let max = 0;
  for (const st of states) {
    for (const c of RAMP) {
      const a = gradePixel([c, c, c], st);
      const b = refGradePixel([c, c, c], st);
      for (let i = 0; i < 3; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
    }
  }
  check('greyscale ramp matches the reference implementation', max);

  // Non-neutral input too: the art gallery runs invert()/brightness() chains
  // and the Memories photos are real colour, so the filter does see
  // off-neutral pixels and the per-channel-then-mix order matters there.
  let colourMax = 0;
  for (const st of states) {
    for (let i = 0; i < 64; i++) {
      const p = [Math.random(), Math.random(), Math.random()];
      const a = gradePixel(p, st);
      const b = refGradePixel(p, st);
      for (let k = 0; k < 3; k++) colourMax = Math.max(colourMax, Math.abs(a[k] - b[k]));
    }
  }
  check('non-neutral input matches too', colourMax);

  const inRange = states.every(st => RAMP.every(c => gradePixel([c, c, c], st).every(v => v >= 0 && v <= 1)));
  check('output is always clamped into [0,1]', inRange ? 0 : 1, 0);
}

// --- 5. the flat-colour path ------------------------------------------------

console.log('\ngradeFlatColor, the css-custom-property path');
{
  let max = 0;
  for (const st of states) {
    for (const sat of [0.4, 0.6, 0.7, 1]) {
      for (const input of [25, 70, 128, 205, 240]) {
        const a = gradeFlatColor(gray01(input), st, sat);
        const graded = refGradePixel(gray01(input), st);
        const b = sat === 1 ? graded : refApply(graded, saturateMatrix(sat)).map(clamp01);
        for (let i = 0; i < 3; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
      }
    }
  }
  check('grade-then-saturate matches applying the two steps by hand', max);

  // The documented invariant behind --color-grade-flat: with GRADE_STEPS odd,
  // the middle table entry *is* the middle stop, so a mid-grey input reads it
  // directly and the flat colour is the middle stop hue-rotated, exactly.
  let midMax = 0;
  for (const st of states) {
    const mid = [st.tables.r[(GRADE_STEPS - 1) / 2], st.tables.g[(GRADE_STEPS - 1) / 2], st.tables.b[(GRADE_STEPS - 1) / 2]];
    const expected = refApply(mid, refHueMatrix(st.hueDeg)).map(clamp01);
    const actual = gradeFlatColor(gray01(127.5), st);
    for (let i = 0; i < 3; i++) midMax = Math.max(midMax, Math.abs(actual[i] - expected[i]));
  }
  check('mid-grey reads the middle table entry exactly', midMax);
}

// --- 6. what the old approximation was costing ------------------------------

// Informational, not an assertion. `flatGradeColor` used to take the middle
// stop's raw HSL and shift its hue in HSL space, with a comment calling that
// "close enough". This is how close it actually was, and it is the reason
// Phase 1 folded both paths into one implementation.
console.log('\nthe old HSL-shift approximation, for the record');
{
  const hslToRgb = (h, s, l) => {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [r + m, g + m, b + m];
  };

  let worst = 0;
  let sum = 0;
  let n = 0;
  for (const st of states) {
    const old = hslToRgb(st.stops[1].h + st.hueDeg, st.stops[1].s, st.stops[1].l);
    const now = gradeFlatColor(gray01(128), st);
    const d = Math.max(...[0, 1, 2].map(i => Math.abs(old[i] - now[i])));
    worst = Math.max(worst, d);
    sum += d;
    n++;
  }
  console.log(`  worst disagreement: ${(worst * 255).toFixed(1)}/255`);
  console.log(`  mean disagreement:  ${((sum / n) * 255).toFixed(1)}/255`);
  console.log('  (informational - this is the bug Phase 1 removed, not a check)');
}

// --- 7. the frame-budget watchdog -------------------------------------------

// This one decides whether anybody sees the effect at all, so it is worth
// driving with known frame streams rather than trusting it. The module guards
// on `typeof window`, so it needs a browser shaped just enough to run in: a
// rAF that queues callbacks instead of waiting for a display, and a document
// that never goes hidden. Time is supplied by the test, so a ten-second
// measurement window runs instantly.
console.log('\nframe-budget watchdog');
{
  let queue = [];
  globalThis.window = {};
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  globalThis.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
  globalThis.cancelAnimationFrame = () => {};

  const { startFrameBudgetWatchdog } = await import('../src/utils/frameBudgetWatchdog.ts');

  const drive = (gapFor, maxFrames = 1200) => {
    queue = [];
    let verdict = null;
    startFrameBudgetWatchdog(v => { verdict = v; });
    let t = 0;
    for (let i = 0; i < maxFrames && queue.length; i++) {
      queue.shift()(t);
      t += gapFor(i);
    }
    return verdict;
  };

  const expect = (name, actual, wanted) => {
    checks++;
    const ok = actual === wanted;
    if (!ok) failures++;
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}  (got ${actual}, wanted ${wanted})`);
  };

  expect('steady 60fps is not struggling', drive(() => 16.67)?.struggling, false);

  // The reference machine this threshold was calibrated against. If this ever
  // starts failing, the threshold has drifted to somewhere that would have
  // switched the grade off on the very hardware that proved it runs fine.
  expect('reference machine (p95 ~37ms) keeps the grade',
    drive(i => (i % 20 === 0 ? 37 : 16.67))?.struggling, false);

  // Why the verdict is a 95th percentile and not the maximum: one stall - a
  // GC, a tab switch, the OS scheduling something else - must not condemn a
  // machine that is otherwise perfectly fine.
  expect('a single 900ms stall does not condemn the machine',
    drive(i => (i === 300 ? 900 : 16.67))?.struggling, false);

  expect('sustained 20fps is struggling', drive(() => 50.5)?.struggling, true);
  expect('sustained 15fps is struggling', drive(() => 66)?.struggling, true);

  // Too little signal to judge: a visitor who left after a second.
  expect('no verdict at all when the page closes early',
    drive(() => 16.67, 40) === null, true);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`} - ${checks} checks\n`);
process.exit(failures === 0 ? 0 : 1);
