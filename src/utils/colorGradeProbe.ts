import {
  gradePixel,
  type GradeState,
  type Rgb01,
} from '../components/colorGrade/gradeClock';

// Measures, at runtime, whether this engine can actually do the thing
// #landscape-color-grade needs it to do - instead of asking it what its name
// is. The UA sniff in getColorGradeMode() is the bug this exists to retire: it
// froze one measurement from an unknown Firefox on unknown hardware into a
// permanent rule about every Firefox forever, and it was right about Safari
// only by accident.
//
// !! Read this before trusting a result !!
//
// This measures an SVG filter applied to SVG content inside an `<img>`, which
// is NOT the same code path as `filter: url(#...)` on an HTML element - and
// the latter is what the site actually uses. There is no API to read back the
// rendered pixels of an HTML element, so this is the closest legal proxy
// there is. Treat a result as strong evidence, never as proof; in particular,
// a "supported" verdict here on an engine where the page visibly has no grade
// means the probe is measuring the wrong path and must not be wired up to
// getColorGradeMode(). As of 2026-09-17 Safari is exactly that known-positive
// test case: run the probe there first.
//
// `data:` URLs do not taint a canvas, so the getImageData readback below is
// legal and needs no CORS handling.

// A deliberately lumpy, obviously-not-identity table. Three entries per
// channel is enough to make a linear ramp come back visibly bent, and the
// channels differ from each other so a broken-but-plausible result (e.g. an
// engine that applies only feFuncR) can't masquerade as a correct one.
const PROBE_TABLES = {
  r: [0.10, 0.90, 0.20],
  g: [0.80, 0.10, 0.70],
  b: [0.30, 0.60, 0.95],
};
const PROBE_HUE_DEG = 90;
const PROBE_STATE: GradeState = { stops: [], tables: PROBE_TABLES, hueDeg: PROBE_HUE_DEG };

// The input ramp, in 0-255 greys. Endpoints included on purpose: 0 exercises
// the "can this technique recolour true black at all" property that the whole
// table approach exists for, and 255 exercises the C == 1 clamp in the table
// lookup, which is the one place an off-by-one in an implementation shows up.
const RAMP = [0, 32, 64, 96, 128, 160, 192, 224, 255];

const SWATCH = 8;

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

const to255 = (c: number) => Math.round(Math.max(0, Math.min(1, c)) * 255);

export interface ProbeSample {
  input: number;
  actual: [number, number, number];
  predictedSRGB: [number, number, number];
  predictedLinear: [number, number, number];
}

export interface ProbeResult {
  /** Did the engine apply the filter at all? */
  supported: boolean;
  /** Which interpolation space the engine appears to have used. */
  space: 'sRGB' | 'linearRGB' | 'unknown';
  /** Worst per-channel deviation, in 0-255 units, from each prediction. */
  maxDeltaSRGB: number;
  maxDeltaLinear: number;
  /** Worst deviation of the output from the *untouched input* ramp. */
  maxDeltaFromInput: number;
  samples: ProbeSample[];
  error?: string;
}

/** What the filter should produce, honouring colorInterpolationFilters="sRGB". */
function predictSRGB(v255: number): [number, number, number] {
  const c: Rgb01 = [v255 / 255, v255 / 255, v255 / 255];
  const out = gradePixel(c, PROBE_STATE);
  return [to255(out[0]), to255(out[1]), to255(out[2])];
}

// What the filter produces on an engine that ignores the sRGB request and
// works in linearRGB anyway: the values get linearised on the way in and
// de-linearised on the way out, so the table ends up indexed on linearised
// values and every midtone shifts. Historically WebKit did this regardless of
// the attribute (w3c/fxtf-drafts#285); changesets from 2022 suggest it was
// fixed, which is precisely the kind of claim this function exists to check
// rather than believe.
function predictLinear(v255: number): [number, number, number] {
  const lin = srgbToLinear(v255 / 255);
  const out = gradePixel([lin, lin, lin], PROBE_STATE);
  return [to255(linearToSrgb(out[0])), to255(linearToSrgb(out[1])), to255(linearToSrgb(out[2]))];
}

