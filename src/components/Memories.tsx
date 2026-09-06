import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import './Memories.scss';

// Only the generated thumbnails (see scripts/gen-memories-thumbs.mjs, run
// automatically before dev/build) are ever imported here - never the raw
// originals in src/assets/memories, which can be several MB straight off a
// phone. `eager: true` just resolves each to its build-time URL string
// (free - no image bytes are fetched); the actual bytes only load once a
// tile's <img> is mounted into the DOM, which the recycling field below
// keeps bounded to a few dozen at a time no matter how many hundred photos
// exist on disk.
const memoryThumbs = import.meta.glob<string>(
  '../assets/memories-thumbs/*.webp',
  { eager: true, import: 'default' }
);
const MEMORY_URLS = Object.values(memoryThumbs);

// Real width/height aspect ratio per thumb filename, written alongside the
// thumbs by the same generation script - lets each tile be shaped to match
// its actual photo (see ASPECT_BY_URL below) instead of a shape guessed at
// random, which used to crop portrait photos as if they were landscape.
const memoryAspects: Record<string, number> = import.meta.glob<{ default: Record<string, number> }>(
  '../assets/memories-thumbs-meta.json',
  { eager: true }
)['../assets/memories-thumbs-meta.json']?.default ?? {};
const ASPECT_BY_URL = new Map<string, number>(
  Object.entries(memoryThumbs).map(([path, url]) => [url, memoryAspects[path.split('/').pop()!] ?? 1])
);

// A pool of every photo, drawn at random but never from the last
// `historySize` photos already shown - without that, plain random draws
// (or even a shuffled deck, at its wraparound) can easily bring the same
// photo back after only a handful of tiles, which reads as an obvious
// repeat since several dozen tiles are alive on screen at once. The window
// is kept comfortably bigger than that many-tiles-alive count so no two
// tiles on screen, or shown within roughly a screen's worth of scrolling,
// can land on the same photo - it only ever falls back to a real repeat if
// the whole library is smaller than the window.
function createPool() {
  const total = MEMORY_URLS.length;
  const historySize = Math.max(1, Math.min(total - 1, Math.round(total * 0.65)));
  const recent: string[] = [];

  return (): string => {
    if (total === 0) return '';
    const candidates = MEMORY_URLS.filter(url => !recent.includes(url));
    const pick = candidates.length > 0 ? candidates : MEMORY_URLS;
    const img = pick[Math.floor(Math.random() * pick.length)];
    recent.push(img);
    if (recent.length > historySize) recent.shift();
    return img;
  };
}

// Depth tiers, back to front: smaller/slower/dimmer/blurrier reads as
// further away, bigger/faster/sharper as closer - the actual parallax cue.
// Every tile is independently assigned one of these and floats freely -
// there's no lane/column locking speed or x-position to depth.
interface Depth { speed: number; minW: number; maxW: number; opacity: number; blur: number; }
const DEPTHS: Depth[] = [
  { speed: 0.30, minW: 60,  maxW: 105, opacity: 0.5,  blur: 1.4 },
  { speed: 0.55, minW: 95,  maxW: 160, opacity: 0.72, blur: 0.5 },
  { speed: 0.85, minW: 145, maxW: 230, opacity: 0.9,  blur: 0 },
  { speed: 1.25, minW: 200, maxW: 310, opacity: 1,    blur: 0 },
];

// Tiles are shaped to match each photo's real aspect ratio (via
// ASPECT_BY_URL below) rather than a random guess, so object-fit: cover
// never has to crop a portrait photo as though it were a landscape one.
// Still clamped to a sane range - the rare panorama or odd screenshot
// shouldn't produce a sliver tile that breaks the "field of photos" look.
const ASPECT_CLAMP_MIN = 0.55;
const ASPECT_CLAMP_MAX = 2.0;
function aspectForUrl(url: string): number {
  const raw = ASPECT_BY_URL.get(url) ?? 1;
  return Math.min(ASPECT_CLAMP_MAX, Math.max(ASPECT_CLAMP_MIN, raw));
}
const ASPECT_VALUES = Array.from(ASPECT_BY_URL.values());
const AVG_ASPECT = ASPECT_VALUES.length > 0
  ? ASPECT_VALUES.reduce((a, b) => a + b, 0) / ASPECT_VALUES.length
  : 1;

const BUFFER = 220; // px beyond the viewport edge a tile is kept alive for, to avoid pop-in
const AUTO_DRIFT_PX_S = 22; // gentle ambient rise even with no input
const WHEEL_KICK = 2.4;
const VELOCITY_DECAY = 0.06; // fraction of velocity retained per second (exponential)

// How densely each depth tier's tiles cover the field before overlap -
// tuned low and left flat-out random per tile (position, sway, rotation,
// speed) rather than an even grid, so the whole thing reads as things
// adrift in open space instead of any repeating pattern.
const DEPTH_COVERAGE = 0.12;
const MIN_PER_DEPTH = 4;
const MAX_PER_DEPTH = 34;

