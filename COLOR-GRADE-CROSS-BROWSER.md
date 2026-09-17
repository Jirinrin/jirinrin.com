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
| Phase 3a — capability + colour-space probe | **Built, deliberately not wired in.** See below. |
| Phase 3b — pre-warp the table for linearRGB | **Open**, and untestable until Safari renders anything. |
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

### Safari's leg of Phase 0 is still outstanding

Safari shows **no grade at all**, so there is no "grade on vs. off" benchmark to run until it renders
something. What is needed is a *diagnosis*, and the tooling for it now exists and needs no inspector:

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
Safari is the known-positive test case: if the probe reports "filter applied" on the same Safari where
the page visibly has no grade, the probe is measuring the wrong thing and must stay disconnected. Run the
overlay there before trusting it.

### 3b — pre-warp the table for linearRGB engines — **open**

Unchanged and still correct, but it cannot be tested until an engine renders the filter at all, which as
of 2026-09-17 does not include Safari. If 3a reports linearRGB, compensate rather than disable: the
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
2. **Safari** — still outstanding, and now the only browser question left. (a) Confirm the
   `.color-grade-off` fallback reads correctly there: well glow neutral, popup link underline readable.
   (b) Open `?gradeprobe=1` and compare rows 1, 2 and 3 as described in Phase 0 above. (c) Only if the
   filter turns out to render: check whether 3a's linearRGB detection fires and whether 3b's pre-warp
   makes Safari and Chrome match.
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

- The Safari check in item 2 — the only thing standing between Safari and a decision.
- Item 3's Chrome regression pass and item 7's Lighthouse run.
- `getDocHeight`'s per-frame forced layout, as its own separate change.
