import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';

import artGallery from '../assets/art-gallery';
import type { ArtGalleryItem } from '../assets/art-gallery';
import playIcon from '../assets/play.png';

import './ArtGallery.scss';

const artGalleryImages = import.meta.glob<string>(
  '../assets/art-gallery/images/*',
  { eager: true, import: 'default' }
);
const artGalleryVideos = import.meta.glob<string>(
  '../assets/art-gallery/videos/*',
  { eager: true, import: 'default' }
);

const getImage = (id: string): string =>
  artGalleryImages[`../assets/art-gallery/images/${id}.jpg`] ?? '';

const getVideo = (id: string): string =>
  artGalleryVideos[`../assets/art-gallery/videos/${id}.mp4`] ?? '';

const sortedGallery = artGallery.slice().sort((a, b) => a.rank - b.rank);

// Simple deterministic string hash so each piece always gets the same
// "random" placement/drift, instead of reshuffling on every render.
const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
};
// A distinct pseudo-random stream per (id, salt) pair, in [0, 1).
const rand01 = (seed: string): number => (hashString(seed) % 10007) / 10007;

// Target box width in px per rank, before real-aspect height and responsive
// scaling are applied. Higher rank = larger - the "front section" pieces
// should feel like the showcase of the gallery, not equal-sized thumbnails.
const RANK_WIDTH_BAND: Record<ArtGalleryItem['rank'], [number, number]> = {
  1: [320, 480],
  2: [235, 330],
  3: [175, 235],
  4: [130, 175],
};

// Full breathing room reserved around a piece (split between it and its
// neighbour), per rank. Rank 1 gets so much air that on most screens two of
// them can't fit side by side - they end up carrying a row on their own,
// like the showcase pieces they are, instead of crowding against whatever
// happens to land next to them.
const RANK_PAD: Record<ArtGalleryItem['rank'], number> = {
  1: 130,
  2: 68,
  3: 42,
  4: 26,
};

interface PlacedTile {
  item: ArtGalleryItem;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  driftX: number;
  driftY: number;
  driftDuration: number;
  driftDelay: number;
}

interface GalleryLayout {
  placed: PlacedTile[];
  height: number;
}

// Places every piece with a skyline/shelf packer: for each item (already in
// rank order) it finds the shallowest run of free columns it fits in, among
// near-tied options it picks randomly rather than always the leftmost, and
// reserves a gap-padded footprint before nudging the visible tile inside
// that footprint with a small random offset. The footprint reservation is
// what guarantees no two tiles ever overlap even after the random nudge -
// a scattered, "rising up from below" spread rather than a visible grid.
function computeGalleryLayout(items: ArtGalleryItem[], containerWidth: number): GalleryLayout {
  if (containerWidth <= 0) return { placed: [], height: 0 };

  const mobile = containerWidth < 640;
  const scale = containerWidth < 900 ? Math.max(0.4, containerWidth / 900) : 1;
  // Padding shrinks with the piece on small screens too, but never below
  // ~60% - the point of it is breathing room, which matters most when
  // space is already tight.
  const padScale = Math.max(0.6, scale);
  const unit = 10;
  const cols = Math.max(8, Math.round(containerWidth / unit));
  const skyline = new Array(cols).fill(0);
  const placed: PlacedTile[] = [];

  for (const item of items) {
    const [lo, hi] = RANK_WIDTH_BAND[item.rank];
    const width = (lo + rand01(`${item.id}:w`) * (hi - lo)) * scale;
    const height = width / item.aspect;
    const pad = RANK_PAD[item.rank] * padScale;
    const boxW = width + pad;
    const boxH = height + pad;
    const colSpan = Math.max(1, Math.min(cols, Math.round(boxW / unit)));

    let minY = Infinity;
    for (let c = 0; c <= cols - colSpan; c++) {
      let y = 0;
      for (let k = c; k < c + colSpan; k++) y = Math.max(y, skyline[k]);
      if (y < minY) minY = y;
    }
    const tolerance = Math.max(24, height * 0.14);
    const candidates: number[] = [];
    for (let c = 0; c <= cols - colSpan; c++) {
      let y = 0;
      for (let k = c; k < c + colSpan; k++) y = Math.max(y, skyline[k]);
      if (y <= minY + tolerance) candidates.push(c);
    }
    const chosenC = candidates[Math.floor(rand01(`${item.id}:tie`) * candidates.length)] ?? 0;
    let placeY = 0;
    for (let k = chosenC; k < chosenC + colSpan; k++) placeY = Math.max(placeY, skyline[k]);
    for (let k = chosenC; k < chosenC + colSpan; k++) skyline[k] = placeY + boxH;

    const jitterMax = pad * 0.3;
    const jitterX = (rand01(`${item.id}:jx`) - 0.5) * 2 * jitterMax;
    const jitterY = (rand01(`${item.id}:jy`) - 0.5) * 2 * jitterMax;

    placed.push({
      item,
      x: chosenC * unit + pad / 2 + jitterX,
      y: placeY + pad / 2 + jitterY,
      width,
      height,
      rotation: (rand01(`${item.id}:rot`) - 0.5) * 2 * (mobile ? 2.2 : 3.2),
      driftX: (8 + rand01(`${item.id}:ddx`) * 9) * (mobile ? 0.6 : 1),
      driftY: (8 + rand01(`${item.id}:ddy`) * 9) * (mobile ? 0.6 : 1),
      driftDuration: 11 + rand01(`${item.id}:dur`) * 9,
      driftDelay: -(rand01(`${item.id}:delay`) * 19),
    });
  }

  return { placed, height: Math.max(0, ...skyline) + 24 };
}

