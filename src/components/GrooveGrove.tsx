import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { MotionProps } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

import VINYLS, { getCover, GROVE_TITLE, GROVE_INTRO } from '../assets/groove-grove';
import type { GrooveVinyl, SeriesEntry } from '../assets/groove-grove';

import groveImg from '../assets/grove.png';
// vinyl.webp, not the 743KB source PNG next to it: the record is never drawn
// wider than ~208px.
import vinylImg from '../assets/vinyl.webp';

import './GrooveGrove.scss';

// ---------------------------------------------------------------------------
// deterministic per-vinyl randomness
// ---------------------------------------------------------------------------

// Same trick the art gallery uses: a stable hash per (id, salt) pair, so every
// vinyl always lands in the same spot with the same look, instead of
// reshuffling itself on every render.
const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
};
const rand01 = (seed: string): number => (hashString(seed) % 10007) / 10007;

// ---------------------------------------------------------------------------
// the look of one record
// ---------------------------------------------------------------------------

// vinyl.png is one grayscale record, so without this every disc in the grove
// would be a pixel-identical stamp of every other. A per-disc brightness/
// contrast/saturation wobble breaks that up. No inversion: a mix of
// light/dark records read as too busy for a field this size, all-dark reads
// as records.
//
// The color grade itself is deliberately NOT part of this filter (see
// __tint in DiscFace below) - not primarily because this disc is often
// rotating, but because the app's shared `url(#landscape-color-grade)`
// filter ticks its own attributes every 150ms (see ColorGradeFilter.tsx),
// and *every* element referencing it has to be re-rasterized on each tick
// regardless of whether that element is itself animating. That's cheap when
// only a couple of things use it at once; the grove can have a dozen-plus
// vinyls on screen referencing it simultaneously, and that's what actually
// read as broad, scroll-independent jank. __tint sidesteps the filter
// entirely for these, reading a `--color-grade-flat` CSS variable the
// filter component also maintains, refreshed far less often and eased
// through a slow `transition: background-color` instead.
interface DiscLook {
  imgFilter: string;
  coverOpacity: number;
}

function discLook(id: string): DiscLook {
  const brightness = 0.84 + rand01(`${id}:bright`) * 0.4;
  const contrast = 0.88 + rand01(`${id}:contrast`) * 0.4;
  const saturate = 0.2 + rand01(`${id}:sat`) * 0.35;
  return {
    imgFilter: `saturate(${saturate.toFixed(2)}) brightness(${brightness.toFixed(2)}) contrast(${contrast.toFixed(2)})`,
    coverOpacity: 0.5,
  };
}

// ---------------------------------------------------------------------------
// text around the rim
// ---------------------------------------------------------------------------

// In the disc's own 100x100 viewBox. The disc image itself is rendered at
// 80% size within that box (see .groove-vinyl__img/__cover), so a radius of
// 46 sits clear of its edge - genuinely *around* the record, not printed on
// its label - with room to spare before the SVG's own bounds.
const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_FONT_SIZE = 6.4;
const RING_SEPARATOR = ' ✦ ';

