# iPad Safari: the main thread runs at ~0.3fps while the compositor runs at 60

Split out of the colour-grade work (COLOR-GRADE-CROSS-BROWSER.md, Phase 7) on 2026-09-19, because it
is almost certainly a bigger problem than the grade and deserves its own investigation. It is **not**
cleanly separate from it, though — see "How much of this is the grade" below. Read that before
assuming this is someone else's bug.

## The observation

Reported on an iPad Pro (good hardware), loading the real site with `?grade=on&gradebisect=perel3`.

**Smooth, at what looks like full framerate:**

- `#sunrays` rotating (`sunray-spin`, 120s linear)
- cloud drift and breathe (`opening-cloud-drift` / `opening-cloud-breathe`)
- service-bubble float and breathe (`bubble-float` / `bubble-breathe`)
- ambient bubbles rising (`bubble-rise`)

**Choppy — "one frame every couple of seconds", items taking ~5s to settle after a scroll stops:**

- the colour grade itself: the palette updates about every 3s instead of every 150ms
- cloud parallax (the scroll-driven `transform` written to `.opening-clouds__layer` via a ref)
- the 時鈴々 title's scroll animation
- service bubbles revealing and dissolving as they enter/leave
- popup open/close transitions

## What that split means

The smooth list is exactly **the CSS keyframe animations on `transform` and `opacity`** — the ones
that get handed to the compositor and then run without the main thread's involvement at all. The
choppy list is exactly **everything that needs the main thread**: JavaScript scroll handlers, style
recalculation, and the grade's own `setAttribute` writes.

So this is not a GPU problem and not a "the device is weak" problem. The compositor is fine. **The
main thread is saturated**, and every frame of work that has to pass through it is arriving seconds
late. A 5s settle after a scroll ends is the signature of a backlog being worked off, not of
something running slowly-but-steadily.

## How much of this is the grade

Possibly most of it, and this has to be measured before anything else is investigated.

Every element carrying `filter: url(#landscape-color-grade)` must be **re-rasterized on every tick** —
not because the element changed, but because the filter it references did. That is the cost
`FLAT_GRADE_TICK_MS` and the flat custom properties exist to avoid (see ColorGradeFilter.tsx, and
Phase 2 of the colour-grade document).

Under the group filter that was **3 elements**: `.color-grade-layer`, `.color-grade-background`,
`.ServiceBubbles`. Under the per-element path (`perel`) it is roughly **a hundred**: ~47 clouds ×
(`<img>` + `.opening-clouds__backing`), plus the sky pseudo-element, the three full-width landscape
layers, the landscape art, and every landscape object. At `TICK_MS = 150` that is ~6.7 × 100
re-rasterizations per second, on the main thread, on iOS.

If that is the cause, it is a direct finding about the colour grade, not a pre-existing site bug: it
would mean the per-element path cannot ship at `TICK_MS = 150` however good it looks.

But the symptom is broader than the grade — popup transitions and scroll handlers have no reason to
care about a filter — so there is plausibly a second, independent cause underneath. The known
candidate is already written down: **`getDocHeight`'s forced synchronous layout**, called from
`getPupilTranslation` ← `applyPupilTranslation` inside a `requestAnimationFrame` callback, every
frame. It profiled as the **#3 self-time item on the content main thread (10.9%)** on a fast Windows
desktop, ~2.3–2.5ms per frame. On a taller document with ~100 filtered layers dirtying the layout
tree, a forced layout read per frame is far more expensive than that.

## How to tell them apart — in one device pass

Each of these is a page load, in this order. The question every time is only "is the *choppy* list
above still choppy", since the smooth list is expected to stay smooth throughout.

1. **`?grade=off`** — no filter anywhere, everything else identical.
   Still choppy ⇒ the grade is not the cause, go to `getDocHeight`. Smooth ⇒ it is, continue.
2. **`?grade=on`** with no `gradebisect` — the original group filter, 3 targets. It renders grey on
   Safari, which does not matter here; the tick still runs and still repaints.
   Smooth ⇒ it is the *number* of filter targets, i.e. the per-element path specifically.
   Choppy ⇒ it is the filter at all, at any target count.
3. **`?grade=on&gradebisect=perel4&gradetick=1000`** — per-element, but ticking 6.7× slower.
   Smooth ⇒ confirms cost = tick rate × target count, and the fix is a budget rather than a rewrite.
   Then try `gradetick=400` and `gradetick=250` to find where it breaks down.
4. **`?grade=on&gradebisect=perel4&gradetick=5000`** — the extreme. If even this is choppy, the cost
   is not the tick at all; something about simply *having* ~100 filtered layers is the problem, and
   per-element grading is dead on iOS regardless of tick rate.

`?gradetick=<ms>` was added for exactly this (ColorGradeFilter.tsx, clamped to 30–5000ms). It is a
measurement tool, not a setting.

## If it turns out not to be the grade

Then the things to look at, in rough order of how much the existing profile implicates them:

1. **`getDocHeight` / `applyPupilTranslation`** — forced sync layout per rAF. Cache the document
   height, or read it once per resize. Already flagged in COLOR-GRADE-CROSS-BROWSER.md as deserving
   its own change; this would make it urgent rather than merely worthwhile.
2. **The scroll handlers**, particularly the cloud parallax in OpeningClouds.tsx and whatever drives
   the 時鈴々 animation. Check whether any of them read layout (`offsetTop`, `getBoundingClientRect`,
   `scrollHeight`) inside the handler rather than from a cached value, which turns every scroll event
   into a layout flush.
3. **`backdrop-filter` count.** `.opening-clouds__glass` and `.service-bubble` both use one, and iOS
   composites those on a path that can fall back to the main thread. `isLowPowerDevice()` already
   thins the cloud count; an iPad Pro will not trip it.
4. **IntersectionObserver / reveal logic** for the service bubbles, if the reveal is driven from a
   scroll handler rather than an observer.

None of this has been measured on the device yet. Safari's Web Inspector can be attached to an iPad
over USB from a Mac and will show the timeline directly, which would settle all of it faster than the
bisect above — the bisect exists because it needs no Mac.
