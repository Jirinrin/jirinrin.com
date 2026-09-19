# iPad Safari: the main thread runs at ~0.3fps while the compositor runs at 60

Split out of the colour-grade work (COLOR-GRADE-CROSS-BROWSER.md, Phase 7) on 2026-09-19. It is **not**
separate from it: the measurements below point at the colour grade's SVG filter as the dominant cause,
which makes this the thing that decides whether any of that work can ship on iOS.

Device throughout: an iPad Pro (good hardware), on the real site.

## The observation

**Smooth, at what looks like full framerate** — and note that every one of these is a CSS keyframe
animation on `transform` or `opacity`, i.e. handed to the compositor and then run without the main
thread's involvement at all:

- `#sunrays` rotating, cloud drift/breathe, service-bubble float/breathe, ambient bubbles rising.

**Choppy — "one frame every couple of seconds", ~5s to settle after a scroll stops** — and every one of
these needs the main thread:

- the colour grade's own palette updates
- cloud parallax (scroll-driven `transform` written via a ref)
- the 時鈴々 title's scroll animation
- service bubbles revealing and dissolving
- popup open/close: clicking the octopus tree **freezes, then the dialog is suddenly in position** —
  the whole zoom-and-blur transition is skipped rather than played slowly

That last detail matters. A skipped transition is not a slow frame rate; it is the main thread being
unavailable for the entire duration of the animation and then catching up in one commit.

## What was measured, 2026-09-19

| Mode | Result |
| --- | --- |
| `?grade=off` | **Much better.** Some animations still "a tad choppy" — so there is a second, smaller problem underneath, but it is not what makes the site unusable. |
| `?grade=on` (plain, 3 group filters) | **Instantly choppy.** Clouds and nav title take seconds to settle after a scroll. |
| `?grade=on&gradebisect=perel4` (~100 leaf filters) | Choppy. |
| `…&gradetick=1000` | Still choppy; palette still only updating every 2–3s. |
| `…&gradetick=5000` | **No meaningful difference.** Still choppy, popup transitions still skipped. |

## What that rules out

**It is not the tick rate.** `gradetick=5000` is a 33× slower palette clock — 0.2 attribute rewrites per
second instead of 6.7 — and it changed nothing. So the cost is not the `setAttribute` rewrites, and not
the per-tick re-rasterization of everything referencing the filter. That was the leading hypothesis and
it is dead.

**It is not the number of filtered elements.** Plain `?grade=on` has **three** filtered groups and is
instantly choppy; `perel4` has roughly a hundred and is not dramatically worse. A cost that barely moves
between 3 and 100 is not a per-element cost.

**It is not about the grade being visible.** On Safari, plain `?grade=on` renders the landscape and
clouds *ungraded* — they composite past the ancestor filter, which is the bug Phase 7 diagnosed. The
page is paying the full cost of a filter whose output is not even on screen.

## What is left

**Having `url()` SVG filters on the page at all, while content animates in or near them.** WebKit does
not GPU-accelerate `url()`-referenced SVG filters (unlike the native `filter` functions), so the filtered
surface is rasterized on the main thread, and anything that changes inside or beneath a filtered group
forces that work again — every frame, regardless of whether the filter's own parameters changed.

That is consistent with every row of the table: constant over tick rate, roughly constant over element
count, and present even when the filtered output is being composited past.

If it holds, **the colour grade cannot ship on iOS in any form that filters animated content**, and no
amount of tuning `perel` changes that.

## The two loads that settle it

Both are new knobs, both take `?grade=on` alongside.

1. **`?gradebisect=justone`** — exactly **one** filtered element on the whole page, and a static one:
   the landscape image. Everything else, `.color-grade-background` included, gives its filter up.
   - **Smooth** ⇒ `url()` filters are affordable as long as nothing animates inside them. That is a
     workable architecture, and a good one: filter only the static art, and hand everything that moves a
     flat colour instead. Every animating layer in this scene turns out to be **single-colour art with
     its shape in the alpha channel** — clouds and both glow layers are pure white, the floating head is
     pure black — so none of them actually needs a per-pixel filter. They need one colour, which
     `gradeFlatColor` already computes in JS and publishes as a custom property (the Phase 2 channel).
   - **Choppy** ⇒ one SVG filter is already too much on iOS, and there is nothing to tune. Safari keeps
     the `.color-grade-off` fallback, and the per-element work stands as a Chrome/Firefox improvement
     and a written-up dead end.

2. **`?gradebisect=perel4still`** — `perel4`'s ~100 filters with every animation inside the graded groups
   stopped. Separates "too many filtered elements" from "filtered elements whose contents keep moving".
   - **Smooth** ⇒ confirms it is the per-frame re-filtering, not the count. Same conclusion as a smooth
     `justone`, from the other direction.
   - **Choppy** ⇒ the filters cost that much even at rest, which is the worse answer.

## The second, smaller problem

`?grade=off` was "a lot better, even if some animations are still a tad choppy". That residue is worth
its own look once the filter question is settled. The known candidate is already written down:
**`getDocHeight`'s forced synchronous layout**, called from `getPupilTranslation` ←
`applyPupilTranslation` inside a `requestAnimationFrame` callback, every frame. It profiled as the **#3
self-time item on the content main thread (10.9%)** on a fast Windows desktop, ~2.3–2.5ms per frame.
Cache the document height, or read it once per resize.

After that, in rough order:

1. **Scroll handlers** — the cloud parallax in OpeningClouds.tsx, and whatever drives the 時鈴々
   animation. Check whether any of them read layout (`offsetTop`, `getBoundingClientRect`,
   `scrollHeight`) inside the handler rather than from a cached value, which turns every scroll event
   into a layout flush.
2. **`backdrop-filter` count** — `.opening-clouds__glass` and `.service-bubble` both use one, and iOS
   composites those on a path that can fall back to the main thread. `isLowPowerDevice()` thins the cloud
   count, but an iPad Pro will not trip it.
3. **Reveal logic** for the service bubbles, if it is driven from a scroll handler rather than an
   IntersectionObserver.

Safari's Web Inspector attached to the iPad over USB from a Mac would show all of this directly and
settle it far faster than load-by-load bisection. The bisection exists because it needs no Mac.