// Rough advance width per character, since there's no way to measure real text
// metrics before paint and the ring has to decide how many times the title
// fits around the circle *while* laying itself out.
const charWidth = (ch: string, fontSize: number): number => {
  if (/[　-鿿＀-￯゠-ヿ぀-ゟ]/.test(ch)) return fontSize;      // CJK: square-ish
  if (/[A-Z0-9]/.test(ch)) return fontSize * 0.6;
  if (/[il.,'!|]/.test(ch)) return fontSize * 0.26;
  if (/\s/.test(ch)) return fontSize * 0.26;
  return fontSize * 0.46;
};
const estimateWidth = (s: string, fontSize: number): number =>
  [...s].reduce((w, ch) => w + charWidth(ch, fontSize), 0);

// A full circle starting at 12 o'clock and running clockwise, so the title
// reads left-to-right across the top of the record (and, like every real
// record label, upside down across the bottom).
const RING_PATH = `M 50 ${50 - RING_RADIUS} a ${RING_RADIUS} ${RING_RADIUS} 0 1 1 0 ${2 * RING_RADIUS} a ${RING_RADIUS} ${RING_RADIUS} 0 1 1 0 ${-2 * RING_RADIUS}`;

interface RingTextProps {
  /** Must be unique per *rendered instance*, not per vinyl - the same record can be on screen twice (in the grove and docked in the player) and SVG ids are document-global. */
  uid: string;
  text: string;
}

// Wraps the title around the grooved band of the record. `textLength` pinned
// to the exact circumference is what makes it go "all the way around": the
// browser distributes the slack as letter-spacing, so a short title breathes
// out around the circle instead of leaving a bald patch at 4 o'clock.
function RingText({ uid, text }: RingTextProps) {
  const { repeated, fontSize } = useMemo(() => {
    const single = estimateWidth(text, RING_FONT_SIZE);
    // A title too long to fit even once gets shrunk rather than crushed into
    // negative letter-spacing (which overlaps glyphs into mush).
    const fits = RING_CIRCUMFERENCE * 0.94;
    const size = single > fits ? RING_FONT_SIZE * (fits / single) : RING_FONT_SIZE;
    const unit = estimateWidth(text + RING_SEPARATOR, size);
    const repeats = Math.max(1, Math.min(7, Math.floor(RING_CIRCUMFERENCE / unit)));
    return {
      fontSize: size,
      // Trailing separator too, so the last repeat meets the first one across
      // the seam at 12 o'clock instead of butting straight into it.
      repeated: Array(repeats).fill(text).join(RING_SEPARATOR) + RING_SEPARATOR.replace('✦ ', '✦\u00A0'),
    };
  }, [text]);

  return (
    <svg className="groove-vinyl__ring" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <path id={`groove-ring-${uid}`} d={RING_PATH} fill="none" />
      </defs>
      <text fontSize={fontSize}>
        <textPath
          href={`#groove-ring-${uid}`}
          startOffset={0}
          textLength={RING_CIRCUMFERENCE}
          lengthAdjust="spacing"
          dominantBaseline="middle"
        >
          {repeated}
        </textPath>
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// a record that spins like a record
// ---------------------------------------------------------------------------

// A turntable gets up to speed briskly and then coasts back down much more
// slowly against almost no friction, so the two directions get their own time
// constants rather than one symmetric ease.
const SPIN_UP_TAU = 0.42;
const SPIN_DOWN_TAU = 1.15;

// Eases angular velocity toward `targetDegPerSec` and writes the angle
// straight to the node every frame - never through React state, which would
// re-render the whole player 60 times a second for a number nothing else
// reads.
function useTurntableSpin(targetDegPerSec: number) {
  const ref = useRef<HTMLDivElement>(null);
  const target = useRef(targetDegPerSec);
  target.current = targetDegPerSec;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = performance.now();
    let angle = 0;
    let vel = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const tau = target.current > vel ? SPIN_UP_TAU : SPIN_DOWN_TAU;
      vel += (target.current - vel) * (1 - Math.exp(-dt / tau));
      angle = (angle + vel * dt) % 360;
      if (ref.current) ref.current.style.rotate = `${angle.toFixed(2)}deg`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return ref;
}

interface DiscFaceProps {
  uid: string;
  vinylId: string;
  ringText?: string;
  coverKey?: string;
  /** Big numeral in place of the centre label, for the ADHDJ selector discs. */
  numeral?: string;
  /** Extra filter appended after the disc's own per-vinyl recipe (e.g. the ADHDJ selector's active/inactive brightness). */
  extraFilter?: string;
}

// Everything that lives *on* the record, in the order it stacks: the record
// itself (cheap native filter only, no color-grade - see discLook), the
// static color-grade tint (see __tint below), the grayscale cover art masked
// to the grooved ring, then the title, which deliberately sits on an
// unfiltered layer so the grade can't remap it into something unreadable
// (the tint's own circle, at 80% of the box, doesn't reach the ring text's
// band around the outside anyway).
function DiscFace({ uid, vinylId, ringText, coverKey, numeral, extraFilter }: DiscFaceProps) {
  const look = useMemo(() => discLook(vinylId), [vinylId]);
  const cover = getCover(coverKey);

  return (
    <>
      <img
        className="groove-vinyl__img"
        src={vinylImg}
        alt=""
        style={{ filter: `${look.imgFilter}${extraFilter ? ` ${extraFilter}` : ''}` }}
      />
      <div className="groove-vinyl__tint" />
      {cover && (
        <div
          className="groove-vinyl__cover"
          style={{ backgroundImage: `url(${cover})`, opacity: look.coverOpacity }}
        />
      )}
      {numeral
        ? <span className="groove-vinyl__numeral">{numeral}</span>
        : ringText && <RingText uid={uid} text={ringText} />
      }
    </>
  );
}

// ---------------------------------------------------------------------------
// laying the grove out
// ---------------------------------------------------------------------------

interface PlacedVinyl {
  vinyl: GrooveVinyl;
  x: number;
  y: number;
  size: number;
  spinFactor: number;
  spinBase: number;
  driftX: number;
  driftY: number;
  driftDuration: number;
  driftDelay: number;
}

interface GroveSection {
  section: 'mine' | 'recommends';
  placed: PlacedVinyl[];
  height: number;
}

// Same skyline packer as the art gallery, with one deliberate change: every
// record is the *same* size (they're records), so an equal-footprint packer
// would settle into visible rows. Each disc therefore reserves a randomly
// oversized box around itself, which leaves the skyline permanently ragged and
// keeps the field reading as records drifting up out of the trees rather than
// a grid of them.
function tileSize(containerWidth: number): number {
  // A narrow phone column has room for maybe two records across - shrinking
  // them further to "fit more" just reads as fiddly, so mobile gets its own,
  // more generous floor/ceiling instead of the same formula scaled down.
  const mobile = containerWidth < 700;
  const base = mobile ? containerWidth / 1.7 : containerWidth / 3.7;
  return Math.round(mobile ? Math.min(280, Math.max(190, base)) : Math.min(258, Math.max(160, base)));
}

function layoutSection(vinyls: GrooveVinyl[], containerWidth: number): GroveSection['placed'] {
  if (containerWidth <= 0) return [];

  const size = tileSize(containerWidth);
  const unit = 8;
  const cols = Math.max(4, Math.round(containerWidth / unit));
  const skyline = new Array(cols).fill(0);
  const placed: PlacedVinyl[] = [];

  for (const vinyl of vinyls) {
    const id = vinyl.id;
    // A narrower, less wild padding range than before (was 0.30-0.62x) - the
    // previous spread made some gaps huge and others tight, which read as
    // patchy rather than "evenly diffuse." Tightening it keeps the spacing
    // consistent while the jitter below still keeps it feeling unplanned.
    const pad = size * (0.36 + rand01(`${id}:pad`) * 0.16);
    const box = size + pad;
    const colSpan = Math.max(1, Math.min(cols, Math.round(box / unit)));

    let minY = Infinity;
    for (let c = 0; c <= cols - colSpan; c++) {
      let y = 0;
      for (let k = c; k < c + colSpan; k++) y = Math.max(y, skyline[k]);
      if (y < minY) minY = y;
    }
    // Among all the near-equally-shallow slots, take one at random rather than
    // always the leftmost, or the whole grove drifts to hug the left edge.
    // Kept tight (was up to 0.22x) so "near-equally-shallow" doesn't stretch
    // far enough to let a tile drop into a visibly deeper gap than its
    // neighbours - that unevenness was part of the patchy feel too.
    const tolerance = Math.max(12, size * 0.1);
    const candidates: number[] = [];
    for (let c = 0; c <= cols - colSpan; c++) {
      let y = 0;
      for (let k = c; k < c + colSpan; k++) y = Math.max(y, skyline[k]);
      if (y <= minY + tolerance) candidates.push(c);
    }
    const chosen = candidates[Math.floor(rand01(`${id}:tie`) * candidates.length)] ?? 0;
    let placeY = 0;
    for (let k = chosen; k < chosen + colSpan; k++) placeY = Math.max(placeY, skyline[k]);
    for (let k = chosen; k < chosen + colSpan; k++) skyline[k] = placeY + box;

    // The reserved box is bigger than the disc, so nudging the disc around
    // inside it can never make two of them touch.
    const slackX = (colSpan * unit - size) / 2;
    const slackY = pad / 2;
    placed.push({
      vinyl,
      x: chosen * unit + slackX + (rand01(`${id}:jx`) - 0.5) * slackX * 1.1,
      y: placeY + slackY + (rand01(`${id}:jy`) - 0.5) * slackY * 1.1,
      size,
      // Degrees of spin per pixel scrolled, either direction - a stack of
      // records all turning the same way reads as a machine, not a grove.
      spinFactor: (0.16 + rand01(`${id}:spin`) * 0.30) * (rand01(`${id}:dir`) < 0.5 ? -1 : 1),
      spinBase: rand01(`${id}:base`) * 360,
      // A real, roaming float rather than a subtle wobble - up to ~3x a
      // tile's own padding in reach, so neighbours occasionally drift close
      // without ever actually overlapping (see the padded reservation above).
      driftX: 16 + rand01(`${id}:ddx`) * 26,
      driftY: 16 + rand01(`${id}:ddy`) * 26,
      driftDuration: 10 + rand01(`${id}:dur`) * 12,
      driftDelay: -(rand01(`${id}:delay`) * 20),
    });
  }

  return placed;
}

function sectionHeight(placed: PlacedVinyl[]): number {
  const raw = placed.reduce((h, p) => Math.max(h, p.y + p.size), 0);
  // A flat safety margin beyond the lowest disc's own box: hover lift and
  // the ambient drift wobble (up to ~42px of reach now that it roams) can
  // both push a tile's visible position past its reserved footprint, and
  // the next section (the divider) needs to clear all of that, not just the
  // raw box edge.
  return raw > 0 ? raw + 90 : 0;
}

// ---------------------------------------------------------------------------
// one record sitting in the grove
// ---------------------------------------------------------------------------

// How far below its resting spot a tile starts, before rising in - on the
// same order as the treeline's own height (.groove-trees, clamp(190-440px)),
// so it genuinely originates from off the bottom of the screen and behind
// it (the scrolling field sits at a lower z-index than the treeline, so
// anything still down at this offset renders behind the trees), rather than
// just a small nudge from just-off-position.
const ENTRY_RISE = 380;

interface VinylTileProps {
  placed: PlacedVinyl;
  scrollRootRef: React.RefObject<HTMLDivElement>;
  hidden: boolean;
  onOpen: (vinyl: GrooveVinyl, rect: DOMRect) => void;
}

// Flies up from below the moment it scrolls into view, not just on the
// grove's own initial reveal: `whileInView` (scoped to the grove's own
// scroll container via `viewport.root`, so it fires against that box's
// visible area, not the whole page) fires this the first time each tile
// actually enters the frame, however it got there - already visible when the
// grove opens, or scrolled to later. `once: true` keeps a tile from
// re-animating every time it's scrolled past again. The small per-tile
// random delay (rather than one shared by every tile in view at once) is
// what makes a batch that all enter together read as a loose cascade instead
// of popping up in lockstep.
function VinylTile({ placed, scrollRootRef, hidden, onOpen }: VinylTileProps) {
  const { vinyl, size } = placed;
  const discRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      className="groove-vinyl"
      style={{
        left: placed.x,
        top: placed.y,
        width: size,
        height: size,
        '--spin-factor': placed.spinFactor,
        '--spin-base': placed.spinBase,
        '--drift-x': `${placed.driftX}px`,
        '--drift-y': `${placed.driftY}px`,
        '--drift-duration': `${placed.driftDuration}s`,
        '--drift-delay': `${placed.driftDelay}s`,
      } as React.CSSProperties}
      initial={{ opacity: 0, y: ENTRY_RISE }}
      // While its record is open in the player there must not be a second
      // copy of it visible in the grove too - see the click handler below
      // for why this fade doesn't fight the player's own flight animation
      // the way an early version of this did.
      animate={{ opacity: hidden ? 0 : 1, y: 0 }}
      whileInView={hidden ? undefined : { opacity: 1, y: 0 }}
      // Triggers the instant any sliver crosses in (rather than waiting for
      // a real fraction to already be visible) - the point is to actually
      // see the rise happen, not have it mostly done by the time it fires.
      viewport={{ root: scrollRootRef, once: true, amount: 0 }}
      transition={{
        opacity: { duration: hidden ? 0.15 : 0.7, ease: 'easeOut' },
        // Overdamped on purpose - no scale change either: a puck doesn't
        // bounce or grow as it slides, it just glides and loses momentum to
        // a smooth stop. (Critical damping here is 2*sqrt(58*1.1)=~16; 24 is
        // comfortably past it.)
        y: { type: 'spring', mass: 1.1, stiffness: 58, damping: 24, delay: rand01(`${vinyl.id}:reveal`) * 0.32 },
      }}
      onClick={() => discRef.current && onOpen(vinyl, discRef.current.getBoundingClientRect())}
      aria-label={vinyl.title}
    >
      <div className="groove-vinyl__lift">
        <div className="groove-vinyl__disc-shell" ref={discRef}>
          <div className="groove-vinyl__disc">
            <DiscFace uid={`grove-${vinyl.id}`} vinylId={vinyl.id} ringText={vinyl.ringTitle ?? vinyl.title} coverKey={vinyl.cover} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// embeds
// ---------------------------------------------------------------------------

// Deliberately the classic (non-"visual") player with a black accent: it
// renders as near black-on-white, which is the only palette that survives
// having the page's own color wash laid over it.
const soundcloudSrc = (url: string): string =>
  `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}` +
  '&color=%23000000&auto_play=false&hide_related=true&show_comments=false' +
  '&show_user=true&show_reposts=false&show_teaser=false&visual=false&show_artwork=true';

function SoundcloudEmbed({ url, playlist }: { url: string; playlist: boolean }) {
  return (
    <div className="groove-embed" style={{ height: playlist ? 340 : 166 }}>
      <iframe
        title="SoundCloud player"
        src={soundcloudSrc(url)}
        width="100%"
        height="100%"
        frameBorder="no"
        scrolling="no"
        allow="autoplay"
      />
      {/* A flat mid-gray run through the page's own color-grade filter *is*
          whatever color the grade currently sits at, so blending it over the
          embed tints the player to match the rest of the page without anything
          having to read the filter's state. Pointer-events off: it is paint,
          not a lid. */}
      <div className="groove-embed__tint" aria-hidden />
    </div>
  );
}

function YoutubeEmbed({ id }: { id: string }) {
  return (
    <div className="groove-embed groove-embed--video">
      <iframe
        title="YouTube video"
        src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        frameBorder="0"
      />
      <div className="groove-embed__tint" aria-hidden />
    </div>
  );
}

// ---------------------------------------------------------------------------
// the player that floats up out of the trees
// ---------------------------------------------------------------------------

const DOCKED_SPIN = 42;   // deg/sec, roughly a record's own unhurried turn

// A beat after the box itself starts rising, not with it - the record reads as
// being tossed after the player has already begun surfacing, which is what
// makes the throw feel unhurried rather than simultaneous.
const THROW_DELAY = 0.1;

// One spring for the whole flight, replacing a hand-timed three-keyframe toss
// whose legs met at a velocity corner (`easeIn` ends at full speed; the leg
// after it started slower) - that corner is what read as unsmooth. The
// "thrown past the mark and pulled back" weight is now the spring's own
// overshoot (~5% of the travel), and the downward bow of the flight is a
// separate CSS keyframe on a nested element (see .groove-player__arc), since
// nested transforms simply add and so cannot reintroduce a corner here.
// Annotated because `Transition` itself is not re-exported.
const THROW_TRANSITION: MotionProps['transition'] = {
  type: 'spring', mass: 1, stiffness: 50, damping: 8, delay: THROW_DELAY,
};

interface PlayerProps {
  vinyl: GrooveVinyl;
  fromRect: DOMRect | null;
  seriesIndex: number;
  onSeriesIndex: (i: number) => void;
  onClose: () => void;
}

function GroovePlayer({ vinyl, fromRect, seriesIndex, onSeriesIndex, onClose }: PlayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  // Must be re-armed on mount, not just cleared on unmount: StrictMode's
  // dev-only mount/unmount/remount keeps the ref object across the simulated
  // unmount, so a cleanup-only version latches `false` for the rest of the
  // player's life and silently kills every state update guarded by it.
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // The disc's *landing spot*: the box's bottom-center point, relative to the
  // player layer (which is what the dock element is positioned inside).
  const [dock, setDock] = useState<{ x: number; y: number } | null>(null);
  const stageRested = useRef(false);
  // The *thrown-from* delta must only ever be computed once, off the very
  // first dock value - re-deriving it on a later resize would fling the
  // record a second time.
  const throwFrom = useRef<{ dx: number; dy: number; scale: number } | null>(null);
  const throwComputed = useRef(false);

  const series = vinyl.kind === 'series' ? vinyl.entries[seriesIndex] : null;

  const dockSize = useMemo(
    () => Math.round(Math.min(208, Math.max(128, window.innerWidth * 0.42))),
    []
  );

  // Where the record is headed, knowable from the very first frame - which is
  // the whole point, because it has to already be flying by then.
  //
  // The box's own getBoundingClientRect() can't answer this yet: the stage
  // around it is still mid-entrance, and a rect includes every ancestor
  // transform, so early on it reports wherever the box happens to be passing
  // through rather than where it will come to rest. But the *layout* the box
  // will settle into is fully determined already, and two facts pin it down
  // without replicating any of the box's own sizing rules in JS:
  //   - the layer (position: fixed, inset: 0, never transformed - only its
  //     opacity is animated) is an honest frame of reference immediately, and
  //     it centers the stage, whose top and bottom margins are deliberately
  //     equal (see .groove-player__stage) so its border box lands dead centre;
  //   - the box is the stage's last child and the stage has no bottom padding,
  //     so the stage's bottom edge *is* the box's bottom edge - including the
  //     ADHDJ case, where the SeriesSelector above simply makes the stage
  //     taller and is accounted for for free.
  // offsetHeight is a layout measurement, so unlike a rect it is untouched by
  // the transform the stage is currently animating. (offsetLeft/offsetTop are
  // not used: those are relative to an offsetParent that is easy to guess
  // wrong, which is exactly how an earlier attempt at this went astray.)
  //
  // Once the stage really has come to rest the box's rect is finally the
  // authority, so it's taken then and the dock glides the (expected: sub-pixel)
  // difference away via its own CSS left/top transition. That correction is
  // belt-and-braces, not load-bearing: if the callback driving it never fires,
  // the derived position above simply stands.
  const syncDock = useCallback(() => {
    const layer = layerRef.current;
    const stage = stageRef.current;
    if (!layer || !stage) return;
    const lr = layer.getBoundingClientRect();
    const box = boxRef.current;
    let next: { x: number; y: number };
    if (stageRested.current && box) {
      const r = box.getBoundingClientRect();
      next = { x: r.left + r.width / 2 - lr.left, y: r.bottom - lr.top };
    } else {
      next = { x: lr.width / 2, y: (lr.height + stage.offsetHeight) / 2 };
    }
    if (!throwComputed.current) {
      throwComputed.current = true;
      throwFrom.current = fromRect
        ? {
            dx: fromRect.left - lr.left + fromRect.width / 2 - next.x,
            dy: fromRect.top - lr.top + fromRect.height / 2 - next.y,
            scale: fromRect.width / dockSize,
          }
        : null;
    }
    // Sub-pixel churn here would re-render the player for nothing; anything
    // real still gets through.
    setDock(prev =>
      prev && Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.y - next.y) < 0.5 ? prev : next
    );
  }, [fromRect, dockSize]);

  // Layout effect, not a plain one: this runs before the browser paints the
  // player's first frame, so the record is already on screen at the tile it
  // came from in that frame rather than popping in one frame later.
  useLayoutEffect(() => {
    syncDock();
    const stage = stageRef.current;
    if (!stage) return;
    // Observing the stage rather than the box catches the ADHDJ selector
    // appearing and any vh-driven resize alike, and reports layout sizes, so
    // it stays trustworthy while the entrance transform is still running.
    const ro = new ResizeObserver(syncDock);
    ro.observe(stage);
    window.addEventListener('resize', syncDock);
    return () => { ro.disconnect(); window.removeEventListener('resize', syncDock); };
  }, [syncDock]);

  // One-shot: the stage fires this again at the end of its *exit* too, and
  // re-measuring a box that is on its way off screen would drag the dock with
  // it.
  const onStageRest = useCallback(() => {
    if (!mountedRef.current || stageRested.current) return;
    stageRested.current = true;
    syncDock();
  }, [syncDock]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The grove keeps scrolling behind the player otherwise: React's onWheel is
  // passive, so preventDefault from JSX would silently do nothing and needs a
  // real listener. The box's own content still scrolls (overscroll-behavior
  // keeps it from chaining out once it hits an end).
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const block = (e: WheelEvent) => {
      if (!(e.target as HTMLElement).closest('.groove-player__content')) e.preventDefault();
    };
    el.addEventListener('wheel', block, { passive: false });
    return () => el.removeEventListener('wheel', block);
  }, []);

  const discRef = useTurntableSpin(DOCKED_SPIN);

  // Frozen the first time there is a dock to aim at, and never touched again
  // while this player is open - re-deriving it on a later render (say, after
  // a resize nudges `dock`) is exactly what would fling the record a second
  // time. `armed` only ever goes false -> true, so this body runs once.
  // Every animated value below is a plain number rather than a keyframe
  // array, which is the other half of that guarantee: framer has nothing to
  // find changed on a re-render, so there is no landed/settled flag left to
  // latch wrongly the way the old keyframe version needed.
  const armed = dock !== null;
  const throwAnim = useMemo(() => {
    if (!armed) return null;
    const from = throwFrom.current;
    // Opened from a deep link rather than a click - there is no grove tile
    // it could have come from, so it just surfaces at the dock instead.
    if (!from) {
      return {
        initial: { x: 0, y: 130, scale: 0.7, opacity: 0 },
        animate: { x: 0, y: 0, scale: 1, opacity: 1 },
        transition: { type: 'spring' as const, mass: 1, stiffness: 70, damping: 16, delay: THROW_DELAY },
        arc: 0,
      };
    }
    const { dx, dy, scale: fromScale } = from;
    return {
      initial: { x: dx, y: dy, scale: fromScale, opacity: 1 },
      animate: { x: 0, y: 0, scale: 1, opacity: 1 },
      transition: THROW_TRANSITION,
      // How far the flight bows downward on its way over. Proportional to the
      // throw, floored and capped: a record flicked from just beside the box
      // shouldn't loop as far as one thrown the width of the grove, but a
      // short throw still shouldn't travel dead flat.
      arc: Math.round(Math.min(120, Math.max(46, Math.hypot(dx, dy) * 0.15))),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed]);

  const description = series ? series.description : vinyl.description;
  const heading = series ? series.title : vinyl.title;

  return (
    <motion.div
      ref={layerRef}
      // Deliberately *not* faded in, only out: the thrown record lives on this
      // layer and has to be at full opacity in the very first frame, because
      // the grove tile it launches from starts fading the same instant. A fade
      // here multiplied into that and left a visible dip where the record was
      // briefly neither. The things that do want to arrive gently - the scrim
      // below, the stage - fade themselves.
      className="groove-player-layer"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Darker + blurred while a record is playing, so the box reads as
          properly *in front of* the grove rather than a thin sheet over it. */}
      <motion.div
        className="groove-player__scrim"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      />

      {/* Sits *behind* the stage (z-index below it) and outside the box's own
          DOM entirely, on purpose: the box's own opaque background then
          naturally occludes the top portion of the disc where the two
          overlap, and only the bottom portion - past the box's own edge,
          where there's nothing left to occlude it - actually shows, which is
          what "docked half behind the box" means. A layoutId-shared element
          living *inside* the box (tried previously) put it in front instead,
          on top of the box's own content. */}
      {dock && throwAnim && (
        <motion.div
          className="groove-player__dock"
          style={{ left: dock.x, top: dock.y, width: dockSize, height: dockSize, marginLeft: -dockSize / 2, marginTop: -dockSize / 2 }}
          initial={throwAnim.initial}
          animate={throwAnim.animate}
          exit={{ y: 220, opacity: 0, transition: { duration: 0.4, ease: 'easeIn' } }}
          transition={throwAnim.transition}
        >
          <div
            className={`groove-player__arc${throwAnim.arc ? ' groove-player__arc--throw' : ''}`}
            style={throwAnim.arc ? ({ '--groove-arc': `${throwAnim.arc}px` } as React.CSSProperties) : undefined}
          >
            <div className="groove-vinyl__disc" ref={discRef}>
              {/* No ringText here: the dock only ever shows the record's
                  bottom half (see .groove-player__dock above), so the title
                  ring would read as a half-cut, upside-down fragment rather
                  than something worth keeping legible. */}
              <DiscFace
                uid={`dock-${vinyl.id}`}
                vinylId={vinyl.id}
                coverKey={series?.cover ?? vinyl.cover}
              />
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        ref={stageRef}
        className="groove-player__stage"
        initial={{ y: '48vh', opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: '42vh', opacity: 0, scale: 0.96, transition: { duration: 0.4, ease: 'easeIn' } }}
        transition={{
          y: { type: 'spring', mass: 1.3, stiffness: 88, damping: 17 },
          scale: { type: 'spring', mass: 1.3, stiffness: 88, damping: 17 },
          // Fades up over the first part of the rise, so the box reads as
          // surfacing out of the trees rather than sliding across them.
          opacity: { duration: 0.55, ease: 'easeOut' },
        }}
        onAnimationComplete={onStageRest}
      >
        {vinyl.kind === 'series' && (
          <SeriesSelector entries={vinyl.entries} selected={seriesIndex} onSelect={onSeriesIndex} vinylId={vinyl.id} />
        )}

        <div className="groove-player__box" ref={boxRef}>
          <button className="groove-player__close" onClick={onClose} aria-label="Close">×</button>
          <div className="groove-player__content">
            <AnimatePresence mode="wait">
              <motion.div
                key={series ? `${vinyl.id}-${seriesIndex}` : vinyl.id}
                initial={{ opacity: 0, filter: 'blur(9px)', y: 10 }}
                animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                exit={{ opacity: 0, filter: 'blur(9px)', y: -8 }}
                transition={{ duration: 0.42, ease: 'easeOut' }}
              >
                <h2 className="groove-player__title">{heading}</h2>
                {vinyl.kind !== 'markdown' && description && (
                  <p className="groove-player__description">{description}</p>
                )}

                {vinyl.kind === 'soundcloud' && (
                  <>
                    <SoundcloudEmbed url={vinyl.soundcloud} playlist={vinyl.playlist} />
                    {vinyl.youtube && <YoutubeEmbed id={vinyl.youtube} />}
                  </>
                )}

                {series && (
                  <>
                    <SoundcloudEmbed url={series.soundcloud} playlist={false} />
                    {series.youtube && <YoutubeEmbed id={series.youtube} />}
                  </>
                )}

                {vinyl.kind === 'markdown' && (
                  <div className="groove-player__markdown">
                    <ReactMarkdown>{vinyl.body}</ReactMarkdown>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// the ADHDJ 1-5 selector
// ---------------------------------------------------------------------------

interface SeriesSelectorProps {
  entries: SeriesEntry[];
  selected: number;
  onSelect: (i: number) => void;
  vinylId: string;
}

function SeriesSelector({ entries, selected, onSelect, vinylId }: SeriesSelectorProps) {
  return (
    <div className="groove-series">
      {entries.map((entry, i) => (
        <SeriesDisc
          key={entry.number}
          entry={entry}
          index={i}
          vinylId={vinylId}
          active={i === selected}
          onSelect={() => onSelect(i)}
        />
      ))}
    </div>
  );
}

const SERIES_SPIN = 76;

function SeriesDisc({ entry, index, vinylId, active, onSelect }: { entry: SeriesEntry; index: number; vinylId: string; active: boolean; onSelect: () => void }) {
  // Spinning up and coasting down is the whole tell for which one is playing,
  // so it runs on the same eased turntable model as the docked record rather
  // than a CSS animation snapping between running and paused.
  const ref = useTurntableSpin(active ? SERIES_SPIN : 0);
  return (
    <motion.button
      type="button"
      className={`groove-series__disc${active ? ' groove-series__disc--active' : ''}`}
      onClick={onSelect}
      aria-pressed={active}
      aria-label={entry.title}
      initial={{ opacity: 0, y: 26, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: active ? 1.1 : 1 }}
      transition={{ type: 'spring', mass: 0.8, stiffness: 180, damping: 16, delay: 0.24 + index * 0.07 }}
      whileHover={{ scale: active ? 1.14 : 1.07 }}
      whileTap={{ scale: 0.94 }}
    >
      <div className="groove-vinyl__disc" ref={ref}>
        <DiscFace
          uid={`series-${vinylId}-${entry.number}`}
          vinylId={`${vinylId}-${entry.number}`}
          numeral={entry.number}
          coverKey={entry.cover}
        />
      </div>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// the one link that lives outside the grove
// ---------------------------------------------------------------------------

function ExternalGate({ vinyl, onClose }: { vinyl: GrooveVinyl & { kind: 'external' }; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="groove-gate-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClose}
    >
      <motion.div
        className="groove-gate"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.86, filter: 'blur(14px)', y: 24 }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
        exit={{ opacity: 0, scale: 0.92, filter: 'blur(14px)', y: 12, transition: { duration: 0.32 } }}
        transition={{ type: 'spring', mass: 0.9, stiffness: 130, damping: 15 }}
      >
        <div className="groove-gate__glow" aria-hidden />
        <h2 className="groove-gate__title">outside the grove</h2>
        <p className="groove-gate__body">{vinyl.description}</p>
        <div className="groove-gate__actions">
          <a
            className="groove-gate__go"
            href={vinyl.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
          >
            take me there
          </a>
          <button type="button" className="groove-gate__stay" onClick={onClose}>stay here</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// the grove itself
// ---------------------------------------------------------------------------

// Captured once at module load: LandscapeContainer normalises the address bar
// to /groove-grove as soon as the popup state settles, which happens before
// this component has ever mounted - so by the time it could read the location
// the vinyl slug in a deep link would already be gone.
const INITIAL_PATH = typeof window === 'undefined' ? '' : window.location.pathname;

const MINE = VINYLS.filter(v => v.section === 'mine');
const RECOMMENDS = VINYLS.filter(v => v.section === 'recommends');

interface GrooveGroveProps {
  open: boolean;
  onClose: () => void;
}

function GrooveGrove({ open, onClose }: GrooveGroveProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [selected, setSelected] = useState<GrooveVinyl | null>(null);
  const [fromRect, setFromRect] = useState<DOMRect | null>(null);
  const [seriesIndex, setSeriesIndex] = useState(0);
  // Gates the vinyls themselves: false until the grove image has slid in and
  // the title has blurred into view, at which point every tile currently on
  // screen cascades up together (via VinylTile's own whileInView, see there)
  // and everything further down the scroll waits, correctly, to fly in only
  // once actually scrolled into view.
  const [introReady, setIntroReady] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const deepLinkDone = useRef(false);

  const openVinyl = useCallback((vinyl: GrooveVinyl, rect: DOMRect) => {
    setFromRect(rect);
    setSeriesIndex(vinyl.kind === 'series' ? vinyl.initialIndex : 0);
    setSelected(vinyl);
  }, []);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setFromRect(null);
      setIntroReady(false);
      return;
    }
    const update = () => setContainerWidth(fieldRef.current?.clientWidth ?? 0);
    update();
    const ro = new ResizeObserver(update);
    if (fieldRef.current) ro.observe(fieldRef.current);
    return () => ro.disconnect();
  }, [open]);

  // Grove settles ~1.1s in, title finishes blurring in ~1.5s in, intro line
  // shortly after - the vinyls wait for both before they're even mounted
  // (VinylTile isn't rendered at all until this flips, see the JSX below).
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setIntroReady(true), 1650);
    return () => window.clearTimeout(t);
  }, [open]);

  // /groove-grove/<vinyl>[/<series number>] opens straight into that record.
  useEffect(() => {
    if (!open || deepLinkDone.current) return;
    deepLinkDone.current = true;
    const [, root, slug, sub] = INITIAL_PATH.replace(/\/+$/, '').split('/');
    if (root !== 'groove-grove' || !slug) return;
    const vinyl = VINYLS.find(v => v.id === slug);
    if (!vinyl) return;
    setSelected(vinyl);
    setFromRect(null);
    if (vinyl.kind === 'series') {
      const fromPath = vinyl.entries.findIndex(e => e.number === sub);
      setSeriesIndex(fromPath >= 0 ? fromPath : vinyl.initialIndex);
    } else {
      setSeriesIndex(0);
    }
  }, [open]);

  // Owns the sub-path only while the grove is open. LandscapeContainer writes
  // the address bar too, but only when the page/popup state actually changes -
  // which it does not while the grove is just moving between records - so the
  // two never fight over it.
  useEffect(() => {
    if (!open) return;
    const series = selected?.kind === 'series' ? `/${selected.entries[seriesIndex]?.number ?? ''}` : '';
    const path = selected ? `/groove-grove/${selected.id}${series}` : '/groove-grove';
    if (window.location.pathname !== path) window.history.replaceState(null, '', path);
  }, [open, selected, seriesIndex]);

  // One scroll listener drives every record in the grove: it writes a single
  // custom property, and each disc turns by its own multiple of it in CSS.
  // Cheaper than touching every tile's node individually per frame, and it
  // means the whole field responds on exactly the same tick.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const top = el.scrollTop;
      el.style.setProperty('--groove-scroll', String(top));
      const header = headerRef.current;
      if (header) {
        const t = Math.max(0, Math.min(1, top / 240));
        header.style.opacity = String(1 - t);
        header.style.filter = `blur(${(t * 9).toFixed(1)}px)`;
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    apply();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !selected) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, selected, onClose]);

  const mine = useMemo(() => layoutSection(MINE, containerWidth), [containerWidth]);
  const recommends = useMemo(() => layoutSection(RECOMMENDS, containerWidth), [containerWidth]);

  // Only a pointer that went down and came back up in roughly the same place
  // counts as "click the background to leave" - a scroll, a swipe or a drag
  // across the field should not close the grove.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    const start = pointerDownPos.current;
    pointerDownPos.current = null;
    if (!start || selected) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) return;
    if ((e.target as HTMLElement).closest('.groove-vinyl, .groove-player-layer, .groove-gate-layer')) return;
    onClose();
  };

  const playerVinyl = selected && selected.kind !== 'external' ? selected : null;
  const gateVinyl = selected && selected.kind === 'external' ? selected : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`groove-backdrop${selected ? ' groove-backdrop--playing' : ''}`}
          initial={{ opacity: 0, pointerEvents: 'auto' }}
          animate={{ opacity: 1, pointerEvents: 'auto' }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <div className="groove-scroll" ref={scrollRef}>
            <div className="groove-inner">
              <div className="groove-header" ref={headerRef}>
                {/* Grove settles ~1.1s in (see .groove-trees below); the title
                    waits for that before it starts blurring in, and the
                    vinyls (see `introReady` above) wait for the title in turn -
                    grove, then title, then the grove starts giving up its
                    records. */}
                <motion.h1
                  className="groove-title"
                  initial={{ opacity: 0, filter: 'blur(18px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  transition={{ duration: 0.65, delay: 0.85, ease: 'easeOut' }}
                >
                  {GROVE_TITLE}
                </motion.h1>
                <motion.p
                  className="groove-intro"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 1.05, ease: 'easeOut' }}
                >
                  {GROVE_INTRO}
                </motion.p>
              </div>

              <div className="groove-field" ref={fieldRef} style={{ height: sectionHeight(mine) }}>
                {introReady && mine.map((p) => (
                  <VinylTile
                    key={p.vinyl.id}
                    placed={p}
                    scrollRootRef={scrollRef}
                    hidden={selected?.id === p.vinyl.id}
                    onOpen={openVinyl}
                  />
                ))}
              </div>

              <div className="groove-divider">
                <span className="groove-divider__rule" />
                <span className="groove-divider__label">Music Recommends</span>
                <span className="groove-divider__rule" />
              </div>

              <div className="groove-field" style={{ height: sectionHeight(recommends) }}>
                {introReady && recommends.map((p) => (
                  <VinylTile
                    key={p.vinyl.id}
                    placed={p}
                    scrollRootRef={scrollRef}
                    hidden={selected?.id === p.vinyl.id}
                    onOpen={openVinyl}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* The treeline: a fixed foreground band the whole field scrolls up
              behind. Sits outside .groove-scroll on purpose so it never moves. */}
          <motion.div
            className="groove-trees"
            initial={{ y: '104%' }}
            animate={{ y: '0%' }}
            exit={{ y: '104%' }}
            transition={{ duration: 1.25, ease: [0.16, 0.86, 0.24, 1] }}
            aria-hidden
          >
            <img src={groveImg} alt="" className="groove-trees__img" />
          </motion.div>

          <button className="groove-close" onClick={onClose} aria-label="Close">×</button>

          <AnimatePresence>
            {playerVinyl && (
              <GroovePlayer
                key={playerVinyl.id}
                vinyl={playerVinyl}
                fromRect={fromRect}
                seriesIndex={seriesIndex}
                onSeriesIndex={setSeriesIndex}
                onClose={() => setSelected(null)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {gateVinyl && <ExternalGate key={gateVinyl.id} vinyl={gateVinyl} onClose={() => setSelected(null)} />}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GrooveGrove;
