// Converts the heavy PNG/GIF/JPG source art shipped in src/assets/** into
// lighter WebP siblings (kept next to the originals, e.g. grove.png +
// grove.webp), and points nothing here at the code - see the various
// import.meta.glob calls across src/ for that. All source art here is pure
// neutral grayscale with alpha (verified by hand), so lossy WebP is safe.
//
// Idempotent like scripts/gen-memories-thumbs.mjs: skips any output whose
// mtime is already >= its source's, so repeat runs (and CI) are fast/no-ops
// once everything is converted. Re-run any time new source art is added.
import { stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const src = (...p) => path.resolve(ROOT, 'src/assets', ...p);

let generated = 0;
let skipped = 0;
let failed = 0;

// Runs `task(srcPath, outPath)` for one src -> out pair, skipping if outPath
// is already newer than srcPath. Missing srcPath is reported and skipped
// (doesn't throw), so a partially-present asset set doesn't kill the run.
async function convertOne(srcPath, outPath, task) {
  const [srcStat, outStat] = await Promise.all([
    stat(srcPath).catch(() => null),
    stat(outPath).catch(() => null),
  ]);
  if (!srcStat) {
    failed++;
    console.warn(`[optimize-assets] missing source: ${path.relative(ROOT, srcPath)}`);
    return;
  }
  if (outStat && outStat.mtimeMs >= srcStat.mtimeMs) {
    skipped++;
    return;
  }
  try {
    await task();
    generated++;
  } catch (err) {
    failed++;
    console.warn(`[optimize-assets] failed to convert "${path.relative(ROOT, srcPath)}": ${err.message}`);
  }
}

// --- animated GIF -> animated WebP -----------------------------------------
// sharp({ animated: true }) reads every frame (preserving per-frame delay
// and loop count) and .webp() re-encodes the whole sequence as animated WebP.
//
// `frameStride` keeps only every Nth frame (each kept frame's delay is
// multiplied by the stride to preserve total loop duration). Use it for gifs
// recorded at a much higher frame rate than their actual motion needs - e.g.
// spiral-tower is a static tower art with just a slow twinkle effect, shot
// at ~33fps, where dropping to ~11fps is visually identical but a fraction
// of the size.
// `effort` defaults to 6 (libwebp's max useful setting below diminishing
// returns) rather than sharp's default of 4 - it's a slower encode for a
// free few % size cut, and this only runs at build time.
async function animatedGifToWebp(srcPath, outPath, { quality = 80, effort = 6, frameStride = 1 } = {}) {
  await convertOne(srcPath, outPath, async () => {
    if (frameStride === 1) {
      await sharp(srcPath, { animated: true }).webp({ quality, effort }).toFile(outPath);
      return;
    }
    const { pages, pageHeight, delay } = await sharp(srcPath, { animated: true }).metadata();
    const frameIdxs = [];
    for (let i = 0; i < pages; i += frameStride) frameIdxs.push(i);
    const frameBuffers = await Promise.all(
      frameIdxs.map(i => sharp(srcPath, { animated: true, page: i, pages: 1 }).png().toBuffer())
    );
    const newDelay = frameIdxs.map(i => delay[i] * frameStride);
    await sharp(frameBuffers, { join: { pageHeight, animated: true } })
      .webp({ quality, effort, delay: newDelay, loop: 0 })
      .toFile(outPath);
  });
}

// --- static PNG (with alpha) -> WebP ----------------------------------------
async function pngToWebp(srcPath, outPath, quality = 90) {
  await convertOne(srcPath, outPath, () =>
    sharp(srcPath).webp({ quality }).toFile(outPath)
  );
}

// --- JPG -> WebP -------------------------------------------------------------
async function jpgToWebp(srcPath, outPath, quality = 80) {
  await convertOne(srcPath, outPath, () =>
    sharp(srcPath).webp({ quality }).toFile(outPath)
  );
}

// Multiplies R/G/B by `factor` (clamped to 255), leaving alpha untouched -
// done on a raw RGBA buffer rather than sharp.linear() (which also scales
// alpha) so this can bake in the CSS `filter: brightness(1.05)` currently
// applied to every cloud <img> without touching its transparency.
async function brightenRgba(srcPath, factor) {
  const img = sharp(srcPath).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info; // channels === 4 (RGBA) via ensureAlpha
  for (let i = 0; i < data.length; i += channels) {
    data[i] = Math.min(255, Math.round(data[i] * factor));
    data[i + 1] = Math.min(255, Math.round(data[i + 1] * factor));
    data[i + 2] = Math.min(255, Math.round(data[i + 2] * factor));
    // data[i + 3] (alpha) left as-is
  }
  return sharp(data, { raw: { width, height, channels } });
}

async function cloudToWebp(srcPath, outPath, softOutPath, quality = 90) {
  await convertOne(srcPath, outPath, async () => {
    const brightened = await brightenRgba(srcPath, 1.05);
    await brightened.webp({ quality }).toFile(outPath);
  });
  await convertOne(srcPath, softOutPath, async () => {
    const brightened = await brightenRgba(srcPath, 1.05);
    await brightened.clone().blur(2.0).webp({ quality }).toFile(softOutPath);
  });
}

async function main() {
  // 1a. Animated GIF -> animated WebP
  // spiral-tower's source gif is a static tower shot at ~33fps with only a
  // small twinkle effect moving - dropping to ~11fps (stride 3) plus a lower
  // quality is visually indistinguishable but cuts the shipped WebP by ~75%.
  const objectGifOptions = { 'spiral-tower': { quality: 58, frameStride: 3 } };
  for (const name of ['spiral-tower', 'future-building', 'octopus-tree']) {
    await animatedGifToWebp(src(`landscape/objects/${name}.gif`), src(`landscape/objects/${name}.webp`), objectGifOptions[name]);
  }
  // These are already small (under ~200KB) and their motion is real
  // (flapping/walking), so keep full framerate and just tighten quality -
  // same grayscale-with-alpha art as spiral-tower, so lossy is safe here too.
  for (const name of ['bat', 'bat-2', 'fly', 'gezichtje', 'giraffe', 'sheep', 'wazeba-black', 'wazeba-white']) {
    await animatedGifToWebp(src(`landscape/creatures/${name}.gif`), src(`landscape/creatures/${name}.webp`), { quality: 70 });
  }

  // 1b. Static PNG -> WebP with alpha
  for (const name of ['landscape-1', 'landscape-2', 'shine-3']) {
    await pngToWebp(src(`landscape/${name}.png`), src(`landscape/${name}.webp`), 90);
  }
  // jiri-head is a flat black silhouette (alpha is essentially 0 or 173) shown
  // full-width at 0.68 opacity, and the source is 2480px wide - 1440px is
  // still 3x a phone's CSS width and keeps a laptop screen 1:1, at ~45% of
  // the bytes. It is the largest image the page requests before first paint.
  await convertOne(src('landscape/jiri-head.png'), src('landscape/jiri-head.webp'), () =>
    sharp(src('landscape/jiri-head.png')).resize({ width: 1440 }).webp({ quality: 80, alphaQuality: 80 }).toFile(src('landscape/jiri-head.webp'))
  );
  for (const name of ['box-dark-small', 'box-light-small', 'back-arrow', 'button-bg']) {
    await pngToWebp(src(`${name}.png`), src(`${name}.webp`), 90);
  }

  // Art gallery frames + plaques
  const { readdir } = await import('node:fs/promises');
  const frameFiles = await readdir(src('art-gallery/frames')).catch(() => []);
  for (const file of frameFiles) {
    if (path.extname(file).toLowerCase() !== '.png') continue;
    const base = path.basename(file, '.png');
    await pngToWebp(src(`art-gallery/frames/${file}`), src(`art-gallery/frames/${base}.webp`), 90);
  }

  // Clouds - brightness(1.05) baked in, plus a blur(2) "soft" variant
  for (let n = 1; n <= 6; n++) {
    await cloudToWebp(
      src(`clouds/cloud-${n}.png`),
      src(`clouds/cloud-${n}.webp`),
      src(`clouds/cloud-${n}-soft.webp`),
      90
    );
  }

  // Sunrays - blur(1.1) baked in (CSS filter: blur(0.2vw))
  await convertOne(src('landscape/sunrays.png'), src('landscape/sunrays.webp'), () =>
    sharp(src('landscape/sunrays.png')).blur(1.1).webp({ quality: 90 }).toFile(src('landscape/sunrays.webp'))
  );

  // 1c. background-darkgray.jpg -> webp
  await jpgToWebp(src('background-darkgray.jpg'), src('background-darkgray.webp'), 80);

  // 1d. Art gallery tile thumbnails
  const { mkdir } = await import('node:fs/promises');
  await mkdir(src('art-gallery/thumbs'), { recursive: true });
  const imageFiles = await readdir(src('art-gallery/images')).catch(() => []);
  for (const file of imageFiles) {
    if (path.extname(file).toLowerCase() !== '.jpg') continue;
    const base = path.basename(file, '.jpg');
    await convertOne(src(`art-gallery/images/${file}`), src(`art-gallery/thumbs/${base}.webp`), () =>
      sharp(src(`art-gallery/images/${file}`))
        .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(src(`art-gallery/thumbs/${base}.webp`))
    );
  }

  console.log(`[optimize-assets] ${generated} generated, ${skipped} up to date, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main().catch(err => {
  console.error('[optimize-assets]', err);
  process.exit(1);
});
