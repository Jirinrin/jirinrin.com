// Frame art lives in ./frames as PNGs named `frame-{w}-{h}-{variant}.png`, where
// `{w}-{h}` is the aspect ratio of the transparent window in the frame's center
// (where the artwork shows through) and `{variant}` distinguishes different frame
// paintings sharing that ratio (a, b, ...). Plaques are named `plaque-{name}.png`
// (light) and `plaque-{name}-d.png` (dark, for use with light/white text).
//
// New variants of an existing ratio are picked up automatically - just drop the
// PNG in ./frames following the naming convention. A genuinely new aspect ratio
// also needs its pixel geometry registered in FRAME_GEOMETRY below (it can't be
// inferred from the filename alone, since window/frame padding isn't uniform).

export interface FrameSpec {
  ratioKey: string;
  /** window width / window height */
  aspect: number;
  frameW: number;
  frameH: number;
  windowW: number;
  windowH: number;
}

// The window is assumed centered within the frame image (true of every frame
// supplied so far).
const FRAME_GEOMETRY: Record<string, Omit<FrameSpec, 'ratioKey' | 'aspect'>> = {
  '1-1': { frameW: 1000, frameH: 1000, windowW: 800, windowH: 800 },
  '3-4': { frameW: 1100, frameH: 1400, windowW: 900, windowH: 1200 },
  '4-5': { frameW: 1000, frameH: 1200, windowW: 800, windowH: 1000 },
};

const frameImages = import.meta.glob<string>('./frames/frame-*.png', { eager: true, import: 'default' });
const plaqueImages = import.meta.glob<string>('./frames/plaque-*.png', { eager: true, import: 'default' });

export interface FrameVariant {
  spec: FrameSpec;
  variant: string;
  url: string;
}

const FRAME_VARIANTS: FrameVariant[] = Object.entries(frameImages).flatMap(([path, url]) => {
  const match = /frame-(\d+)-(\d+)-([a-z0-9]+)\.png$/i.exec(path);
  if (!match) return [];
  const [, w, h, variant] = match;
  const ratioKey = `${w}-${h}`;
  const geometry = FRAME_GEOMETRY[ratioKey];
  if (!geometry) {
    console.warn(`frames.ts: no geometry registered for frame ratio "${ratioKey}" (${path}) - add it to FRAME_GEOMETRY`);
    return [];
  }
  return [{ spec: { ratioKey, aspect: geometry.windowW / geometry.windowH, ...geometry }, variant, url }];
});

const RATIO_KEYS = Array.from(new Set(FRAME_VARIANTS.map(v => v.spec.ratioKey)));

export function variantsForRatio(ratioKey: string): FrameVariant[] {
  return FRAME_VARIANTS.filter(v => v.spec.ratioKey === ratioKey);
}

// Picks whichever registered frame aspect ratio is closest to a given artwork's
// aspect (compared on a log scale so e.g. 4:5 and 5:4 are equally "close" to
// their reciprocal rather than the comparison being skewed toward wide ratios).
export function closestFrameRatioKey(aspect: number): string {
  let best = RATIO_KEYS[0];
  let bestDiff = Infinity;
  for (const key of RATIO_KEYS) {
    const geometry = FRAME_GEOMETRY[key];
    const diff = Math.abs(Math.log(geometry.windowW / geometry.windowH) - Math.log(aspect));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = key;
    }
  }
  return best;
}

// A pickable frame option: either a registered ratio used as painted (portrait
// or square), or - for the non-square ones - the same frame turned 90deg so
// its window reads as landscape instead. `effectiveAspect` is what should
// actually be compared against an artwork's own aspect when picking a frame,
// since a `rotated` candidate's window is the reciprocal of its painted ratio.
export interface FrameCandidate {
  ratioKey: string;
  rotated: boolean;
  effectiveAspect: number;
}

const FRAME_CANDIDATES: FrameCandidate[] = RATIO_KEYS.flatMap(ratioKey => {
  const geometry = FRAME_GEOMETRY[ratioKey];
  const aspect = geometry.windowW / geometry.windowH;
  const candidates: FrameCandidate[] = [{ ratioKey, rotated: false, effectiveAspect: aspect }];
  if (Math.abs(aspect - 1) > 1e-6) candidates.push({ ratioKey, rotated: true, effectiveAspect: 1 / aspect });
  return candidates;
});

export function frameCandidates(): FrameCandidate[] {
  return FRAME_CANDIDATES;
}

export interface PlaqueVariant {
  name: string;
  light: string;
  dark?: string;
}

const PLAQUE_VARIANTS: PlaqueVariant[] = (() => {
  const byName = new Map<string, PlaqueVariant>();
  for (const [path, url] of Object.entries(plaqueImages)) {
    const match = /plaque-([a-z0-9]+)(-d)?\.png$/i.exec(path);
    if (!match) continue;
    const [, name, dark] = match;
    const entry = byName.get(name) ?? { name, light: '' };
    if (dark) entry.dark = url;
    else entry.light = url;
    byName.set(name, entry);
  }
  return Array.from(byName.values()).filter(v => v.light);
})();

export function allPlaqueVariants(): PlaqueVariant[] {
  return PLAQUE_VARIANTS;
}
