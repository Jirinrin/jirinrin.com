// Measures how well this machine is actually coping, and says so - instead of
// guessing from the browser's name.
//
// The colour grade used to be switched off for every Firefox on earth because
// of one measurement, on one machine, with no version or hardware recorded.
// When that was finally re-run (Firefox 155.0 / Windows 11 26200 / Core Ultra
// 7 155H, hardware WebRender), the compositor held a flat 60Hz - median frame
// interval 16.68ms, worst interval in ten seconds 33.4ms, not one interval
// over 50ms, and the filter's own JS cost 0.08% of the main thread. The
// original figure could not be reproduced at all.
//
// But that is still one machine, and a fast one. The condition the old number
// probably *did* come from - software WebRender, no usable GPU - is real, and
// no browser-name test can detect it. So this is the replacement: run the
// effect, watch the frames it actually produces, and back off if this
// particular device is struggling. It adapts on any engine, it cannot be
// wrong about a browser it has never seen, and it stops punishing every
// Firefox user for one bad measurement.

const SAMPLE_MS = 6_000;

// The opening cloud animation is the heaviest moment the page ever has, so the
// window deliberately covers it. Measuring after it would flatter every
// device; measuring only during it would condemn them.
const WARMUP_FRAMES = 10;

// Calibration, and the honest limits of it. On the reference machine above the
// site's own rAF callback interval sat at a 95th percentile of 34-39ms during
// this window - already a couple of frames, because the opening clouds are
// genuinely expensive - with a worst case around 140ms. A device meaningfully
// worse than that is one where the grade is costing more than it is worth.
//
// 50ms is therefore about 1.3x the reference p95: loose enough not to condemn
// a machine that is merely busy, tight enough to catch one that is actually
// struggling. It is calibrated from ONE machine and should be revisited if a
// second data point ever disagrees - which is exactly the mistake this module
// exists to stop repeating, so: do not quote this number without saying where
// it came from.
const P95_BUDGET_MS = 50;

// Below this there is not enough signal to judge anything - a tab that was
// backgrounded, or a page closed after two seconds.
const MIN_SAMPLES = 60;

export interface WatchdogVerdict {
  struggling: boolean;
  p95: number;
  median: number;
  max: number;
  samples: number;
}

/**
 * Samples frame intervals for SAMPLE_MS, then reports once. Returns a cancel
 * function; the verdict never fires after cancelling.
 */
export function startFrameBudgetWatchdog(onVerdict: (v: WatchdogVerdict) => void): () => void {
  if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
    return () => {};
  }

  const gaps: number[] = [];
  let frames = 0;
  let last = 0;
  let startedAt = 0;
  let raf = 0;
  let cancelled = false;

  const finish = () => {
    if (cancelled) return;
    cancelled = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onHidden);

    if (gaps.length < MIN_SAMPLES) return;

    const sorted = [...gaps].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    onVerdict({
      struggling: at(0.95) > P95_BUDGET_MS,
      p95: at(0.95),
      median: at(0.5),
      max: sorted[sorted.length - 1],
      samples: sorted.length,
    });
  };

  // A tab that goes into the background stops getting frames entirely, so
  // whatever was collected up to that point is all there will ever be, and
  // anything measured after it comes back is a different situation. Stop and
  // judge on what we have, or discard it if there isn't enough.
  const onHidden = () => { if (document.hidden) finish(); };
  document.addEventListener('visibilitychange', onHidden);

  const tick = (now: number) => {
    if (cancelled) return;
    raf = requestAnimationFrame(tick);
    frames++;

    // The first frames after mount are layout, decode and style settling, not
    // the steady state this is trying to judge.
    if (frames <= WARMUP_FRAMES) {
      last = now;
      startedAt = now;
      return;
    }

    gaps.push(now - last);
    last = now;
    if (now - startedAt >= SAMPLE_MS) finish();
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onHidden);
  };
}
