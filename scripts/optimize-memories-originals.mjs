// Optimizes the raw Well of Memories photos in src/assets/memories/* in
// place: converts each to a size-capped, quality-tuned .webp and deletes the
// original (often several MB, straight off a phone as JPEG/HEIC). This is a
// manual cleanup step, not part of the build - the folder is gitignored and
// only ever read locally to produce the on-screen thumbnails `npm run
// thumbs` generates (see gen-memories-thumbs.mjs), so there's no reason to
// keep the oversized captures around once a webp master exists.
//
// Run it after dropping new photos into src/assets/memories/, then
// `npm run thumbs` to (re)build the tiles the site actually uses.
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.resolve(import.meta.dirname, '../src/assets/memories');

// Long-edge cap in px for the *master* copy - not the tiny on-screen thumbs
// (see MAX_EDGE in gen-memories-thumbs.mjs for those, which are generated
// from these masters). Generous enough to stay useful if a photo is ever
// needed larger, small enough to actually shrink down 12MP+ phone captures.
const MAX_EDGE = 2400;
const WEBP_QUALITY = 82;

const SUPPORTED = new Set(['.jpg', '.jpeg', '.png', '.heic', '.heif']);

async function main() {
  const entries = await readdir(DIR, { withFileTypes: true });
  const files = entries.filter(e => e.isFile());

  let converted = 0;
  let alreadyWebp = 0;
  let failed = 0;
  const unsupported = [];

  for (const entry of files) {
    const ext = path.extname(entry.name); // keep original case - basename() strips exactly, case-sensitively
    if (ext.toLowerCase() === '.webp') { alreadyWebp++; continue; }
    if (!SUPPORTED.has(ext.toLowerCase())) { unsupported.push(entry.name); continue; }

    const srcPath = path.join(DIR, entry.name);
    const outPath = path.join(DIR, `${path.basename(entry.name, ext)}.webp`);

    try {
      await sharp(srcPath)
        .rotate() // auto-orients from EXIF, then strips the tag
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: 6 })
        .toFile(outPath);
      await unlink(srcPath);
      converted++;
    } catch (err) {
      failed++;
      console.warn(`[optimize-memories] failed to convert "${entry.name}": ${err.message}`);
    }
  }

  if (unsupported.length) {
    console.warn(`[optimize-memories] skipped ${unsupported.length} unsupported file(s): ${unsupported.join(', ')}`);
  }
  console.log(`[optimize-memories] ${converted} converted, ${alreadyWebp} already webp, ${failed} failed (${DIR})`);
}

main().catch(err => {
  console.error('[optimize-memories]', err);
  process.exit(1);
});
