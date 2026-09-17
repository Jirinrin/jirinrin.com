import { isMobile } from 'react-device-detect';

// A one-shot, static guess at whether this device will struggle with the
// site's heaviest purely-decorative layers (dozens of large translucent cloud
// layers, backdrop-filter glass panes, etc.). Consumers use it to *thin out*
// decoration, never to change anything functional - the site must look right
// on both tiers, one of them just has less going on.
//
// Signals, any one of which is enough:
// - `prefers-reduced-motion` - the user has already asked for less.
// - a phone/tablet UA - mobile GPUs and, especially, iOS Safari pay far more
//   for backdrop-filter and for large blurred/blended compositor layers.
// - few CPU cores / little RAM, where either API is available.
//
// `?perf=low` / `?perf=high` in the URL forces a tier, for eyeballing the
// difference on a machine that would otherwise never see the other one.
//
// This deliberately stays a static heuristic. A runtime frame-budget watchdog
// (measure real frame gaps for the first few seconds and persist the verdict)
// is planned as part of the color-grade cross-browser work - see
// COLOR-GRADE-CROSS-BROWSER.md, Phase 3c - and once that exists it should feed
// this same tier rather than growing a second, separate notion of "slow".
let cached: boolean | null = null;

export function isLowPowerDevice(): boolean {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') return false;

  const forced = new URLSearchParams(window.location.search).get('perf');
  if (forced === 'low') return (cached = true);
  if (forced === 'high') return (cached = false);

  const nav = navigator as Navigator & { deviceMemory?: number };
  cached =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    isMobile ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 4) ||
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 4);
  return cached;
}
