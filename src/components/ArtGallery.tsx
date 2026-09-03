import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';

import artGallery from '../assets/art-gallery';
import type { ArtGalleryItem } from '../assets/art-gallery';
import {
  allPlaqueVariants,
  closestFrameRatioKey,
  variantsForRatio,
  type FrameSpec,
  type FrameVariant,
  type PlaqueVariant,
} from '../assets/art-gallery/frames';
import playIcon from '../assets/play.png';
import { COLOR_GRADE_FILTER_ID } from './ColorGradeFilter';
import { usePinchZoom } from '../hooks/usePinchZoom';

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

interface FrameChoice {
  frame: FrameVariant;
  plaque: PlaqueVariant;
  plaqueDark: boolean;
  flip: boolean;
  brightness: number;
  saturateExtra: number;
  invert: boolean;
  blendExclude: boolean;
}

// Deterministically assigns each piece the frame whose window aspect ratio is
// closest to its own, a random variant/plaque among the ones that fit, and a
// per-piece flavor of filter/orientation tweaks - so pieces sharing the same
// frame or plaque painting still read as individually mounted rather than
// stamped copies. Deliberately doesn't vary rotation independently of the
// artwork: the frame and the piece it holds always rotate together as one
// rigid unit (via the tile's own --base-rotate), otherwise the frame's window
// swings out of alignment with the artwork underneath it.
function chooseFrame(item: ArtGalleryItem): FrameChoice {
  const variants = variantsForRatio(closestFrameRatioKey(item.aspect));
  const frame = variants[Math.floor(rand01(`${item.id}:frame-variant`) * variants.length)];
  const plaques = allPlaqueVariants();
  const plaque = plaques[Math.floor(rand01(`${item.id}:plaque`) * plaques.length)];
  const invert = rand01(`${item.id}:frame-invert`) < 0.18;
  const blendExclude = !invert && rand01(`${item.id}:frame-blend`) < 0.15;
  return {
    frame,
    plaque,
    plaqueDark: !!plaque.dark && rand01(`${item.id}:plaque-dark`) < 0.5,
    flip: rand01(`${item.id}:frame-flip`) < 0.5,
    brightness: 0.85 + rand01(`${item.id}:frame-bright`) * 0.35,
    saturateExtra: 0.28 + rand01(`${item.id}:frame-sat`) * 0.2,
    invert,
    blendExclude,
  };
}

const frameChoices: Record<string, FrameChoice> = Object.fromEntries(
  sortedGallery.map(item => [item.id, chooseFrame(item)])
);

// Fraction of the window's own width/height that the frame art extends
// beyond the window on each side - usable both as a CSS percentage (for the
// frame overlay's `inset`, which is agnostic to px vs responsive sizing) and,
// multiplied by an actual px size, for reserving layout footprint.
function frameOverhangFraction(spec: FrameSpec): { x: number; y: number } {
  return {
    x: (spec.frameW - spec.windowW) / (2 * spec.windowW),
    y: (spec.frameH - spec.windowH) / (2 * spec.windowH),
  };
}

function frameFilter(choice: FrameChoice): string {
  return `url(#${COLOR_GRADE_FILTER_ID}) ${choice.invert ? 'invert(1) ' : ''}saturate(${choice.saturateExtra}) brightness(${choice.brightness})`;
}

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
    // Boxed to the artwork's own real aspect (not the frame's window aspect) -
    // the frame is the thing that gets stretched to fit exactly around this,
    // via non-uniform (independent x/y) scaling in FrameOverlay, rather than
    // the artwork being letterboxed to match the frame.
    const height = width / item.aspect;
    const spec = frameChoices[item.id].frame.spec;
    const pad = RANK_PAD[item.rank] * padScale;
    const overhang = frameOverhangFraction(spec);
    const padX = pad + overhang.x * width * 2;
    const padY = pad + overhang.y * height * 2;
    const boxW = width + padX;
    const boxH = height + padY;
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
      x: chosenC * unit + padX / 2 + jitterX,
      y: placeY + padY / 2 + jitterY,
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

