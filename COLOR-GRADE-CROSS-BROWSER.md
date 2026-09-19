# Color grade: making it work on Firefox and Safari

Research notes + staged plan. **Phase 0 ran on 2026-09-17 and collapsed most of the rest**, as it was
predicted to. This document has been rewritten to record what was measured and what that settled; the
research that is still live is kept below, and the parts that are now moot say so rather than being
deleted, so they don't get re-litigated.

| | Status |
|---|---|
| Phase 0 — measure | **Done.** Firefox measured and cleared. Safari still needs the on-device check below. |
| Phase 1 — one palette clock, one exact `gradePixel` | **Done.** |
| Phase 2 — Class A, filter off flat-colour elements | **Done.** |
| Phase 3z — widen the sniff to Safari | **Done earlier**, in `2d32f79` / `3f1d158`. |
| Phase 3a — capability + colour-space probe | **Built and validated on Safari**, still deliberately not wired in. See below. |
| Phase 3b — pre-warp the table for linearRGB | **Dropped.** Safari measured as sRGB; there is nothing to pre-warp. |
| Phase 3c — frame-budget watchdog | **Done.** It is what allowed the Firefox sniff to go. |
| Phase 3d — widen the mode type to `full`/`raster`/`off` | **Dropped.** There is no raster mode to name. |
| Phase 4 — cut the SVG filter's cost | **Partly done.** `will-change` landed; `TICK_MS` and the hue-fold deliberately not. |
| Phase 5 — WebGL renderer core | **Dropped**, per this document's own gate. |
| Phase 6 — the remaining Class B set | **Dropped**, same gate. |

## The problem, as it stands now

`#landscape-color-grade` ([ColorGradeFilter.tsx](src/components/ColorGradeFilter.tsx)) maps the site's
greyscale artwork onto a drifting 3-stop HSL gradient via `feComponentTransfer type="table"` plus a
`feColorMatrix` hue rotation, rewritten every 150 ms.

**Firefox: fixed, and it was never really broken.** It now runs the grade like any other engine.
**Safari: still confirmed broken** (tested 2026-09-17) and still deliberately switched off, so it gets
the same black-and-white fallback Firefox used to get. That is the one browser problem left.

Goal, unchanged: the grade running on every engine in *exactly* the current style. No hue-rotate
approximation, no blend-mode duotone — neither can recolour true black, and neither can hit a 3-stop map.

---

## Phase 0 — what the measurement actually said

Firefox 155.0 (build `20260903215306`), Windows 11 build 26200, Intel Core Ultra 7 155H, 16 physical /
22 logical cores. Hardware WebRender confirmed active — a separate GPU process with its own Compositor
and Renderer threads, ANGLE → D3D11 → NVIDIA (`nvwgf2umx.dll` loaded, real D3D11 draw calls on the
Renderer thread, zero occurrences of `SWGL` / `BasicCompositor` / `Software` anywhere in either profile).
Two ~10 s captures with the grade forced on, one per device tier.

| | `?perf=high` | `?perf=low` |
|---|---|---|
| Compositor frame interval, median | **16.68 ms** | **16.68 ms** |
| Compositor frame interval, max (whole capture) | **33.43 ms** | **35.74 ms** |
| Compositor intervals > 50 ms | **0** | **0** |
| Renderer-thread markers > 50 ms | **0** | **0** |
| Renderer-thread event delay | 0.00 ms | 0.00 ms |
| `CONTENT_FRAME_TIME` median / max | 27.15 / 72.79 ms | 19.72 / 53.59 ms |
| `ColorGradeFilter`'s own JS | 4 samples ≈ 8 ms of 10,330 ms (**0.08 %**) | **0 samples** |

A flat 60 Hz on both tiers. **The 650–870 ms claim did not reproduce in any form.** Four values in that
band do exist in the profiles and every one is a misreading: a `RefreshObserver` marker recording an
observer's *registration lifetime* (872 ms, payload `"Accessibility notifications [Display]"`), the
parent-process refresh driver idling at 832 ms p99 with no chrome UI to animate, and page-load metrics
(`FirstContentfulPaint` 672 ms, `TimeToFirstInteractive` 747 ms). The original figure was almost
certainly one of these.

**Caveats, recorded honestly.** Neither profile is symbolicated, so a C++ `FilterSupport` / `FilterInstance`
cost cannot be ruled out *by name* — only observed that every aggregate it would inflate (`PaintRoot`,
`WebRender display list`, `RenderThread::UpdateAndRender`) is within budget and that the compositor never
missed more than one vsync. The high↔low Renderer delta (980 ms of CPU over ~10 s) confounds the filter
with backdrop-filter panes and cloud count, so none of it can be assigned to the grade specifically. Both
captures were a Vite dev build with DevTools open; production is better than this. And `Jank`/BHR markers
were not enabled at capture, so their absence is a gap in the data, not a finding.

### The thing the profile found that this plan wasn't looking for

`getDocHeight` ← `getPupilTranslation` ← `applyPupilTranslation` is the **#3 self-time item on the
content main thread: 10.93 % (high) / 7.87 % (low)** — larger than `WebRender display list`, larger than
`Style computation`, and roughly **140× the colour grade's cost**. It is a forced synchronous layout
inside a `requestAnimationFrame` callback, running every frame, costing ~2.3–2.5 ms of every frame.

Caching the document height, or reading it once per resize instead of per rAF, is a bigger and far
cheaper win than anything in this document. **Not attempted here** — it is unrelated to colour grading
and deserves its own change.

### Safari's leg of Phase 0 — probe run 2026-09-18, and what it settled

**Result: on iPad Safari, rows 1, 2 and 3 all match.** The technique works. Specifically:

- **Row 1 = row 3.** A CSS `filter: url(#…)` on a real HTML element, running `feComponentTransfer` +
  `feColorMatrix`, produces exactly what the spec says it should. WebKit can do this.
