import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import './Memories.scss';

// Only the generated thumbnails (see scripts/gen-memories-thumbs.mjs, run
// automatically before dev/build) are ever imported here - never the raw
// originals in src/assets/memories, which can be several MB straight off a
// phone. `eager: true` just resolves each to its build-time URL string
// (free - no image bytes are fetched); the actual bytes only load once a
// tile's <img> is mounted into the DOM, which the recycling conveyor below
// keeps bounded to a few dozen at a time no matter how many hundred photos
// exist on disk.
const memoryThumbs = import.meta.glob<string>(
  '../assets/memories-thumbs/*',
  { eager: true, import: 'default' }
);
const MEMORY_URLS = Object.values(memoryThumbs);

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A pool of every photo, drawn in shuffled order and reshuffled once
// exhausted - so a long scroll session eventually cycles back through
// everything (never "runs out"), but never repeats in the same order twice.
function createPool() {
  let order = shuffle(MEMORY_URLS);
  let i = 0;
  return (): string => {
    if (MEMORY_URLS.length === 0) return '';
    if (i >= order.length) { order = shuffle(MEMORY_URLS); i = 0; }
    return order[i++];
  };
}

// Depth tiers, back to front: smaller/slower/dimmer/blurrier reads as
// further away, bigger/faster/sharper as closer - the actual parallax cue.
// Lanes cycle through these so the field reads as several depths at once
// rather than one flat layer.
interface Depth { speed: number; minW: number; maxW: number; opacity: number; blur: number; }
const DEPTHS: Depth[] = [
  { speed: 0.30, minW: 60,  maxW: 100, opacity: 0.5,  blur: 1.4 },
  { speed: 0.55, minW: 95,  maxW: 150, opacity: 0.72, blur: 0.5 },
  { speed: 0.85, minW: 140, maxW: 210, opacity: 0.9,  blur: 0 },
  { speed: 1.25, minW: 190, maxW: 280, opacity: 1,    blur: 0 },
];

// Portrait / square / landscape / wide - picked per tile so "some pics are
// big, some small" also reads as varied shapes, not just scaled rectangles.
const ASPECTS = [0.72, 1, 1.3, 1.6];

const GAP = 22; // vertical gap between stacked tiles within a lane, px
const BUFFER = 220; // px beyond the viewport edge a tile is kept alive for, to avoid pop-in
const AUTO_DRIFT_PX_S = 22; // gentle ambient rise even with no input
const WHEEL_KICK = 2.4;
const VELOCITY_DECAY = 0.06; // fraction of velocity retained per second (exponential)

let tileKeyCounter = 0;

interface Tile {
  key: number;
  src: string;
  width: number;
  height: number;
  y: number; // top edge in the lane's own unbounded coordinate space
  rotation: number;
}

interface Lane {
  leftPercent: number;
  depth: Depth;
  tiles: Tile[];
}

function randomTileShape(depth: Depth) {
  const width = depth.minW + Math.random() * (depth.maxW - depth.minW);
  const aspect = ASPECTS[Math.floor(Math.random() * ASPECTS.length)];
  return { width, height: width / aspect };
}

function makeTile(depth: Depth, nextImage: () => string): Tile {
  const { width, height } = randomTileShape(depth);
  return {
    key: tileKeyCounter++,
    src: nextImage(),
    width,
    height,
    y: 0,
    rotation: (Math.random() - 0.5) * 10,
  };
}

function fillLane(depth: Depth, viewportH: number, nextImage: () => string): Tile[] {
  const tiles: Tile[] = [];
  let y = -BUFFER - Math.random() * GAP * 3;
  while (y < viewportH + BUFFER) {
    const t = makeTile(depth, nextImage);
    t.y = y;
    tiles.push(t);
    y += t.height + GAP;
  }
  return tiles;
}

function laneCountFor(width: number): number {
  return Math.max(3, Math.min(7, Math.round(width / 190)));
}

