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

export function variantsForRatio(ratioKey: string): FrameVariant[] {
  return FRAME_VARIANTS.filter(v => v.spec.ratioKey === ratioKey);
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