let tileKeyCounter = 0;

interface Tile {
  key: number;
  src: string;
  depth: Depth;
  width: number;
  height: number;
  x: number; // horizontal center, in the field's own unbounded coordinate space
  y: number; // vertical center-ish, in the field's own unbounded scroll coordinate space
  rotationBase: number;
  rotationAmp: number;
  rotationFreq: number;
  rotationPhase: number;
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  speedJitter: number; // per-tile multiplier on its depth's scroll speed, so same-depth tiles don't move in lockstep
}

function randomTileShape(depth: Depth, aspect: number) {
  const width = depth.minW + Math.random() * (depth.maxW - depth.minW);
  return { width, height: width / aspect };
}

function randomX(containerW: number, width: number): number {
  const overhang = width * 0.5;
  return -overhang + Math.random() * (containerW + overhang * 2);
}

// Freshly rolled for every tile at creation and again on every recycle -
// this (plus the random x/image) is what keeps things feeling like
// independent drifting objects rather than a repeating cycle.
function rollMotion(depth: Depth) {
  return {
    rotationBase: (Math.random() - 0.5) * 14,
    rotationAmp: 2 + Math.random() * 5,
    rotationFreq: 0.05 + Math.random() * 0.12,
    rotationPhase: Math.random() * Math.PI * 2,
    // nearer/faster tiers sway further across the screen, like foreground
    // clouds appearing to drift more than the distant ones during descent
    swayAmp: (6 + Math.random() * 24) * (0.4 + depth.speed),
    swayFreq: 0.12 + Math.random() * 0.28,
    swayPhase: Math.random() * Math.PI * 2,
    speedJitter: 0.82 + Math.random() * 0.36,
  };
}

function tileCountForDepth(depth: Depth, containerW: number, viewportH: number): number {
  const avgW = (depth.minW + depth.maxW) / 2;
  const avgArea = avgW * (avgW / AVG_ASPECT);
  const coverage = containerW * (viewportH + BUFFER * 2) * DEPTH_COVERAGE;
  return Math.max(MIN_PER_DEPTH, Math.min(MAX_PER_DEPTH, Math.round(coverage / avgArea)));
}

function makeFloatingTile(depth: Depth, containerW: number, y: number, nextImage: () => string): Tile {
  const src = nextImage();
  const { width, height } = randomTileShape(depth, aspectForUrl(src));
  return {
    key: tileKeyCounter++,
    src,
    depth,
    width,
    height,
    x: randomX(containerW, width),
    y,
    ...rollMotion(depth),
  };
}

function buildField(containerW: number, viewportH: number, nextImage: () => string): Tile[] {
  const tiles: Tile[] = [];
  for (const depth of DEPTHS) {
    const count = tileCountForDepth(depth, containerW, viewportH);
    for (let i = 0; i < count; i++) {
      const y = -BUFFER + Math.random() * (viewportH + BUFFER * 2);
      tiles.push(makeFloatingTile(depth, containerW, y, nextImage));
    }
  }
  return tiles;
}

// Mutates a tile in place once it's drifted fully past an edge, re-seeding
// every random parameter and placing it just beyond the opposite edge -
// each tile recycles independently (no shared ordering to maintain), which
// is what lets them all wander at their own pace instead of in columns.
function respawnTile(tile: Tile, containerW: number, viewportH: number, scrollPos: number, edge: 'top' | 'bottom', nextImage: () => string) {
  tile.src = nextImage();
  const { width, height } = randomTileShape(tile.depth, aspectForUrl(tile.src));
  tile.width = width;
  tile.height = height;
  Object.assign(tile, rollMotion(tile.depth));
  tile.x = randomX(containerW, width);
  const offset = scrollPos * tile.depth.speed * tile.speedJitter;
  const jitter = Math.random() * BUFFER;
  tile.y = edge === 'bottom'
    ? offset + viewportH + BUFFER + jitter
    : offset - BUFFER - height - jitter;
}

interface MemoriesProps {
  open: boolean;
  onClose: () => void;
}