interface GalleryTileProps {
  placed: PlacedTile;
  index: number;
  onOpen: (item: ArtGalleryItem) => void;
}

function GalleryTile({ placed, index, onOpen }: GalleryTileProps) {
  const { item } = placed;

  return (
    <motion.div
      className="art-gallery-tile"
      style={{
        left: placed.x,
        top: placed.y,
        width: placed.width,
        height: placed.height,
        '--base-rotate': `${placed.rotation}deg`,
        '--drift-x': `${placed.driftX}px`,
        '--drift-y': `${placed.driftY}px`,
        '--drift-duration': `${placed.driftDuration}s`,
        '--drift-delay': `${placed.driftDelay}s`,
      } as React.CSSProperties}
      onClick={() => onOpen(item)}
      initial={{ opacity: 0, y: 70, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.09, 1.8),
        default: { type: 'spring', mass: 1.3, stiffness: 55, damping: 13 },
        opacity: { duration: 0.9, ease: 'easeOut' },
      }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
    >
      <motion.img
        layoutId={`art-piece-${item.id}`}
        src={getImage(item.image)}
        alt={item.title}
        className="art-gallery-tile__image"
      />
      {item.video && (
        <img src={playIcon} className="art-gallery-tile__play" alt="" aria-hidden="true" />
      )}
    </motion.div>
  );
}

