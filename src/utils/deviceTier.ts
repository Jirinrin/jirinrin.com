import { isMobile } from 'react-device-detect';
import { Cookies } from 'react-cookie';

// A guess at whether this device will struggle with the site's heaviest
// purely-decorative layers (dozens of large translucent cloud layers,
// backdrop-filter glass panes, the colour grade). Consumers use it to *thin
// out* decoration, never to change anything functional - the site must look
// right on both tiers, one of them just has less going on.
//
// There are two ways into the low tier, and deliberately only one flag out of
// it:
//
// 1. A static heuristic, evaluated immediately - reduced-motion, a phone UA,
//    few cores, little RAM. Available before a single frame has rendered,
//    which is what the cloud layers need, and wrong often enough that it is
//    only ever used to thin decoration.
// 2. A measured verdict from the frame-budget watchdog (frameBudgetWatchdog.ts),
//    which runs for the first few seconds and persists what it found. This is
//    the real answer, it just arrives late.
//
// The watchdog writes into *this* flag rather than growing a second, separate
// notion of "this device is slow". Otherwise a device ends up graded at full
// strength while its clouds are thinned, or the reverse, and the two knobs
// drift apart over time.
//
// `?perf=low` / `?perf=high` in the URL forces a tier, for eyeballing the
// difference on a machine that would otherwise never see the other one. A
// forced tier also suppresses the watchdog, so testing never writes a verdict.

// The suffix is the watchdog's calibration generation. A stored verdict is only
// as good as the budget that produced it, and once "low" is stored nothing
// re-measures (the grade is off, so the watchdog never runs), so a verdict
// written under a too-strict budget would pin a device to black-and-white for
// the full max-age. Bump this whenever P95_BUDGET_MS changes.
//   grade-tier    - 50ms budget (wrongly condemned Firefox on a fine machine)
//   grade-tier-2  - 80ms budget
const TIER_COOKIE = 'grade-tier-2';

// Long enough that a returning visitor isn't re-measured on every visit, short
// enough that a verdict from a bad afternoon - a thermally throttled laptop, a
// machine that happened to be compiling something - doesn't outlive its
// circumstances. A device that has genuinely got faster gets re-measured
// within the month.
const TIER_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;

const cookies = new Cookies();

let cached: boolean | null = null;

function forcedTier(): boolean | null {
  if (typeof window === 'undefined') return null;
  const forced = new URLSearchParams(window.location.search).get('perf');
  if (forced === 'low') return true;
  if (forced === 'high') return false;
  return null;
}

/** True when the tier is pinned by the URL, in which case nothing should measure or persist. */
export function isTierForced(): boolean {
  return forcedTier() !== null;
}

/** A verdict the watchdog measured on a previous visit, if there is one. */
export function measuredTier(): boolean | null {
  if (typeof window === 'undefined') return null;
  const v = cookies.get(TIER_COOKIE);
  if (v === 'low') return true;
  if (v === 'high') return false;
  return null;
}

/**
 * Records what the frame-budget watchdog actually measured, for this session
 * and for the next one. Callers should skip this when the tier is forced.
 */
export function recordMeasuredTier(lowPower: boolean): void {
  if (typeof window === 'undefined' || isTierForced()) return;
  cookies.set(TIER_COOKIE, lowPower ? 'low' : 'high', {
    path: '/',
    maxAge: TIER_COOKIE_MAX_AGE_S,
    sameSite: 'lax',
  });
  cached = lowPower;
}

export function isLowPowerDevice(): boolean {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') return false;

  const forced = forcedTier();
  if (forced !== null) return (cached = forced);

  // A real measurement from a previous visit beats every guess below it.
  const measured = measuredTier();
  if (measured !== null) return (cached = measured);

  const nav = navigator as Navigator & { deviceMemory?: number };
  cached =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    isMobile ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 4) ||
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 4);
  return cached;
}
