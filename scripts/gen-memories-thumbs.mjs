// Generates small, web-ready thumbnails for src/assets/memories/* into
// src/assets/memories-thumbs/*.webp - the Memories component only ever
// imports from the thumbs folder, never the raw originals (which can be
// several MB each, straight off a phone). Runs automatically before
// dev/build (see package.json's pre* scripts) and re-runs fast on repeat
// invocations since it skips any thumb that's already newer than its
// source. Just add more photos to src/assets/memories/ - no other wiring
// needed.
import { readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC_DIR = path.resolve(import.meta.dirname, '../src/assets/memories');
const OUT_DIR = path.resolve(import.meta.dirname, '../src/assets/memories-thumbs');
// Kept next to (not inside) OUT_DIR so it doesn't get swept up by the
// component's `memories-thumbs/*` glob alongside the actual image files.
// Maps each thumb's filename to its real aspect ratio (width / height) so
// Memories.tsx can shape each tile to match its photo instead of guessing -
// a portrait photo forced into a landscape-shaped tile crops away most of
// the image.
const META_PATH = path.resolve(import.meta.dirname, '../src/assets/memories-thumbs-meta.json');

// Long-edge cap in px. These are ambient/background tiles (the biggest ever
// rendered on screen is a few hundred px wide), never opened full-screen, so
// there's no point shipping anything larger.
const MAX_EDGE = 800;
const WEBP_QUALITY = 72;

const SUPPORTED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // The raw originals only ever exist on a dev machine (see .gitignore) -
  // on Netlify's build agent this dir is simply absent, and that's fine:
  // the committed thumbs + meta json (also read below) are already
  // everything the site needs, so just skip generation rather than fail.
  const entries = await readdir(SRC_DIR, { withFileTypes: true }).catch(err => {
    if (err.code === 'ENOENT') return [];
    throw err;
  });
  const files = entries.filter(e => e.isFile());

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const unsupported = [];

  for (const entry of files) {
    const ext = path.extname(entry.name);
    if (!SUPPORTED.has(ext.toLowerCase())) {
      unsupported.push(entry.name);
      continue;
    }

    const srcPath = path.join(SRC_DIR, entry.name);
    const outPath = path.join(OUT_DIR, `${path.basename(entry.name, ext)}.webp`);

    const [srcStat, outStat] = await Promise.all([
      stat(srcPath),
      stat(outPath).catch(() => null),
    ]);
    if (outStat && outStat.mtimeMs >= srcStat.mtimeMs) {
      skipped++;
      continue;
    }

    try {
      await sharp(srcPath)
        .rotate() // auto-orients from EXIF, then strips the tag
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outPath);
      generated++;
    } catch (err) {
      failed++;
      console.warn(`[memories-thumbs] failed to convert "${entry.name}": ${err.message}`);
    }
  }

  if (unsupported.length) {
    console.warn(`[memories-thumbs] skipped ${unsupported.length} unsupported file(s): ${unsupported.join(', ')}`);
  }
  console.log(`[memories-thumbs] ${generated} generated, ${skipped} up to date, ${failed} failed (${SRC_DIR} -> ${OUT_DIR})`);

  // Rebuilt in full every run (not just for freshly (re)generated files) so
  // it always reflects everything currently in OUT_DIR, regardless of the
  // skip-if-up-to-date shortcut above.
  const thumbEntries = await readdir(OUT_DIR, { withFileTypes: true });
  const meta = {};
  for (const entry of thumbEntries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.webp') continue;
    try {
      const { width, height } = await sharp(path.join(OUT_DIR, entry.name)).metadata();
      if (width && height) meta[entry.name] = width / height;
    } catch (err) {
      console.warn(`[memories-thumbs] failed to read dimensions for "${entry.name}": ${err.message}`);
    }
  }
  await writeFile(META_PATH, JSON.stringify(meta));
}

main().catch(err => {
  console.error('[memories-thumbs]', err);
  process.exit(1);
});
