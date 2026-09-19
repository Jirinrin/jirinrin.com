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

## What it is

**Filtered surface area re-rasterized per tick**, with animation acting as a second multiplier on top.

Two further loads settled it:

| Mode | Filtered surfaces | Animating inside? | Result |
| --- | --- | --- | --- |
| `?gradebisect=justone` | **1**, small, static (`#landscape-1`) | no | **smooth enough** — clouds parallax in real time, palette updates a few times a second |
| `?gradebisect=perel4still` | ~100 | **no** | **full jank** |

`perel4still` is the decisive row: a hundred filtered elements with **every animation stopped** is still
unusable, while one small static one is fine. So it is not animation on its own. And `justone` proves it
is not "SVG filters at all", which was the previous reading here.

What animation adds is a *rate*: it forces the same rasterization per frame instead of per tick. That is
why `gradetick=5000` did nothing for `perel4` — the animations were re-filtering those surfaces
regardless of what the palette clock was doing — and why plain `?grade=on` was the worst case of all:
its three groups cover a viewport, a full-height layer and a ~260vh section, *and* everything on the
page moves inside them. Enormous area × per-frame invalidation.

**The earlier "3 groups janky, 100 leaves janky, therefore count doesn't matter" reading was too
coarse.** Count doesn't matter; area does, and those three groups cover more of the page than the
hundred leaves do.

WebKit not GPU-accelerating `url()`-referenced SVG filters (unlike the native `filter` functions) is the
underlying reason any of this is expensive enough to notice. That part stands.

## Where the budget actually sits

`statics` — which keeps the filter on four static surfaces, two of them full-page — was better
than `perel4` and still not enough: no real-time cloud parallax, and clicking an object still
jumps to the zoomed state instead of animating there. So the budget is somewhere between "one
landscape painting" (`justone`, smooth) and "one landscape painting plus two full-page backdrops"
(`statics`, not smooth).

`?gradebisect=flat` is the response, and the last idea: filter only the two landscape paintings,
and hand every other surface the colour the table would have returned, from three flat custom
properties. That is exact rather than approximate wherever the source is a single colour, which here
is everywhere except those two paintings. The backdrop keeps its texture by screening the original
tile back over the flat fill. Details in COLOR-GRADE-CROSS-BROWSER.md.

## What follows from it

The grade can run on iOS, as long as the filtered surfaces are **few, static, and no larger than they
have to be**. Everything that moves gets a flat colour instead — which is exact, not an approximation,
because every animating layer in this scene is single-colour art with its shape in the alpha channel.
The full design, the element-by-element table and the remaining caveats are in
COLOR-GRADE-CROSS-BROWSER.md under "The shape that can ship"; `?gradebisect=statics` is the next load to
run.


## The second, smaller problem

`?grade=off` was "a lot better, even if some animations are still a tad choppy". That residue is worth
its own look once the filter question is settled. The known candidate is already written down:
~~**`getDocHeight`'s forced synchronous layout**~~ — **done.** It was worse than the note said:
`getPupilTranslation` called it three times per invocation, from a `requestAnimationFrame`
callback, so a moving cursor cost fifteen forced layouts per frame. Now cached, invalidated on resize,
orientationchange and a ResizeObserver on `<body>`. Whether it moves the needle on the iPad residue
is still unmeasured.

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