interface FrameOverlayProps {
  choice: FrameChoice;
}

// The frame PNG is grayscale watercolor art - run through the same color-grade
// filter as the rest of the landscape, it picks up the current trippy palette
// automatically (and keeps evolving with it). `inset` is expressed as a CSS
// percentage, with a different value on each axis - since the containing box
// is shaped to the artwork's own aspect (which the frame's native aspect
// only approximately matches), this non-uniformly stretches the frame art so
// its window lines up exactly with the box on all four sides, no gaps. This
// works identically whether the box is a fixed px size (grid tile) or fluid
// (lightbox), since percentages are always relative to the box itself.
function FrameOverlay({ choice }: FrameOverlayProps) {
  const overhang = frameOverhangFraction(choice.frame.spec);
  return (
    <div
      className="art-gallery-frame"
      style={{
        inset: `${-overhang.y * 100}% ${-overhang.x * 100}%`,
        backgroundImage: `url(${choice.frame.url})`,
        transform: choice.flip ? 'scaleX(-1)' : undefined,
        filter: frameFilter(choice),
        mixBlendMode: choice.blendExclude ? 'exclude' : undefined,
      } as React.CSSProperties}
    />
  );
}

interface PlaqueProps {
  choice: FrameChoice;
  title: string;
}

// Mounted on the frame's bottom rail: centered a little way into the border
// band below the window (not all the way out at the frame's outer edge,
// which reads as floating off the frame entirely). The background layer gets
// the same color-grade recipe as the frame so the two read as one mounted
// piece; the title sits on an unfiltered layer on top so it stays legible.
function Plaque({ choice, title }: PlaqueProps) {
  const overhang = frameOverhangFraction(choice.frame.spec);
  const dark = choice.plaqueDark && choice.plaque.dark;
  const src = dark ? choice.plaque.dark! : choice.plaque.light;
  return (
    <div
      className={`art-gallery-plaque${dark ? ' art-gallery-plaque--dark' : ''}`}
      style={{ top: `${100 + overhang.y * 100 * 0.3}%` }}
    >
      <div
        className="art-gallery-plaque__bg"
        style={{ backgroundImage: `url(${src})`, filter: frameFilter(choice) } as React.CSSProperties}
      />
      <span className="art-gallery-plaque__title">{title}</span>
    </div>
  );
}

interface GalleryTileProps {
  placed: PlacedTile;
  index: number;
  onOpen: (item: ArtGalleryItem) => void;
}

function GalleryTile({ placed, index, onOpen }: GalleryTileProps) {
  const { item } = placed;
  const choice = frameChoices[item.id];

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
      <motion.div layoutId={`art-piece-${item.id}`} className="art-gallery-tile__frame-unit">
        <img
          src={getImage(item.image)}
          alt={item.title}
          className="art-gallery-tile__image"
        />
        <FrameOverlay choice={choice} />
        <Plaque choice={choice} title={item.title} />
      </motion.div>
      {item.video && (
        <img src={playIcon} className="art-gallery-tile__play" alt="" aria-hidden="true" />
      )}
    </motion.div>
  );
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

  const choice = frameChoices[item.id];

  const sharedProps = {
    layoutId: `art-piece-${item.id}`,
    className: 'art-gallery-detail__frame-unit',
    drag: !pinch.isZoomed,
    dragElastic: 0.65,
    dragMomentum: false,
    onDragEnd: handleDragEnd,
    style: { ...pinch.style, '--window-aspect': item.aspect } as React.CSSProperties,
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
      <motion.div {...sharedProps}>
        {item.video ? (
          <video
            ref={videoRef}
            className="art-gallery-detail__media"
            src={getVideo(item.video)}
            poster={getImage(item.image)}
            controls={!item.loopSilently}
            autoPlay
            loop={item.loopSilently}
            muted={item.loopSilently}
            playsInline
          />
        ) : (
          <img
            className="art-gallery-detail__media"
            src={getImage(item.image)}
            alt={item.title}
          />
        )}
        <FrameOverlay choice={choice} />
        <Plaque choice={choice} title={item.title} />
      </motion.div>
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