- **Row 1 matched the *sRGB* prediction, not the linearRGB one.** WebKit is honouring
  `color-interpolation-filters="sRGB"`; the 2022 changesets did land, and
  [fxtf-drafts#285](https://github.com/w3c/fxtf-drafts/issues/285) is no longer a live concern here.
  **This closes Phase 3b** — there is nothing to pre-warp.
- **Row 1 = row 2.** The SVG-in-`<img>` path agrees with the CSS-on-HTML path on this engine, which is
  the disagreement 3a was built to look for. The probe is measuring something real. That is one engine's
  worth of validation, not a general proof, so 3a stays unwired — but it is no longer suspect.

**This does not yet explain the 2026-09-17 observation** that the site shows no grade on Safari, and it
does not on its own justify removing the sniff. The probe differs from the real thing in three ways, any
one of which is consistent with "the primitives work but the page is grey":

1. **The probe's filter is static; the site's is not.** The real one rewrites `tableValues` and `values`
   via `setAttribute` every `TICK_MS`. An engine that applies a filter once but does not invalidate
   referencing elements on a live attribute rewrite would show a *frozen* palette, which a static swatch
   cannot distinguish from a working one.
2. **Scale.** The probe filters 30px swatches. The site filters viewport-sized groups with dozens of
   animating children inside them. iOS Safari has real limits on filtered layer size and drops them with
   no signal.
3. **`.color-grade-background` is `position: fixed; inset: 0; z-index: -1` *and* filtered** — a
   combination iOS Safari has historically mishandled.

**The decisive test is to load the real site on the device with `?grade=on`.** Coloured and drifting ⇒
the sniff goes. Coloured but frozen ⇒ cause 1, and the fix is to rebuild the `<filter>` subtree rather
than mutate its attributes. Still monochrome ⇒ cause 2 or 3, and the way in is to bisect by forcing the
grade on with `.color-grade-background` removed.

The tooling, for re-running any of this without an inspector:

- Open the site with **`?gradeprobe=1`** on the device. The panel
  ([GradeProbeOverlay.tsx](src/components/colorGrade/GradeProbeOverlay.tsx)) shows three ramps.
  Row 1 is a CSS `filter: url(#…)` on real HTML elements — the path the site actually uses. Row 2 is the
  same filter inside an `<img>` — the path the probe can measure numerically. Row 3 is the expected
  output, computed in JS.
- **Row 1 matching row 3** means the technique works there and the sniff can go.
  **Row 1 matching the untouched strip** means it does not, whatever row 2 says.
  **Row 1 and row 2 disagreeing** is the most valuable outcome: it means the numeric probe is measuring
  something the site does not do, and confirms 3a must not be wired into `getColorGradeMode()`.
- **`?grade=on`** forces the grade on regardless of the sniff, for looking at the real page.

---

## Phase 1 — one palette clock, one exact `gradePixel` — **done**

[src/components/colorGrade/gradeClock.ts](src/components/colorGrade/gradeClock.ts). DOM-free, so the same
code runs in a node script. `gradePixel` is the SVG spec transcribed: the real `type="table"` lookup
including the `C = 1` clamp to `n−2`, the real `hueRotate` matrix, then clamp.

**The bug it deleted was much larger than its own comment admitted.** `flatGradeColor` approximated the
hue rotation as an HSL shift, calling that "close enough for a low-opacity blended wash". Measured over
15 palettes × 8 hue angles, that approximation was wrong by a **mean of ~35/255 and a worst case of
~160/255**. Every `--color-grade-flat` consumer — all the Groove Grove vinyl tints — had been a
substantially different colour from the filter it was standing in for. They look different now, and correct.

`setInterval` → a `requestAnimationFrame` loop throttled to `TICK_MS`. rAF stops entirely in a background
tab where `setInterval` is merely throttled to 1 Hz, and it cannot land mid-frame, so the SVG attribute
writes and the custom-property writes can no longer paint one frame apart. The hue stays phase-based off
`performance.now()`.

---

## Phase 2 — Class A: the filter comes off flat-colour elements — **done**

The caveat this phase used to carry ("this colours nothing on Firefox or Safari by itself") was resolved
by 3z landing first, exactly as planned. Every var carries a fallback equal to the old filter *input*
colour, so with the grade off nothing is written, the fallback applies, and those elements render as
they always did.

- **Popup anchor text** ([Landscape.scss](src/components/Landscape.scss)) — was
  `color: rgb(70,70,70); filter: url(#landscape-color-grade) saturate(0.4)` on the anchors themselves,
  i.e. an SVG filter re-rasterising live text glyphs 6–7 times a second. Now four custom properties
  (`--grade-link`, `--grade-link-hover`, `--grade-link-dark`, `--grade-link-dark-hover`), computed by
  `gradeFlatColor`, which reproduces the chain in the browser's own order — grade, *then* saturate. The
  `&::after` underline follows for free via `background: currentColor`.
- **`.groove-embed__tint`** ([GrooveGrove.scss](src/components/GrooveGrove.scss)) — now
  `background: var(--color-grade-flat)` with a 1 s transition, matching `.groove-vinyl__tint`.

---

## Phase 3 — the sniff, replaced by measurement

### 3z — widen the sniff to Safari — **done before this work**, in `2d32f79` / `3f1d158`

The remaining half, the three stale comments that named Firefox alone as the reason the fallback exists,
has now been picked up too.

### 3a — capability + colour-space probe — **built, deliberately not wired in**

[src/utils/colorGradeProbe.ts](src/utils/colorGradeProbe.ts). Renders a known ramp through a
self-contained copy of the filter in an SVG `data:` URL, reads it back off a canvas, and compares the
midtones against both an sRGB- and a linearRGB-interpolated prediction.

**It is not connected to `getColorGradeMode()`, on purpose.** It measures SVG-in-`<img>`, which is a
different code path from `filter: url()` on an HTML element, and there is no API to read back the latter.

Safari was the known-positive test case for that concern, and **as of 2026-09-18 it came back clean**:
rows 1 and 2 of the overlay agree there, so the probe is not measuring a fiction. It stays unwired anyway,
because one engine agreeing is not the same as the two paths being equivalent in general, and because the
site's own Safari problem is evidently *not* the thing this probe measures — see Phase 0 above.

### 3b — pre-warp the table for linearRGB engines — **dropped**

**Measured away on 2026-09-18.** Safari's output matched the sRGB prediction, not the linearRGB one, so
the engine is honouring `color-interpolation-filters="sRGB"` and there is no midtone shift to correct.
No other engine was ever suspected. The recipe is kept below only in case some future engine is found to
ignore the attribute; nothing in the codebase implements it.

If 3a ever does report linearRGB, compensate rather than disable: the
engine computes `out = lin2srgb(LUT(srgb2lin(c)))`, so build the shipped table by sampling in linear
space — for entry `i`, `x = i/(n−1)`, `value = srgb2lin(LUT_target(lin2srgb(x)))`. Raise `GRADE_STEPS`
from 25 to 64 for the warped table; resampling through the sRGB curve crowds the shadows and 25 entries
will band there. The unwarped path stays byte-identical everywhere else.

### 3c — frame-budget watchdog instead of a browser list — **done**

[src/utils/frameBudgetWatchdog.ts](src/utils/frameBudgetWatchdog.ts). Starts in the full grade, samples
rAF frame intervals for 6 s (covering the opening cloud animation, the heaviest moment on the page), and
if the 95th-percentile gap exceeds **50 ms** it drops the grade immediately and persists the verdict in a
`grade-tier` cookie with a 30-day max-age, so the next load starts in the right mode instead of
re-janking its way to the same answer.

It is a **p95, not a max**, so a single GC pause or tab switch cannot condemn a machine that is otherwise
fine — there is a check for exactly that case.

**The threshold is calibrated from one machine and says so.** On the reference hardware above, the site's
own rAF interval sat at a p95 of 34–39 ms during this window, because the opening clouds are genuinely
expensive. 50 ms is about 1.3× that: loose enough not to condemn a machine that is merely busy, tight
enough to catch one that is actually struggling. Revisit it if a second data point ever disagrees — and
do not quote it without saying where it came from, which is the mistake this whole module exists to stop
repeating.

The verdict feeds **the same tier flag** the cloud and glass layers already consume
([deviceTier.ts](src/utils/deviceTier.ts)), rather than becoming a second notion of "this device is
slow". One flag, one cookie. The grade comes off immediately since it is the thing that was measured;
the decoration layers read the tier when they mount, so they pick it up on the next load.

`prefers-reduced-motion` remains a hard `off`. `?perf=` and `?grade=` both suppress the watchdog — forcing
a mode in order to look at it should never write a verdict about the machine.

**`getColorGradeMode()` reads only the *measured* half of the tier, not `isLowPowerDevice()`.** The static
heuristic counts every phone as low-power, and phones render this perfectly well today; wiring the whole
tier in would have switched the grade off for every mobile visitor, which nobody asked for.

### 3d — widen the mode type — **dropped**

`'full' | 'raster' | 'off'` only earns its keep if a raster mode exists, and Phase 5 is dropped. The
existing `.color-grade-off` rules stay as the single fallback.

---

## Phase 4 — cut the remaining SVG filter's cost — **partly done**

- **Shrink the surfaces — done.** `will-change: filter` on `.color-grade-background` and
  `.color-grade-layer` ([App.scss](src/App.scss)), pinning the two permanently-graded surfaces as their
  own compositor layers.
- **Slow the tick — deliberately not done.** `TICK_MS` stays at 150. Phase 0 says to pick this value from
  the measurement, and the measurement says the filter is not costing anything worth reclaiming: a flat
  60 Hz with the component's own JS at 0.08 % of the main thread. Changing the look of the palette drift
  to buy nothing measurable is a bad trade. The lever is still there if a slower machine ever needs it.

  The reasoning about *what* the tick buys remains true and is worth keeping: it only matters for groups
  whose contents are static between ticks (`.color-grade-background`, an open popup's parchment, the
  Groove Grove treeline). `.ServiceBubbles`, `.opening-clouds-behind` and `.color-grade-layer` all hold
  permanently-animating content and are re-graded **every frame their contents move, regardless of
  `TICK_MS`**. The levers for those are group *area* and *content*, not tick rate.
- **Fold the hue rotation into the table — not attempted.** It was gated on "measure first", and the
  measurement removed the reason to. It is exactly equivalent only for greyscale input and *not* for
  non-neutral input, so it would need checking against the art gallery, the parchment texture and the
  Memories photos to buy a saving nothing is asking for.

---

## Phases 5 and 6 — WebGL — **dropped**

Gate, from this document: *"build this only if Phase 0 + Phase 4 leave a real engine/hardware combination
still failing."* Phase 0 left none. Firefox is fine; Safari's problem is that the filter does not render
at all, which a WebGL renderer would not diagnose and the black-and-white fallback already handles
correctly.

The counter-evidence was also pointing the same way: `transferToImageBitmap`
[incurs a full pixel readback on Firefox and Safari](https://bugzilla.mozilla.org/show_bug.cgi?id=1788206)
where Chrome keeps it on-GPU — the cheap path is cheap only on the browser that never needed fixing.

The design work is kept below rather than deleted, because if Safari is ever shown to be unable to run
the filter at all, this is the only remaining route to grading it.

<details>
<summary>The architecture, shader and traps, preserved</summary>

One shared **WebGL2 context on an `OffscreenCanvas`**, `transferToImageBitmap()` → per-element
`<canvas getContext('bitmaprenderer')>`. `transferFromImageBitmap` is a pointer swap, not a copy.
Support: `OffscreenCanvas` Safari 16.4+, `ImageBitmapRenderingContext` Safari 15+.

Rejected, with reasons: per-element WebGL contexts (Chrome caps ~16 live contexts, we'd need 20–40);
texture atlas + `background-position` (CSS can't reference a canvas; blob re-encode is 20–60 ms/tick);
shared GL + per-element 2D `drawImage` — keep as a runtime fallback only, since Safari has historically
de-accelerated 2D canvases under memory pressure with no signal.

The shader must reproduce `feComponentTransfer type="table"` exactly: **three independent per-channel 1D
lookups**, not a luminance gradient map. Use a 25-entry `vec3` uniform array, not a LUT texture — a
texture would quantise to 8 bits and drag in texel-centre subtleties.

```glsl
vec3 svgTable(vec3 c) {
  vec3  x = clamp(c, 0.0, 1.0) * 24.0;          // n - 1
  ivec3 k = ivec3(min(floor(x), vec3(23.0)));   // the C == 1 -> n-2 clamp
  vec3  t = x - vec3(k);
  return vec3(
    mix(uTable[k.r].r, uTable[k.r + 1].r, t.r),
    mix(uTable[k.g].g, uTable[k.g + 1].g, t.g),
    mix(uTable[k.b].b, uTable[k.b + 1].b, t.b)
  );
}
void main() {
  vec4 src = texture(uSrc, vUv);      // unpremultiplied - see below
  vec3 c   = clamp(uHue * svgTable(src.rgb), 0.0, 1.0);
  fragColor = vec4(c * src.a, src.a); // re-premultiply for the compositor
}
```

Three traps that fail silently:

- **Alpha.** SVG filter primitives operate on **non-premultiplied** RGBA. `UNPACK_PREMULTIPLY_ALPHA_WEBGL
  = false` does *not* un-premultiply — it only declines to premultiply, and decoded `HTMLImageElement` /
  default `ImageBitmap` texels are already premultiplied. Use
  `createImageBitmap(src, { premultiplyAlpha: 'none' })`, or every antialiased PNG edge gets a dark halo.
- **Colour space.** `colorInterpolationFilters="sRGB"` means no linearisation anywhere: no
  `SRGB8_ALPHA8`, no `pow(c, 2.2)`. Use `colorSpaceConversion: 'default'` for parity with how the browser
  paints the same PNG in an `<img>`; add "compare on a P3 display" to the test list.
- **`mat3` is column-major in GLSL** and the SVG hueRotate matrix is written row-major. Upload transposed.
  Clamping after `hueRotate` is load-bearing — it routinely pushes out of gamut.

The one target that would have been worth building: **`.color-grade-background`**. Largest graded area on
the page, an empty `aria-hidden` div with no children and nothing compositing into it.

Phase 6's set was `FrameOverlay` and `Plaque` in [ArtGallery.tsx](src/components/ArtGallery.tsx) and
`.groove-trees__img`. Required guards, if ever revived: `IntersectionObserver` so only on-screen tiles
register, and cap grade-canvas DPR at 2 — without these, ~30 double-buffered 800×800 output surfaces is
**~154 MB** against an iOS Safari per-page canvas backing-store cap of roughly 224 MB, and over it
canvases silently go blank.

</details>

---

## The research that is still load-bearing

### The hard limit on any shader path

The grade is a **non-linear per-channel LUT**, therefore:

> `grade(A over B) ≠ grade(A) over grade(B)`, and `grade(A ⊕ B) ≠ grade(A) ⊕ grade(B)` for every blend
> mode in use on this site.

Anywhere the current look depends on grading a *composite*, grading the parts separately gives a
different picture. [OpeningClouds.scss](src/components/OpeningClouds.scss) is already a written proof of
this for the clouds: their colour comes from grading the cloud PNG composited over a masked dark
`__backing`, and grading the PNG alone lands it on the table's pale highlight stop.

**Filter order is the other half of this.** An element's own `filter` applies to *its own* rendering
first; only that result is composited into the ancestor's group and graded. So for a child with its own
filter the pipeline is `grade(f(A))`, never `f(grade(A))`.

- A per-element `saturate()`/`hue-rotate()` on **neutral grayscale input is a no-op** — it runs before the
  grade, on pixels with no chroma yet. Only filters *after* the `url(#…)` token in the same `filter` list
  act on graded colour. That is precisely why Phase 2's `gradeFlatColor` applies `saturate` *after*
  `gradePixel` and not before.
- Anything *outside* the graded group but visually over it (a `backdrop-filter` pane, a `mix-blend-mode`
  sibling) reads graded pixels; anything inside reads ungraded ones.

The three classes, which still govern what can move off the SVG filter:

- **Class A — flat colour.** The element paints one RGB. `grade()` it in JS, ship a CSS custom property.
  Exact, zero raster cost, needs no filter support in the engine at all. **This is Phase 2, and it is done.**
- **Class B — one static image, no painting children, nothing compositing into it.** Shader-able. Phase 6's set.
- **Class C — everything else.** SVG filter or nothing.

### Dead ends, so they aren't re-litigated

CSS custom filters / `filter: shader()` were
[removed from browsers, not shipped late](https://developer.chrome.com/blog/introduction-to-custom-filters-aka-css-shaders);
Houdini's Paint API cannot read backdrop pixels; `-moz-element()` is Firefox-only; CSS `background-image`
cannot reference a `<canvas>`.

### Explicitly not attempted

- **`.color-grade-layer`** and **`.ServiceBubbles` / `.opening-clouds-behind`** — Class C. They grade
  composites of blend-moded, animating, interactive subtrees. They stay on the SVG filter.
- **The four `::before` parchment/button textures** — a pseudo-element can't host a canvas, and promoting
  each to a real child reworks stacking, `border-radius: inherit` and `overflow` clipping for four small
  elements that are on screen one or two at a time. Not worth the regression risk.

---

## Verification

1. **Firefox** — done, numbers above, and in the commit message for the sniff removal.
2. **Safari** — the only browser question left. (a) `?gradeprobe=1`: **done 2026-09-18, rows 1/2/3 all
   match**, so the primitives work and the interpolation space is sRGB. (b) **Outstanding: load the real
   site with `?grade=on` on the device** and see whether the landscape is coloured, frozen, or still
   grey — see Phase 0 for what each outcome means. (c) While the sniff is still in place, confirm the
   `.color-grade-off` fallback reads correctly there: well glow neutral, popup link underline readable.
3. **Chrome regression check** — Phases 1, 2 and 4 change rendered output for *everyone*. Compare
   landscape, art gallery (all 27 presets), Groove Grove vinyl tints, popup parchment and graded link
   text before/after. **Expect the vinyl tints to have changed**: that is Phase 1's bug fix, not a
   regression.
4. **Exactness test** — `npm run verify-grade`. 20 checks: a 256-step ramp through `gradePixel` against an
   independent transcription of the spec (written a different way on purpose — segment-walking instead of
   floor arithmetic, and the hue matrix assembled from the spec's `A + cos·B + sin·C` decomposition rather
   than the expanded constants), plus the watchdog driven against synthetic frame streams.
5. **Fallback intact** — force `?grade=off` and confirm the well glow and popup link underline still read
   correctly.
6. `npm run build` (runs `tsc --noEmit`).
7. **Lighthouse, both form factors**, against `vite preview`:
   `CHROME_PATH=… npx lighthouse http://localhost:4173/ --preset=desktop --only-categories=performance`
   and the same without the preset for mobile. Watch the `non-composited-animations` audit specifically.

### Still to do

- **Phase 7 below** — Safari is diagnosed, `perel4` looks right and is preserved (tag
  `safari-perel4-full`), and the cost is measured: filtered surface area per tick. `statics` was not
  cheap enough; `flat` is the last idea and the one outstanding device question. See also
  [IPAD-SAFARI-MAIN-THREAD.md](IPAD-SAFARI-MAIN-THREAD.md).
- Item 7's Lighthouse run. **Item 3's Chrome regression pass is done** — checked 2026-09-19, no
  regressions found.
- ~~`getDocHeight`'s per-frame forced layout~~ — **done**, as its own change. Cached, with invalidation
  on resize, orientationchange and a ResizeObserver.

---

## Phase 7 — Safari, diagnosed (2026-09-18)

### The cause

**An element running a compositable animation is promoted to its own layer, and WebKit composites that
layer _past_ an ancestor's filter instead of through it.** The landscape art and the clouds animate inside
`.color-grade-layer` / `.ServiceBubbles`, inherit the grade from those groups, and therefore render
ungraded. The popup and the groove-grove image carry `filter: url(#landscape-color-grade)` _themselves_
and grade correctly.

This was measured on iPad Safari, not inferred. Everything below **works** there:

| Tested | Result |
| --- | --- |
| `feComponentTransfer` + `feColorMatrix` via `filter: url()` | exact, and in **sRGB** (closes 3b) |
| A 5000px-tall filtered element | fine |
| `transition: filter` on a list containing `url()` | fine |
| `will-change: filter` | fine |
| `position: fixed` + filter | fine |
| A filtered element with a continuously animating **child** | fine |
| Live `setAttribute` rewrites of `tableValues` | fine — repaints correctly |
| **M** — static child, inherits the group's filter | **coloured** |
| **N** — animated child, inherits the group's filter | **GREY** ← the bug |
| **O** — animated child with its **own** filter | **coloured** ← the way out |

`?gradebisect=noanim` colours the entire landscape and all the clouds correctly, which is the proof on
the real page rather than in a panel.

### What does not fix it

`isolation: isolate`, `contain: paint`, `transform: translateZ(0)` and `backface-visibility: hidden`
(`?gradebisect=fixa`..`fixd`) were all tried on the device. **None work.** There is no documented
workaround: WebKit's filter/compositing work ([109098](https://bugs.webkit.org/show_bug.cgi?id=109098),
[PR 73910](https://github.com/WebKit/WebKit/pull/73910)) concerns filter _outsets_ on composited layers,
not making a promoted descendant composite through an ancestor filter, and
[229399](https://bugs.webkit.org/show_bug.cgi?id=229399) confirms composited and non-composited animations
are separate paths there.

**WebGL is not an alternative.** The grade is trivial as a shader — it is already written exactly, as
`gradePixel` in `gradeClock.ts` — but WebGL cannot sample the DOM, and what needs grading is the
_composite_: positioned images, `mix-blend-mode` layers, `backdrop-filter` glass, live text. Using it
would mean rebuilding the landscape as a canvas scene. Per-image WebGL is just per-element grading with a
heavier engine and the same blend-maths problem.

### The remaining path: per-element (`perel`)

Take the filter off the groups, put it on the leaves. Probe O proves a promoted layer honours its own
filter. `?gradebisect=perel4` is the current attempt.

**A cost that looked inherent, and was not.** `grade(blend(a,b)) ≠ blend(grade(a),grade(b))`, so anywhere
the art uses `mix-blend-mode` the result genuinely changes, because following the grade _is_ the group
operation WebKit refuses. Earlier notes here counted three full-width layers under that heading. Measured
(`sharp`, raw RGBA, every pixel), only **one** of them is a blend layer at all:

| Layer | Art | Blend | Verdict |
| --- | --- | --- | --- |
| `#sunrays` | pure white, L 254–255, shape entirely in alpha | **none** | ordinary alpha layer — just grade it |
| `#shining-effect` | pure white, L 255 everywhere, shape in alpha | `screen` | `screen(x, white) = white`, so against this source the blend mode has never done anything a normal composite would not |
| `#jiri-head` | **flat black** — 99.2% of visible px below L 25, alpha-weighted mean L 0.3/255, shape in alpha | `multiply` | looked like the only real one; see `perel4` below, where it turned out not to be either |

All three turn out to be single-colour art whose shape lives entirely in the alpha channel - two white,
one black - so none of them is a case of `grade(blend(a,b))` at all. What is left is a *tone placement*
problem, which is fixable; see `perel4`. The other cost is real and unchanged, and is now the one that
gates everything: per-element grading multiplies live filter targets, which is what Phase 2 existed to
reduce.

**Where `perel2` got to, on the device:** the main landscape graded correctly; the clouds came out with
a **black** patch behind them; `#jiri-head` and "the gradient behind it" did not follow the grade.

### `perel3` — the two `perel2` symptoms, and what the device said back

Both `perel2` symptoms had ordinary causes, found by measuring the art rather than by a round-trip.

**1. The black clouds were an input problem, not a filter problem.** `background-darkgray.webp` is not
dark gray. Measured over all 2000×2000 pixels: **mean luminance 10/255, sd 4.8, maximum 31** — it is
near-black. That never mattered while the whole group was graded, because the swatch was never seen on
its own: the white cloud image on top pulled the _composite_ up to roughly 0.30 before the lookup table
saw it, and 0.30 is where the table pays out its vivid midtone stop. Grade the swatch by itself and the
table gets 0.04, hands back the darkest stop, and at `opacity: 0.55` that paints a cloud-shaped hole.

**2. Most of "jiri-head and the gradient behind it" was the sky.** `.color-grade-layer` paints the tiled
backdrop as its **own CSS background**, so taking the filter off the group took the grade off the whole
sky with it — on top of `#shining-effect`, `#sunrays` and `#jiri-head` all being explicitly excluded.

`perel3` fixed both (a `brightness(7)` lift on the cloud swatch; the sky's paint moved into a
`.color-grade-layer::before` that carries the filter itself) and graded the three full-width layers.

**Device run, iPad Safari, 2026-09-19 — it works, and it is close.** The clouds came out coloured, their
hue drifting, "beautiful and funky". Everything from here is taste and tuning, not a rendering failure.
Four things came back, and all four have the same cause, which is the finding worth keeping:

> A group filter never hands the lookup table a raw tone. It hands it a **composite** — art over art
> over backdrop — which lands somewhere in the middle by accident. Grade the same elements one at a
> time and each one hands the table its own tone instead. For this site's art that means the very
> bottom (near-black swatches and silhouettes) or the very top (pure white glows), and **both ends are
> where the palette has least to give**: the shadow stop is dark (`l` 0.14–0.24), the highlight stop is
> deliberately pale (`l` 0.8–0.92, `s` 0.35–0.65), and only the midtone stop is vivid (`s` 0.65–0.95).

So `perel4` puts a plain CSS filter function in front of the `url()` on each of those elements, to land
it where the composite used to land, and lets the table do the rest.

| Reported | Measured cause | `perel4` |
| --- | --- | --- |
| Clouds have dark patches inside them | `brightness()` **multiplies**, so it stretches the tile's 0–31 across most of the table instead of moving it: the light end goes vivid, the dark end stays on the shadow stop | `brightness(7.9) contrast(0.55)` — `contrast()` pivots about 0.5, not 0, so the multiply becomes a lift *and* a squash. Lands 0–31 at ≈0.23–0.58: still a wide enough spread to read as hue variation across one cloud, with a floor clear of the shadow stop |
| `perel3lift` (×12) went whiter and flatter on some palettes | ×12 clips everything above L 21 to white, which is most of the tile | gone — the squash needs no clipping. `perel4calm` is the same map compressed harder (5.7/0.4, ≈0.30–0.51) for a less trippy reading |
| The sky stays whitish while the landscape's whites go green | shine and sunrays are **pure** white, so they grade at `t` = 1.0, the palest the table ever gets. The landscape art never actually reaches white: `landscape-1.webp` opaque pixels are p90 **189**, p99 **232**, max 249 | `brightness(0.75)` before the grade, putting them where the real art's highlights sit, so they pick up the colour the landscape's whites do instead of sitting above them |
| The floating head stays brownish even when the darks are deep purple | `jiri-head.webp` is a **flat black silhouette** — 99.2% of its visible pixels below L 25, alpha-weighted mean **L 0.3/255**, the whole shape in alpha. `multiply` therefore gives backdrop × shadow-stop, and a product of two hues is a muddy third one | drop `multiply`, same as `#shining-effect`. Graded and composited normally it paints the shadow stop's actual colour. Nothing in the art is even fully opaque (max alpha < 255, at `opacity: 0.68`), so it stays a veil rather than a sticker. `perel4head` keeps `multiply` to compare |

Two more answers from the same run: **the popup dim works** (the re-chained `saturate(0.5)` on the
leaves does its job), and **the neutral service bubbles read as intentional** — but colour was still
wanted, so `perel4` tints them through `--color-grade-flat` rather than the filter. That property is
written once every 8s and already carries a slow transition, and it paints *under* the existing white
gradients (whose stops fade to 0.02 alpha) rather than restating them, so it costs nothing and no
animating element gains a live filter.

**So `#jiri-head` was never a real blend layer either.** All three full-width layers turn out to be
single-colour art whose shape lives entirely in the alpha channel — two white, one black. The
"`grade(blend(a,b)) ≠ blend(grade(a),grade(b))` is an inherent cost" framing that ran through this
document from the start applied, in the end, to nothing that is actually on the page. What is left is
not a blend-maths problem at all; it is a **tone-placement** problem, and tone placement is fixable.

### `perel4` on the device, and the second tuning pass

**It looks right.** "On perel4 everything looks quite very nice." The remaining notes were all taste,
and all four are now answered in the same mixin:

| Reported | Change |
| --- | --- |
| `perel4calm` rejected outright — the trippiness of `perel3`'s clouds was the point | Cloud map goes back toward it: `brightness(8.5) contrast(0.75)`, ≈0.13–0.72, nearly `perel3`'s spread with only the floor lifted off the shadow stop. `perel4calm` is gone; `perel4trip` restores `perel3`'s exact map (×7, no squash) for a side-by-side |
| Bubbles read flat — colour wanted at the edges, as other browsers show | The 35% face wash drops to 10%, and the colour moves to the rim and the halo (`border-color`, and the ambient bubbles' inner/outer glow). Which is how glass actually behaves: a thin curved shell has far more material to look through at its edge than at its centre |
| Sunrays want to be more visible | `$sky-pull`'s `brightness(0.75)` is what gave the sky its colour back, but darkening a glow also makes it recede. `opacity: 0.58` on `#sunrays` buys back what the brightness spent. The shine is left at 0.8; it is already doing most of the sky's colouring |
| The head is nicer than `perel4head`'s multiply, but wants more colour | `contrast(0.7)` before the grade. `brightness()` cannot lift flat black (anything × 0 is 0), but `contrast()` pivots about 0.5, so black moves to 0.15 and the table answers a third of the way up the shadow-to-midtone lerp instead of at its very bottom. A trailing `saturate(1.5)` amplifies the chroma that comes back, on top of that rather than instead of it |

`perel4head` is gone too — `normal` beat `multiply`, as the silhouette measurement predicted.

#### Why the shine cannot colour the head, and what can

The run asked whether `#shining-effect` could be made to grade `#jiri-head` the way it does on other
browsers — by making it an opaque white-on-black asset, grading that, and blending it over the head.

It cannot, and the reason is the clearest statement yet of what changes under per-element grading.
**Under a group filter the shine and the head go into one composite and out through one table lookup, so
stacking order is irrelevant to the resulting colour. Per-element there is no composite to grade** —
each layer is coloured alone and then merely stacked — **so order becomes everything.** And
`#shining-effect` is at `z-index: 1`, below `#jiri-head` at 11. It paints on the sky and never touches
the head at all. The opaque-base variant does not change that and adds a problem of its own:
`grade(black)` is the shadow stop, not black, so an opaque base would screen a ~19%-lightness colour
over the whole landscape as uniform fog.

`?gradebisect=perel4shine` tries the version that can work: drop the head below both glow layers so the
already-graded shine passes over it, and put the shine on `overlay`, which leaves the backdrop's
structure alone while pushing its hue toward the source. No new art, no cost. It does put the head
behind the rays instead of in front of them, which is a real change to the scene.

### The cost question, answered

Three device runs settled it. The middle row is the one that mattered.

| Mode | Filtered surfaces | Animating inside? | Result |
| --- | --- | --- | --- |
| `?grade=off` | 0 | — | much better (a small residue remains) |
| `justone` | **1**, small, static (`#landscape-1`) | no | **smooth enough.** Clouds parallax in real time; the palette updates a few times a second |
| `perel4still` | ~100 | **no** | **full jank** |
| `perel4` | ~100 | yes | full jank |
| `?grade=on` plain | 3, but *enormous* (a viewport, a full-height layer, a ~260vh section) | yes | instantly choppy |
| `perel4` @ `gradetick=5000` | ~100 | yes | no meaningful difference |

**The variable is filtered surface area re-rasterized per tick.** `perel4still` is the row that says so:
a hundred filtered elements with **every animation stopped** is still unusable, while one small static
one is fine. Animation is a second multiplier on top — it forces the same work *per frame* instead of
per tick, which is why `gradetick=5000` did nothing for `perel4` (the animations were re-filtering it
anyway) and why the three-group case was the worst of all: enormous surfaces *and* everything on the
page moving inside them.

This corrects the framing in the previous round, which read "3 groups janky, 100 leaves janky" as
"element count doesn't matter". Count doesn't matter; **area does**, and those three groups covered more
of the page than the hundred leaves do.

### `statics` was better and still not enough — which finishes the arithmetic

Better than `perel4`, but still no real-time cloud parallax and still no zoom animation on clicking an
object. Put next to the earlier rows, that is the last piece:

| Mode | Live filtered surfaces | Result |
| --- | --- | --- |
| `justone` | 1, small, static | **smooth enough** |
| `statics` | 4, of which **two are enormous** — the full-viewport `.color-grade-background` and the full-height sky tile | better, not enough |
| `perel4still` | ~100, static | full jank |

`statics` added two static surfaces to `justone` and lost it again, so it really is area, and the budget
is somewhere between "one landscape painting" and "one landscape painting plus two full-page backdrops".
At ~6.7 ticks/s over roughly 11 megapixels of non-accelerated SVG filter, that is unsurprising.

**And those two surfaces are the ones least worth spending it on.** They are a tiled *near-black*
texture — mean luminance 10/255, sd 4.8. The entire width of the lookup table is being paid for to
render what amounts to one colour with a faint texture on it.

### `flat` — the last idea, and it is a real one

Pay for the table only where the art uses it, and give everything else the colour the table would have
returned.

- **Filtered:** `#landscape-1` and `#landscape-2` only. Real grayscale art, genuinely needs a
  per-brightness table, and static. Two small surfaces — `justone`'s budget, which the device ran
  smoothly.
- **Flat:** everything else, from three new custom properties — `--grade-shadow`, `--grade-mid` and
  `--grade-highlight` (ColorGradeFilter.tsx), written every tick beside the link colours. Four
  `setProperty` calls became seven.

This is **exact, not an approximation**, wherever the source is one colour: grading one colour can only
produce one colour, and `gradeFlatColor` is the same tables and the same hue rotation evaluated once in
JS instead of per-pixel in SVG. The clouds, both glow layers and the floating head all qualify — every
one of them is single-colour art whose shape lives entirely in the alpha channel.

**The backdrop keeps its texture.** `background-blend-mode: screen` composites the original tile back
over the flat colour, and since the tile tops out at L 31 that lifts it by at most ~12% of its headroom —
close to what the table did with those same tones, the difference being that the variation now reads as
lightness rather than as hue.

**What `flat` still cannot do**, because CSS cannot repaint an `<img>` in a flat colour:
`#shining-effect`, `#sunrays`, `#jiri-head` and the cloud `<img>`s stay ungraded and will look wrong.
Converting them to `mask-image` divs is exact and cheap, and is a strict improvement on Chrome too since
it removes three full-width SVG filter surfaces there as well — but it is a TSX change, and it is the
work this knob exists to justify. **Judge the framerate and the backdrop; ignore those four.**

If `flat` is smooth, the remaining path is that conversion and nothing else, and Safari gets a real
coloured landscape. If `flat` is *not* smooth, then two small static filters plus flat fills is already
past the budget, there is nothing left to remove, and the grade genuinely cannot run on iOS — in which
case the cleanup is: fallback stays permanent, `perel4` and `flat` are kept as knobs for a future
WebKit, and everything else in the bisect list comes out.

### The shape that would ship, if `flat` holds

| Layer | Ships as |
| --- | --- |
| `.color-grade-background`, `.color-grade-layer` | flat `--grade-shadow` + tile screened back on |
| `#landscape-1`, `#landscape-2` | **filtered** — the only live filters left |
| `.opening-clouds__backing` (~47) | flat `--grade-mid` through the existing mask |
| cloud `<img>` (~47) | `<div>` + `mask-image`, flat `--grade-highlight` |
| `#shining-effect`, `#sunrays` | `<div>` + `mask-image`, flat `--grade-highlight` |
| `#jiri-head` | `<div>` + `mask-image`, flat `--grade-shadow` |
| `.service-bubble`, `.ambient-bubble` | flat already |
| landscape objects, creatures | flat or unfiltered — static on iPad, and small |

The cost that remains, and it is a real one: **the clouds lose their within-cloud hue variation.** A flat
fill has no tonal variation for the table to turn into hue, so the trippiness `perel4`'s
`brightness(8.5) contrast(0.75)` exists to produce does not survive. That is the honest trade for a
coloured Safari, and it is a judgement call rather than a technical one.

### `perel4` is preserved, not abandoned

It is visually finished — "everything looks quite very nice", and `perel4shine` was tried and rejected
as fitting the landscape less well. What makes it unshippable is WebKit declining to GPU-accelerate
`url()` filters, which is a browser limitation and not a design mistake, so it is kept whole rather than
unpicked:

- tagged **`safari-perel4-full`** at the commit where it was finished;
- kept as a live knob (`?grade=on&gradebisect=perel4`) rather than deleted, so a future Safari can be
  re-tested in one page load instead of a git archaeology session;
- `perel4trip`, `perel4shine`, `perel4still` and `perel4calm` are gone — their questions are answered
  above and in the commit history, and keeping four copies of a 100-selector mixin in everyone's CSS to
  preserve a comparison nobody needs again is not preservation, it is clutter. Trimming them took the
  stylesheet from 62.0 kB to 53.6 kB.

### Still ungraded under `perel4` (CSS paint, not `<img>`)

- **`h2.landscape-name`** — `mix-blend-mode: multiply` on `rgba(0,0,0,0.274)` text at `font-size: 25rem`.
  A single flat colour, so it belongs on a custom property like `--grade-link-dark`, never on the filter.
- **`.service-bubble` / `.ambient-bubble`** take the palette through `--color-grade-flat` — face, rim and
  halo. Their `::before` specular glints stay white on purpose; a specular highlight is white in life.
- **`#well-of-memories__shine`** is graded (`blur(6px)` first — blurring *after* would smear graded
  colours together rather than grade a soft shape).
- **`.opening-clouds__glass`** stays unfiltered: it is a `backdrop-filter` sampling the art behind it, so
  it picks the grade up for free once that art has it.

### What to run next

**`?grade=on&gradebisect=flat`**, and only that. Two questions:

1. **Is it smooth** — real-time cloud parallax, and a zoom animation that plays rather than jumps?
2. **Does the backdrop still look like the site** — textured, coloured, drifting — with the tile screened
   over a flat fill instead of pushed through the table?

The four ungraded `<img>` layers will look wrong. That is expected and is not what is being tested.

### The diagnostic knobs

All take `?grade=on` alongside. Defined in `App.scss`, wired in `App.tsx`. **These are diagnostics, not
features** — whatever ships should be a real rule, and these should come out.

`nofilter` (useless as a control — the art is monochrome at source, so grey proves nothing) · `nowc` ·
`bgonly` · `layeronly` · `noblend` · `noshine` · `noanim` · `fixa`..`fixd` · `justone` · `perel4` · `statics` · `flat`

The `perel1`..`perel3` knobs have been removed now that the runs above settled what they each asked;
what they proved is recorded here rather than in the stylesheet. `?gradetick=<ms>` is separate from
all of these and composes with any of them.

`?gradeprobe=1` mounts the bisect panel (rows A–K in-panel, L/M/N/O portaled into the real landscape,
plus measured sizes and an ancestor walk). It has a hide/show button.

### Not bugs

- **Nothing animates on iPad** — `assets/objects/index.ts` serves `isMobile ? 'png' : 'webp'`, so the
  animated objects are deliberately static there, and `Landscape1.tsx` gates creature spawning behind
  `!isMobile`. Both predate this work.
- **`#Landscape-container` reports `filter: none`** — it never carries one; the grade is on
  `.color-grade-layer` inside it.
