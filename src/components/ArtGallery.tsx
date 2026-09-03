import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';

import artGallery from '../assets/art-gallery';
import type { ArtGalleryItem } from '../assets/art-gallery';
import {
  allPlaqueVariants,
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

// A quarter-turn count (0-3, i.e. 0/90/180/270deg) plus independent
// horizontal/vertical mirroring - the full set of ways a frame painting can
// be reoriented without distorting it. `swapBox` is only true when a 90/270
// turn actually changes the window's effective orientation (a non-square
// frame turned sideways to read as landscape) - it's what tells FrameOverlay
// to pre-size the frame's box as though width/height were swapped before the
// turn. A same-shaped turn (square frame, or a plain 180) must NOT set this,
// or a tile whose own aspect isn't *exactly* square gets asymmetrically
// stretched by the box-swap math for no reason.
interface FrameOrientation {
  rotateQuarter: 0 | 1 | 2 | 3;
  mirrorX: boolean;
  mirrorY: boolean;
  swapBox: boolean;
}

interface FrameChoice {
  frame: FrameVariant;
  orientation: FrameOrientation;
  plaque: PlaqueVariant;
  plaqueDark: boolean;
  plaqueTextDark: boolean;
  brightness: number;
  saturateExtra: number;
  invert: boolean;
  blendExclude: boolean;
  extraFilter?: string;
}

// Which registered frame ratio each piece is mounted in, and whether it
// needs turning to read as landscape - a manual, hand-curated table rather
// than picking automatically from the piece's raw aspect, so the frame can
// be matched to the *vibe* of each painting rather than just its geometry
// (and so the 4:5 frame actually gets used sometimes, which an automatic
// closest-match never picked). `rotate` is quarter-turns away from upright;
// omit it (or 0) to mount the frame the normal way up.
//
// Every other field chooseFrame produces can be pinned here explicitly;
// anything left unset falls back to a neutral fixed default (no mirroring,
// no invert/blend, no extra brightness/saturation, first frame/plaque
// variant) rather than being randomized. Set `randomize: true` to opt a
// piece back into the old behavior - a deterministic-per-piece *random*
// roll - for whichever of these fields it didn't pin down itself:
// - `variant`: which painted frame ('a', 'b', ...) among the ones registered
//   for `ratioKey`, instead of the first one / a random one.
// - `plaque`: which plaque painting (by name) among the registered ones,
//   instead of the first one / a random one.
// - `plaqueDark`: forces the light/dark version of whichever plaque variant
//   gets picked (only matters if that variant has a dark version at all).
// - `mirrorX` / `mirrorY`: flip the frame art horizontally/vertically.
// - `brightness` / `saturation`: replace the frame's brightness/extra-
//   saturation multipliers applied on top of its base color-grade filter.
// - `invert` / `blendExclude`: extra look toggles applied to the frame art.
// - `filter`: extra CSS filter function(s) appended after the frame's own
//   color-grade filter, e.g. 'brightness(.5)'. A piece with a custom filter
//   never randomizes brightness/saturation/invert/blendExclude on top of it
//   (even with `randomize: true`), since those are meant to be hand-tuned
//   together with the filter - pin them explicitly here if needed.
interface FrameAssignment {
  ratioKey: '1-1' | '3-4' | '4-5';
  rotate?: 1 | 2 | 3;
  variant?: string;
  plaque?: string;
  plaqueDark?: boolean;
  plaqueTextDark?: boolean;
  mirrorX?: boolean;
  mirrorY?: boolean;
  brightness?: number;
  saturation?: number;
  invert?: boolean;
  blendExclude?: boolean;
  filter?: string;
  randomize?: boolean;
}

const FRAME_ASSIGNMENTS: Record<string, FrameAssignment> = {
  'trippy-landscape':              { ratioKey: '3-4', variant: 'a', saturation: .6, plaqueDark: false },
  'torus':                         { ratioKey: '4-5', variant: 'a', saturation: .5, brightness: 1.3, plaqueDark: true },
  'mystical-hill':                 { ratioKey: '1-1', variant: 'a', saturation: .2, brightness: 1.3, plaqueDark: false },
  'crying':                        { ratioKey: '3-4', variant: 'a', invert: true, saturation: 0, brightness: 1.5, filter: 'contrast(3)', plaqueDark: true, plaqueTextDark: true },

  'torenrave':                     { ratioKey: '1-1', variant: 'b', saturation: 0, brightness: 1, invert: true,  filter: 'contrast(1.6)', plaqueDark: false, plaqueTextDark: false },
  'beautiful-corner':              { ratioKey: '4-5', variant: 'b', saturation: .5, brightness: 1.4 },
  'een-leukertje':                 { ratioKey: '3-4', rotate: 2, saturation: .4, brightness: 1.3 },
  'hanna-cover':                   { ratioKey: '4-5', variant: 'a', saturation: .3, brightness: .7, invert: false },
  'kitchen-doodle':                { ratioKey: '3-4', rotate: 1, brightness: 1.3, saturation: .3 },
  'yuurisaibou-doodle':            { ratioKey: '4-5', variant: 'a', saturation: .3, brightness: 1.2 },
  'mosaic':                        { ratioKey: '1-1', rotate: 2 },
  'umu-worldview':                 { ratioKey: '3-4', rotate: 1, saturation: 1 },
  'halloween-toren-van-terreur':   { ratioKey: '3-4', variant: 'b', brightness: .4, filter: 'contrast(2)', saturation: .5, plaqueTextDark: false },

  'gefelicitno':                   { ratioKey: '3-4', randomize: true, saturation: 0, brightness: 1.3, rotate: 1 },
  'hanna-cover-purple':            { ratioKey: '1-1', variant: 'a', brightness: .6, filter: 'contrast(1.6)', rotate: 3, saturation: .7, plaqueTextDark: false, plaqueDark: false },
  'golf':                          { ratioKey: '4-5', randomize: true },
  'placemat':                      { ratioKey: '3-4', randomize: true, rotate: 1 },
  'onderwater-cafe':               { ratioKey: '3-4', randomize: true },
  'cool':                          { ratioKey: '1-1', randomize: true },
  'teeming':                       { ratioKey: '3-4', randomize: true, rotate: 1 },

  'halloween-boom':                { ratioKey: '4-5', randomize: true },
  'halloween-hattori-a':           { ratioKey: '3-4', randomize: true },
  'halloween-monster':             { ratioKey: '1-1', randomize: true },
  'halloween-yukiman':             { ratioKey: '3-4', randomize: true },
  'sfeer-foundry':                 { ratioKey: '3-4', randomize: true, rotate: 1 },
};

// Deterministically assigns each piece its manually-picked frame ratio (see
// FRAME_ASSIGNMENTS) a random variant/plaque among the ones that fit, and a
// per-piece flavor of filter/mirror tweaks - so pieces sharing the same frame
// or plaque painting still read as individually mounted rather than stamped
// copies.
function chooseFrame(item: ArtGalleryItem): FrameChoice {
  const assignment = FRAME_ASSIGNMENTS[item.id];
  if (!assignment) throw new Error(`ArtGallery: no FRAME_ASSIGNMENTS entry for "${item.id}"`);
  const randomize = assignment.randomize ?? false;
  const variants = variantsForRatio(assignment.ratioKey);
  const frame = assignment.variant
    ? variants.find(v => v.variant === assignment.variant) ?? (() => {
        throw new Error(`ArtGallery: no "${assignment.variant}" frame variant registered for ratio "${assignment.ratioKey}" (item "${item.id}")`);
      })()
    : randomize
      ? variants[Math.floor(rand01(`${item.id}:frame-variant`) * variants.length)]
      : variants[0];
  const rotateQuarter = assignment.rotate ?? 0;
  const plaques = allPlaqueVariants();
  const plaque = assignment.plaque
    ? plaques.find(p => p.name === assignment.plaque) ?? (() => {
        throw new Error(`ArtGallery: no "${assignment.plaque}" plaque variant registered (item "${item.id}")`);
      })()
    : randomize
      ? plaques[Math.floor(rand01(`${item.id}:plaque`) * plaques.length)]
      : plaques[0];
  // A custom `filter` means the piece's look is being hand-tuned, so these
  // four never get randomized on top of it (they can still be pinned
  // explicitly above) even when `randomize` is on.
  const hasCustomFilter = !!assignment.filter;
  const canRandomizeOverFilter = randomize && !hasCustomFilter;
  const invert = assignment.invert ?? (canRandomizeOverFilter && rand01(`${item.id}:frame-invert`) < 0.18);
  const blendExclude = assignment.blendExclude ?? (canRandomizeOverFilter && !invert && rand01(`${item.id}:frame-blend`) < 0.15);
  const plaqueDark = !!plaque.dark && (assignment.plaqueDark ?? (randomize && rand01(`${item.id}:plaque-dark`) < 0.5));
  return {
    frame,
    orientation: {
      rotateQuarter,
      mirrorX: assignment.mirrorX ?? (randomize && rand01(`${item.id}:mirror-x`) < 0.5),
      mirrorY: assignment.mirrorY ?? (randomize && rand01(`${item.id}:mirror-y`) < 0.5),
      swapBox: rotateQuarter % 2 === 1 && assignment.ratioKey !== '1-1',
    },
    plaque,
    plaqueDark,
    plaqueTextDark: assignment.plaqueTextDark ?? !plaqueDark,
    brightness: assignment.brightness ?? (canRandomizeOverFilter ? 0.85 + rand01(`${item.id}:frame-bright`) * 0.35 : 1),
    saturateExtra: assignment.saturation ?? (canRandomizeOverFilter ? 0.28 + rand01(`${item.id}:frame-sat`) * 0.2 : 1),
    invert,
    blendExclude,
    extraFilter: assignment.filter,
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

// Same as above, but with x/y swapped for a quarter-turned frame - after a
// 90/270 turn, what was the frame's horizontal overhang reads as vertical on
// screen (and vice versa), so anything laying out around the frame's visible
// footprint (rather than the frame image's own local coordinates) needs this
// version instead.
function effectiveOverhangFraction(choice: FrameChoice): { x: number; y: number } {
  const overhang = frameOverhangFraction(choice.frame.spec);
  return choice.orientation.swapBox ? { x: overhang.y, y: overhang.x } : overhang;
}

function frameFilter(choice: FrameChoice): string {
  return `url(#${COLOR_GRADE_FILTER_ID}) ${choice.invert ? 'invert(1) ' : ''}saturate(${choice.saturateExtra}) brightness(${choice.brightness})${choice.extraFilter ? ` ${choice.extraFilter}` : ''}`;
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
    const pad = RANK_PAD[item.rank] * padScale;
    const overhang = effectiveOverhangFraction(frameChoices[item.id]);
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
  itemAspect: number;
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
function FrameOverlay({ choice, itemAspect }: FrameOverlayProps) {
  const overhang = frameOverhangFraction(choice.frame.spec);
  const { rotateQuarter, mirrorX, mirrorY, swapBox } = choice.orientation;

  const shared = {
    backgroundImage: `url(${choice.frame.url})`,
    filter: frameFilter(choice),
    mixBlendMode: choice.blendExclude ? 'exclude' : undefined,
  } as React.CSSProperties;

  const orientTransform: string[] = [];
  if (rotateQuarter) orientTransform.push(`rotate(${rotateQuarter * 90}deg)`);
  if (mirrorX) orientTransform.push('scaleX(-1)');
  if (mirrorY) orientTransform.push('scaleY(-1)');

  if (swapBox) {
    // A quarter-turned frame needs its own box pre-sized as though the box
    // itself were rotated (width/height swapped) *before* the turn is
    // applied - otherwise the turn just squashes the frame art into the
    // box's real (un-rotated) proportions instead of filling it.
    //
    // Centering that oversized box can't use the `inset:0 + margin:auto`
    // trick (used below for the unturned case): with top/right/bottom/left
    // *all* pinned to 0 and an explicit width/height layered on top, the box
    // is over-constrained, and browsers resolve that by flushing it into a
    // corner rather than splitting the overflow evenly - exactly the
    // "sticking out on one side" glitch this fixes. Anchoring only
    // top/left to the center and pulling the box back by exactly half its
    // own (pre-turn) size via `translate(-50%, -50%)` has no such conflict,
    // so it stays centered at any size, before or after the turn.
    return (
      <div
        className="art-gallery-frame"
        style={{
          ...shared,
          top: '50%',
          left: '50%',
          width: `${(1 / itemAspect) * (1 + 2 * overhang.x) * 100}%`,
          height: `${itemAspect * (1 + 2 * overhang.y) * 100}%`,
          transform: ['translate(-50%, -50%)', ...orientTransform].join(' '),
        }}
      />
    );
  }

  return (
    <div
      className="art-gallery-frame"
      style={{
        ...shared,
        inset: `${-overhang.y * 100}% ${-overhang.x * 100}%`,
        transform: orientTransform.length ? orientTransform.join(' ') : undefined,
      }}
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
  const overhang = effectiveOverhangFraction(choice);
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
      <span className="art-gallery-plaque__title" style={{ color: choice.plaqueTextDark ? 'rgba(22, 15, 10, 0.88)' : 'rgba(255, 250, 240, 0.92)' }}>{title}</span>
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
        <FrameOverlay choice={choice} itemAspect={item.aspect} />
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
        <FrameOverlay choice={choice} itemAspect={item.aspect} />
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