function buildProbeSvg(): string {
  const tv = (vals: number[]) => vals.join(' ');
  const swatches = RAMP.map((v, i) =>
    `<rect x="${i * SWATCH}" y="0" width="${SWATCH}" height="${SWATCH}" fill="rgb(${v},${v},${v})"/>`
  ).join('');
  const w = RAMP.length * SWATCH;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${SWATCH}" shape-rendering="crispEdges">`,
    `<filter id="probe" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">`,
    `<feComponentTransfer>`,
    `<feFuncR type="table" tableValues="${tv(PROBE_TABLES.r)}"/>`,
    `<feFuncG type="table" tableValues="${tv(PROBE_TABLES.g)}"/>`,
    `<feFuncB type="table" tableValues="${tv(PROBE_TABLES.b)}"/>`,
    `</feComponentTransfer>`,
    `<feColorMatrix type="hueRotate" values="${PROBE_HUE_DEG}"/>`,
    `</filter>`,
    `<g filter="url(#probe)">${swatches}</g>`,
    `</svg>`,
  ].join('');
}

/** The ramp as an SVG data: URL, exported so a debug view can show it directly. */
export function probeSvgDataUrl(): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildProbeSvg())}`;
}

function emptyResult(error: string): ProbeResult {
  return {
    supported: false,
    space: 'unknown',
    maxDeltaSRGB: Infinity,
    maxDeltaLinear: Infinity,
    maxDeltaFromInput: 0,
    samples: [],
    error,
  };
}

let pending: Promise<ProbeResult> | null = null;

export function runColorGradeProbe(): Promise<ProbeResult> {
  if (pending) return pending;
  pending = new Promise<ProbeResult>(resolve => {
    if (typeof document === 'undefined') return resolve(emptyResult('no document'));

    const w = RAMP.length * SWATCH;
    const img = new Image(w, SWATCH);
    const done = (r: ProbeResult) => resolve(r);

    // Nothing here is worth hanging a page load on. If the decode is slow or
    // silently never fires, the caller gets an explicit "unknown" rather than
    // a promise that never settles.
    const timer = window.setTimeout(() => done(emptyResult('timed out')), 3000);

    img.onerror = () => { window.clearTimeout(timer); done(emptyResult('svg failed to load')); };
    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = SWATCH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return done(emptyResult('no 2d context'));
        ctx.drawImage(img, 0, 0, w, SWATCH);

        const samples: ProbeSample[] = [];
        let maxDeltaSRGB = 0;
        let maxDeltaLinear = 0;
        let maxDeltaFromInput = 0;

        RAMP.forEach((input, i) => {
          // Centre of each swatch, so any edge antialiasing the engine decided
          // to do despite crispEdges cannot reach the sampled pixel.
          const px = ctx.getImageData(i * SWATCH + SWATCH / 2, SWATCH / 2, 1, 1).data;
          const actual: [number, number, number] = [px[0], px[1], px[2]];
          const predictedSRGB = predictSRGB(input);
          const predictedLinear = predictLinear(input);

          for (let c = 0; c < 3; c++) {
            maxDeltaSRGB = Math.max(maxDeltaSRGB, Math.abs(actual[c] - predictedSRGB[c]));
            maxDeltaLinear = Math.max(maxDeltaLinear, Math.abs(actual[c] - predictedLinear[c]));
            maxDeltaFromInput = Math.max(maxDeltaFromInput, Math.abs(actual[c] - input));
          }
          samples.push({ input, actual, predictedSRGB, predictedLinear });
        });

        // An engine that dropped the filter reference entirely hands the ramp
        // straight back. 6/255 of slack absorbs decode rounding without coming
        // close to the tens-of-units swing the probe table produces.
        const supported = maxDeltaFromInput > 6;
        const space: ProbeResult['space'] = !supported
          ? 'unknown'
          : maxDeltaSRGB <= 4 ? 'sRGB'
          : maxDeltaLinear <= 4 ? 'linearRGB'
          : 'unknown';

        done({ supported, space, maxDeltaSRGB, maxDeltaLinear, maxDeltaFromInput, samples });
      } catch (e) {
        done(emptyResult(e instanceof Error ? e.message : String(e)));
      }
    };

    img.src = probeSvgDataUrl();
  });
  return pending;
}

/** The expected output ramp, for a debug view to show next to the real one. */
export function expectedRamp(): { input: number; sRGB: string; linear: string }[] {
  return RAMP.map(v => {
    const s = predictSRGB(v);
    const l = predictLinear(v);
    return {
      input: v,
      sRGB: `rgb(${s[0]}, ${s[1]}, ${s[2]})`,
      linear: `rgb(${l[0]}, ${l[1]}, ${l[2]})`,
    };
  });
}