function Memories({ open, onClose }: MemoriesProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const tileElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  // useState's lazy-init form (unlike useRef's) only ever calls createPool()
  // once, no matter how many times the component re-renders - matters here
  // since the pool closure carries the recency history that keeps photos
  // from repeating too soon, which a fresh instance per render would reset.
  const [pool] = useState(() => createPool());

  const tilesRef = useRef<Tile[]>([]);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);

  const scrollPosRef = useRef(0);
  const velocityRef = useRef(0);
  const viewportWRef = useRef(0);
  const viewportHRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const dragRef = useRef<{ id: number; startX: number; startY: number; lastY: number; lastT: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (!open) { setReady(false); return; }
    const el = fieldRef.current;
    if (!el) return;

    const rebuild = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      viewportWRef.current = w;
      viewportHRef.current = h;
      scrollPosRef.current = 0;
      velocityRef.current = 0;
      tileElsRef.current.clear();
      tilesRef.current = buildField(w, h, pool);
      setVersion(v => v + 1);
      setReady(true);
    };

    rebuild();
    const ro = new ResizeObserver(rebuild);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // The rAF loop is the only thing that moves tiles frame to frame - tile
  // membership (recycling one that's drifted off-screen) only changes
  // occasionally per tile, so structural React re-renders stay rare while
  // the actual motion is a plain style mutation on existing elements (same
  // approach as OpeningClouds' scroll-linked parallax).
  useEffect(() => {
    if (!open || !ready) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    lastTimeRef.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - lastTimeRef.current);
      lastTimeRef.current = now;
      const dtSec = dt / 1000;
      const tSec = now / 1000;

      if (!reducedMotion) scrollPosRef.current += AUTO_DRIFT_PX_S * dtSec;
      scrollPosRef.current += velocityRef.current * dtSec;
      velocityRef.current *= Math.pow(VELOCITY_DECAY, dtSec);
      if (Math.abs(velocityRef.current) < 0.5) velocityRef.current = 0;

      const viewportH = viewportHRef.current;
      const containerW = viewportWRef.current;
      const scrollPos = scrollPosRef.current;
      let structural = false;

      for (const tile of tilesRef.current) {
        let offset = scrollPos * tile.depth.speed * tile.speedJitter;
        let screenY = tile.y - offset;

        if (screenY < -BUFFER - tile.height) {
          respawnTile(tile, containerW, viewportH, scrollPos, 'bottom', pool);
          structural = true;
          offset = scrollPos * tile.depth.speed * tile.speedJitter;
          screenY = tile.y - offset;
        } else if (screenY > viewportH + BUFFER) {
          respawnTile(tile, containerW, viewportH, scrollPos, 'top', pool);
          structural = true;
          offset = scrollPos * tile.depth.speed * tile.speedJitter;
          screenY = tile.y - offset;
        }

        const sway = Math.sin(tSec * tile.swayFreq + tile.swayPhase) * tile.swayAmp;
        const rotation = tile.rotationBase + Math.sin(tSec * tile.rotationFreq + tile.rotationPhase) * tile.rotationAmp;
        const screenX = tile.x + sway - tile.width / 2;

        const tileEl = tileElsRef.current.get(tile.key);
        if (tileEl) {
          tileEl.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) rotate(${rotation}deg)`;

          let opacity = tile.depth.opacity;
          if (screenY < 0) opacity *= Math.max(0, Math.min(1, (screenY + BUFFER) / BUFFER));
          const bottomOverhang = (screenY + tile.height) - viewportH;
          if (bottomOverhang > 0) opacity *= Math.max(0, Math.min(1, (BUFFER - bottomOverhang) / BUFFER));
          tileEl.style.opacity = String(Math.max(0, opacity));
        }
      }

      if (structural) setVersion(v => v + 1);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [open, ready]);

  // Non-passive wheel listener - React's onWheel is passive by default, so
  // preventDefault() from JSX would silently no-op and the page would scroll
  // behind this fixed overlay (same reasoning as LandscapeContainer's own
  // blockBackgroundScroll).
  useEffect(() => {
    const el = backdropRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      velocityRef.current += e.deltaY * WHEEL_KICK;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastY: e.clientY, lastT: performance.now(), moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const now = performance.now();
    const dy = e.clientY - d.lastY;
    const dt = Math.max(1, now - d.lastT);
    d.lastY = e.clientY;
    d.lastT = now;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) d.moved = true;
    scrollPosRef.current -= dy;
    velocityRef.current = -(dy / dt) * 1000 * 0.6;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    if (!d.moved) onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  void version; // read to satisfy lint - tilesRef.current is the real data, this state just triggers reconciliation

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={backdropRef}
          className="memories-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <motion.h1
            className="memories-title"
            initial={{ opacity: 0, filter: 'blur(18px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(18px)' }}
            transition={{ duration: 1.6, delay: 0.3, ease: 'easeOut' }}
          >
            WELL OF MEMORIES
          </motion.h1>

          <div className="memories-field" ref={fieldRef}>
            {MEMORY_URLS.length === 0 && (
              <p className="memories-empty">no memories here yet...</p>
            )}
            {tilesRef.current.map(tile => (
              <div
                key={tile.key}
                ref={el => { if (el) tileElsRef.current.set(tile.key, el); else tileElsRef.current.delete(tile.key); }}
                className="memories-tile"
                style={{
                  width: tile.width,
                  height: tile.height,
                  filter: tile.depth.blur ? `blur(${tile.depth.blur}px)` : undefined,
                  transform: `translate3d(${tile.x - tile.width / 2}px, ${tile.y - scrollPosRef.current * tile.depth.speed * tile.speedJitter}px, 0) rotate(${tile.rotationBase}deg)`,
                }}
              >
                <img src={tile.src} alt="" draggable={false} loading="lazy" decoding="async" />
              </div>
            ))}
          </div>

          <button className="memories-close" onClick={onClose} aria-label="Close">×</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Memories;