function buildLanes(containerWidth: number, viewportH: number, nextImage: () => string): Lane[] {
  const count = laneCountFor(containerWidth);
  return Array.from({ length: count }, (_, i) => {
    const depth = DEPTHS[i % DEPTHS.length];
    const jitter = (Math.random() - 0.5) * (60 / count);
    return {
      leftPercent: ((i + 0.5) / count) * 100 + jitter,
      depth,
      tiles: fillLane(depth, viewportH, nextImage),
    };
  });
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
  // since a structural tile recycle triggers a re-render fairly often during
  // active scrolling, and createPool() does a real O(n) shuffle.
  const [pool] = useState(() => createPool());

  const lanesRef = useRef<Lane[]>([]);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);

  const scrollPosRef = useRef(0);
  const velocityRef = useRef(0);
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
      viewportHRef.current = h;
      scrollPosRef.current = 0;
      velocityRef.current = 0;
      tileElsRef.current.clear();
      lanesRef.current = buildLanes(w, h, pool);
      setVersion(v => v + 1);
      setReady(true);
    };

    rebuild();
    const ro = new ResizeObserver(rebuild);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // The rAF loop is the only thing that moves tiles frame to frame - lane
  // membership (adding/removing DOM nodes) only changes on recycling, which
  // is cheap and infrequent per lane, so structural React re-renders stay
  // rare while the actual motion is a plain style mutation on existing
  // elements (same approach as OpeningClouds' scroll-linked parallax).
  useEffect(() => {
    if (!open || !ready) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    lastTimeRef.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - lastTimeRef.current);
      lastTimeRef.current = now;
      const dtSec = dt / 1000;

      if (!reducedMotion) scrollPosRef.current += AUTO_DRIFT_PX_S * dtSec;
      scrollPosRef.current += velocityRef.current * dtSec;
      velocityRef.current *= Math.pow(VELOCITY_DECAY, dtSec);
      if (Math.abs(velocityRef.current) < 0.5) velocityRef.current = 0;

      const viewportH = viewportHRef.current;
      let structural = false;

      for (const lane of lanesRef.current) {
        const offset = scrollPosRef.current * lane.depth.speed;

        while (lane.tiles.length) {
          const first = lane.tiles[0];
          if (first.y - offset + first.height >= -BUFFER) break;
          lane.tiles.shift();
          const last = lane.tiles[lane.tiles.length - 1];
          const t = makeTile(lane.depth, pool);
          t.y = (last ? last.y + last.height : offset - BUFFER) + GAP;
          lane.tiles.push(t);
          structural = true;
        }

        while (lane.tiles.length) {
          const last = lane.tiles[lane.tiles.length - 1];
          if (last.y - offset <= viewportH + BUFFER) break;
          lane.tiles.pop();
          const first = lane.tiles[0];
          const t = makeTile(lane.depth, pool);
          t.y = (first ? first.y : offset + viewportH + BUFFER) - GAP - t.height;
          lane.tiles.unshift(t);
          structural = true;
        }

        for (const tile of lane.tiles) {
          const tileEl = tileElsRef.current.get(tile.key);
          if (!tileEl) continue;
          const screenY = tile.y - offset;
          tileEl.style.transform = `translate3d(-50%, ${screenY}px, 0) rotate(${tile.rotation}deg)`;

          let opacity = lane.depth.opacity;
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

  void version; // read to satisfy lint - lanesRef.current is the real data, this state just triggers reconciliation

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
            {lanesRef.current.map((lane, li) => (
              <div key={li} className="memories-lane" style={{ left: `${lane.leftPercent}%` }}>
                {lane.tiles.map(tile => (
                  <div
                    key={tile.key}
                    ref={el => { if (el) tileElsRef.current.set(tile.key, el); else tileElsRef.current.delete(tile.key); }}
                    className="memories-tile"
                    style={{
                      width: tile.width,
                      height: tile.height,
                      filter: lane.depth.blur ? `blur(${lane.depth.blur}px)` : undefined,
                      transform: `translate3d(-50%, ${tile.y - scrollPosRef.current * lane.depth.speed}px, 0) rotate(${tile.rotation}deg)`,
                    }}
                  >
                    <img src={tile.src} alt="" draggable={false} loading="lazy" decoding="async" />
                  </div>
                ))}
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