// Tracks pinch-to-zoom and (once zoomed) single-finger panning on the
// fullscreen artwork. Kept deliberately separate from framer-motion's own
// `drag` gesture (used for swipe-to-dismiss), which is only enabled while
// this reports scale === 1, so the two never fight over the same touches.
function usePinchZoom() {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [pinching, setPinching] = useState(false);
  const gesture = useRef<{
    mode: 'none' | 'pinch' | 'pan';
    startDist?: number;
    startScale?: number;
    lastX?: number;
    lastY?: number;
  }>({ mode: 'none' });

  const touchDistance = (touches: React.TouchList) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length >= 2) {
      setPinching(true);
      gesture.current = { mode: 'pinch', startDist: touchDistance(e.touches), startScale: transform.scale };
    } else if (e.touches.length === 1 && transform.scale > 1.02) {
      gesture.current = { mode: 'pan', lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (g.mode === 'pinch' && e.touches.length >= 2 && g.startDist) {
      const ratio = touchDistance(e.touches) / g.startDist;
      const scale = Math.min(4, Math.max(1, g.startScale! * ratio));
      setTransform(t => ({ ...t, scale }));
    } else if (g.mode === 'pan' && e.touches.length === 1 && g.lastX !== undefined) {
      const dx = e.touches[0].clientX - g.lastX;
      const dy = e.touches[0].clientY - g.lastY!;
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
      g.lastX = e.touches[0].clientX;
      g.lastY = e.touches[0].clientY;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length >= 2) return;
    setPinching(false);
    if (e.touches.length === 1) {
      gesture.current = { mode: 'pan', lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
    } else {
      gesture.current = { mode: 'none' };
      setTransform(t => (t.scale <= 1.02 ? { scale: 1, x: 0, y: 0 } : t));
    }
  };

  return {
    scale: transform.scale,
    style: { scale: transform.scale, x: transform.x, y: transform.y },
    isZoomed: transform.scale > 1.02 || pinching,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}

interface GalleryDetailProps {
  item: ArtGalleryItem;
  onClose: () => void;
}

function GalleryDetail({ item, onClose }: GalleryDetailProps) {
  const pinch = usePinchZoom();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Non-silent pieces try to autoplay with sound on open (allowed by browsers
  // since this follows directly from the user's click). If that's blocked,
  // fall back to a muted autoplay instead of just sitting paused - loopSilently
  // pieces are already muted/looping via their element attributes below.
  useEffect(() => {
    if (!item.video || item.loopSilently) return;
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    v.muted = false;
    v.play().catch(() => {
      if (cancelled || !videoRef.current) return;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    });
    return () => { cancelled = true; };
  }, [item.video, item.loopSilently]);

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const distance = Math.hypot(info.offset.x, info.offset.y);
    const velocity = Math.hypot(info.velocity.x, info.velocity.y);
    if (distance > 110 || velocity > 550) onClose();
  };

  const sharedProps = {
    layoutId: `art-piece-${item.id}`,
    className: 'art-gallery-detail__media',
    drag: !pinch.isZoomed,
    dragElastic: 0.65,
    dragMomentum: false,
    onDragEnd: handleDragEnd,
    style: pinch.style,
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    ...pinch.handlers,
  } as const;

  return (
    <motion.div
      className="art-gallery-detail-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      onClick={onClose}
    >
      {item.video ? (
        <motion.video
          {...sharedProps}
          ref={videoRef}
          src={getVideo(item.video)}
          poster={getImage(item.image)}
          controls={!item.loopSilently}
          autoPlay
          loop={item.loopSilently}
          muted={item.loopSilently}
          playsInline
        />
      ) : (
        <motion.img
          {...sharedProps}
          src={getImage(item.image)}
          alt={item.title}
        />
      )}
      <button className="art-gallery-detail__close" onClick={onClose} aria-label="Close">×</button>
    </motion.div>
  );
}

interface ArtGalleryProps {
  open: boolean;
  onClose: () => void;
}

function ArtGallery({ open, onClose }: ArtGalleryProps) {
  const [selected, setSelected] = useState<ArtGalleryItem | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  // Distinguishes a tap-to-close from a drag/swipe/scroll gesture: only a
  // pointer down+up pair that barely moved counts as a "click the background
  // to close" - anything else (scrolling the sheet, middle-click autoscroll,
  // a touch swipe) is left alone.
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      return;
    }
    const el = gridRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const { placed, height } = useMemo(
    () => computeGalleryLayout(sortedGallery, containerWidth),
    [containerWidth]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // ignore middle/right click
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = pointerDownPos.current;
    pointerDownPos.current = null;
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) return; // was a drag/swipe/scroll
    // A piece, or the fullscreen viewer (which owns its own click-outside-to-close
    // back to the grid) - either way this isn't a "close the whole gallery" click.
    if ((e.target as HTMLElement).closest('.art-gallery-tile, .art-gallery-detail-backdrop')) return;
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="art-gallery-backdrop"
          initial={{ opacity: 0, pointerEvents: 'auto' }}
          animate={{ opacity: 1, pointerEvents: 'auto' }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <motion.div
            className="art-gallery-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', mass: 3, stiffness: 26, damping: 14 }}
          >
            <motion.h1
              className="art-gallery-title"
              initial={{ opacity: 0, filter: 'blur(18px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(18px)' }}
              transition={{ duration: 1.6, delay: 0.3, ease: 'easeOut' }}
            >
              THE GALLERY
            </motion.h1>
            <div className="art-gallery-grid" ref={gridRef} style={{ height }}>
              {placed.map((p, i) => (
                <GalleryTile key={p.item.id} placed={p} index={i} onOpen={setSelected} />
              ))}
            </div>
          </motion.div>

          <AnimatePresence>
            {selected && <GalleryDetail key={selected.id} item={selected} onClose={() => setSelected(null)} />}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ArtGallery;
