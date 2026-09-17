# Color grade: making it work on Firefox and Safari

Research notes + staged plan. Not started — Phase 0 is a measurement and may collapse most of the rest.

## The problem

`#landscape-color-grade` ([ColorGradeFilter.tsx](src/components/ColorGradeFilter.tsx)) maps the site's
greyscale artwork onto a drifting 3-stop HSL gradient via `feComponentTransfer type="table"` plus a
`feColorMatrix` hue rotation, rewritten every 150 ms. It is **switched off on Firefox by a UA sniff**
([ColorGradeFilter.tsx:134](src/components/ColorGradeFilter.tsx#L134)) and has **never been tested on
Safari** — Safari falls through to the final `return 'on'` and gets the full grade today, unverified.

Goal: the grade running on all three engines in *exactly* the current style. No hue-rotate approximation,
no blend-mode duotone — neither can recolour true black, and neither can hit a 3-stop map.

## What the research found

The framing "Firefox and Safari can't do this" is wrong. `feComponentTransfer` + `feColorMatrix` behind
`filter: url(#id)` are supported in all three engines and always have been. Two separate problems got
collapsed into one:

1. **Firefox is a stale performance verdict.** [Firefox 132](https://bugzilla.mozilla.org/show_bug.cgi?id=1906212)
   (Oct 2024) enabled `gfx.webrender.svg-filter-effects` by default, GPU-accelerating exactly the
   primitives this filter uses. The [intent-to-ship](https://groups.google.com/a/mozilla.org/g/dev-platform/c/-M0HVkCWjx0)
   places the change in `nsDisplayFilters::CreateWebRenderCommands` — the display item for CSS filter
   chains on **HTML** elements, so `filter: url(#…)` on a `<div>` is in scope, not only SVG content.
   Meanwhile [ColorGradeFilter.tsx:20-21](src/components/ColorGradeFilter.tsx#L20-L21) records that
   profiling ran in a sandbox with **"no real GPU available"** — precisely the condition under which
   WebRender falls back to software rasterisation and SVG filters collapse. The 650–870 ms figure may be
   an artifact of the measuring rig.

2. **Safari is a colour-fidelity question, not a perf one.** Per
   [fxtf-drafts#285](https://github.com/w3c/fxtf-drafts/issues/285), Gecko and Blink honour an explicit
   `color-interpolation-filters="sRGB"`; WebKit historically forced linearRGB regardless, which would
   leave the LUT indexed on linearised values and shift every midtone. WebKit changesets from 2022
   suggest this was fixed, but it is unverified on real Safari — hence the probe in Phase 3.

Dead ends, recorded so they aren't re-litigated: CSS custom filters / `filter: shader()` were
[removed from browsers, not shipped late](https://developer.chrome.com/blog/introduction-to-custom-filters-aka-css-shaders);
Houdini's Paint API cannot read backdrop pixels; `-moz-element()` is Firefox-only; CSS `background-image`
cannot reference a `<canvas>`.

## The hard limit on any shader path

The grade is a **non-linear per-channel LUT**, therefore:

> `grade(A over B) ≠ grade(A) over grade(B)`, and `grade(A ⊕ B) ≠ grade(A) ⊕ grade(B)` for every blend
> mode in use on this site.

Anywhere the current look depends on grading a *composite*, grading the parts separately gives a
different picture. That is a correctness argument, not a performance one, and the requirement is
"exactly the current style". [OpeningClouds.scss:93-122](src/components/OpeningClouds.scss#L93-L122) is
already a written proof of this for the clouds: their colour comes from grading the cloud PNG composited
over a masked dark `__backing`, and grading the PNG alone lands it on the table's pale highlight stop.

**Filter order is the other half of this.** An element's own `filter` is applied to *its own* rendering
first; only that result is then composited into the ancestor's group and graded. So for a child with
its own filter the pipeline is `grade(f(A))`, never `f(grade(A))`. Two consequences worth keeping in
mind when classifying elements:

- A per-element `saturate()`/`hue-rotate()` on **neutral grayscale input is a no-op** - it runs before
  the grade, on pixels that have no chroma yet. `OpeningClouds.scss` used to carry `saturate(2.2)` on
  every cloud on the opposite assumption; the perf pass removed it (verified zero chroma in every cloud
  PNG, so the output was byte-identical). Only filters *after* the `url(#…)` token in the same
  `filter` list, as in the popup links' `url(#landscape-color-grade) saturate(0.4)`, actually act on
  graded colour.
- Anything that is *outside* the graded group but visually sits over it (a `backdrop-filter` pane, a
  `mix-blend-mode` sibling) reads graded pixels; anything inside reads ungraded ones. The
  `.opening-clouds__glass` panes work precisely because they are inside the same group *and*
  backdrop-filter samples the group's already-painted backdrop, not the element's own input.

So the work splits into three classes, and a shader only ever owns the second:

- **Class A — flat colour.** The element paints one RGB. `grade()` it in JS, ship a CSS custom property.
  Exact, zero raster cost, needs no filter support in the engine at all — but it still only shows a colour
  where the palette clock is running, so it is not a way to grade a browser that is otherwise `'off'`.
- **Class B — one static image, no painting children, nothing compositing into it.** Shader-able.
- **Class C — everything else.** SVG filter or nothing.

---

## Phase 0 — Measure, before writing any code

This may resolve the entire thing, and it is the highest-value step here. Firefox 155 is installed
locally; Safari goes through BrowserStack.

- `npm run dev`, open in Firefox, temporarily neutralise the sniff (`getColorGradeMode` → `'on'`).
- Measure **both device tiers**: `?perf=high` and `?perf=low` in the URL force
  [deviceTier.ts](src/utils/deviceTier.ts) either way. The low tier drops the nine backdrop-filter
  glass panes and about a third of the opening clouds, which is a large chunk of what the grade's group
  has to re-filter each frame - a Firefox verdict taken only on the high tier would overstate the cost
  for the phones that actually complain.
- `about:support` → confirm **Compositing** reads `WebRender`, not `WebRender (Software)`. If the original
  measurement was taken on software WebRender, that alone explains 650–870 ms.
- `about:config` → confirm `gfx.webrender.svg-filter-effects` is `true`.
- Firefox Profiler: max frame gap scrolling the landscape and the Groove Grove, grade on vs. off. Repeat
  with the pref forced `false` to isolate what the acceleration is carrying and predict older Firefox.
- Same measurement on Safari.

**Put the numbers, the Firefox version and the hardware in the commit message.** The existing comment's
credibility problem is that it states a figure with none of those attached; don't repeat that.

If Firefox is fine, Phases 1–3 still carry their own value, but Phases 5–6 should be dropped.

---

## Phase 1 — One palette clock, one exact `gradePixel`

Foundation for everything else. New `src/components/colorGrade/gradeClock.ts`, extracted from
`ColorGradeFilter.tsx`:

```ts
export interface GradeState { stops: Stop[]; tables: {r:number[];g:number[];b:number[]}; hueDeg: number; }
export function gradePixel(rgb01: [number,number,number], s: GradeState): [number,number,number];
```

`gradePixel` implements the SVG spec exactly: `type="table"` lookup (`k = floor(C·(n−1))`, clamped to
`n−2` at `C = 1`, piecewise-linear between entries), then the real `hueRotate` matrix, then clamp to
[0,1]. All consumers — SVG attributes, CSS custom properties, and later any shader uniforms — read from
this one state object.

**This deletes an existing bug.** `flatGradeColor()`
([ColorGradeFilter.tsx:80-84](src/components/ColorGradeFilter.tsx#L80-L84)) approximates the hue rotation
as an HSL shift and says so in its own comment, so the `--color-grade-flat` tints do not currently match
what the filter produces. One implementation fixes that.

Also replace the `setInterval` at [ColorGradeFilter.tsx:169](src/components/ColorGradeFilter.tsx#L169)
with a `requestAnimationFrame` loop throttled to `TICK_MS`. (Bonus: rAF stops entirely in a background
tab, where `setInterval` is merely throttled to 1 Hz, so a tab left open behind another one stops
recomputing 75 table values and rewriting three SVG attributes every second for nobody. Keep the
`performance.now()`-based phase so the palette lands where it would have when the tab comes back, rather
than resuming from where it paused.) `setInterval` can land mid-frame, letting the
SVG write and (later) a canvas commit paint one frame apart — a visible palette tear between a graded
frame and the graded background behind it. One rAF callback, all writes synchronous, in order:
advance state → write SVG attributes → render canvases → write CSS vars.

Keep the deliberate lag that already exists: `--color-grade-flat` ticks at 8 s and `.groove-vinyl__tint`
eases in over 1 s with a stagger ([GrooveGrove.scss:249-258](src/components/GrooveGrove.scss#L249-L258))
for documented reasons. The invariant is only that the flat colour, *when sampled*, equals what the
filter produces for mid-grey at that instant.

---

## Phase 2 — Class A: take the filter off flat-colour elements entirely

Exact and cheap, but **not** an independent Firefox win — see the caveat below. Its real value is that
it takes the SVG filter off the most fragile surfaces it touches, shrinking what Phases 3-6 have to carry.

> **This does not colour anything on Firefox by itself.** Firefox is `'off'` wholesale today, so
> `ColorGradeFilter` is never mounted ([App.tsx:22](src/App.tsx#L22)) and no custom properties are
> written — the site is deliberately monochrome there. A graded link on an otherwise black-and-white page
> would be the same mistake commit `5b056b3` fixed for the well glow. So every var introduced here must
> carry a fallback equal to today's ungraded input colour (`color: var(--grade-link, rgb(70,70,70))`),
> leaving `'off'` mode byte-identical. These elements only start grading on Firefox once Phase 0/3 turns
> the grade on there.

- **[Landscape.scss:742-746](src/components/Landscape.scss#L742-L746)** — popup anchor text. Today:
  `color: rgb(70,70,70); filter: url(#landscape-color-grade) saturate(0.4)`. The input is a flat grey and
  the output is a flat colour, so it is exactly reproducible as
  `color: var(--grade-link)` with `--grade-link = saturate(0.4) ∘ gradePixel([70,70,70]/255)`.
  The `&::after` underline uses `background: currentColor`, so it follows for free. Dark-mode
  `rgb(205,205,205)` and hover `rgb(240,240,240)` ([Landscape.scss:430-434](src/components/Landscape.scss#L430-L434))
  each need their own var. **This removes a filter from live text glyphs** — the single riskiest and most
  expensive filter on the page — and means these links keep working in any future mode that has a palette
  but no usable SVG filter.
- **[GrooveGrove.scss:693-701](src/components/GrooveGrove.scss#L693-L701)** — `.groove-embed__tint` is
  `background: #808080; filter: url(…)`. Same situation; becomes `background: var(--color-grade-flat)`.
  The cross-origin iframe underneath is unaffected either way — `mix-blend-mode: color` doesn't care how
  the tint got its colour.

---

## Phase 3 — Replace the UA sniff with measured evidence

The sniff is the actual bug: it hard-codes one measurement from an unknown Firefox on unknown hardware
into a permanent rule. Replace with three runtime signals.

### 3a. Capability + colour-space probe

New `src/utils/colorGradeProbe.ts`. Render a known greyscale ramp through a *self-contained copy* of the
filter inside an SVG `data:` URL loaded into an `<img>`, `drawImage` to a 2D canvas, `getImageData` back.
`data:` URLs do not taint the canvas, so readback is legal.

- Ramp unchanged ⇒ engine ignored the filter ⇒ `'off'`.
- Compare returned midtones against both an sRGB- and a linearRGB-interpolated prediction to determine
  which space the engine used.

Note in the code comment that this measures SVG-in-`<img>`, not CSS `filter: url()` on an HTML element —
there is no API to read back the latter. Strong evidence, not proof.

### 3b. Pre-warp the table for linearRGB engines

If 3a reports linearRGB, don't disable anything — compensate, so Safari renders the same picture. The
engine computes `out = lin2srgb(LUT(srgb2lin(c)))`; to make that equal the intended `LUT_target(c)`,
build the shipped table by sampling in linear space: for entry `i`, `x = i/(n−1)`,
`value = srgb2lin(LUT_target(lin2srgb(x)))`. Raise `GRADE_STEPS` from 25 to 64 for the warped table —
resampling through the sRGB curve crowds the shadows and 25 entries will band there. The unwarped path
stays byte-identical for Chrome and Firefox.

### 3c. Frame-budget watchdog instead of a browser list

Start in the full grade; sample frame gaps via rAF for the first ~6 s (covering the opening cloud
animation, the heaviest moment on the page). If the 95th-percentile gap exceeds a threshold, downgrade
and **persist the verdict in a cookie** — `react-cookie` is already a dependency
([App.tsx:3](src/App.tsx#L3)) — so the next load starts in the right mode rather than re-janking.

This is what actually answers the question: it adapts to weak GPUs on *any* engine and stops punishing
every Firefox user for one bad measurement. Keep `prefers-reduced-motion` as a hard `'off'`.

There is now a static device-tier heuristic in [deviceTier.ts](src/utils/deviceTier.ts) (reduced-motion,
mobile UA, ≤4 cores, ≤4 GB) that the cloud layers already consume to thin decoration. The watchdog's
verdict should **feed that same tier** rather than becoming a second, separate notion of "this device is
slow" - one flag, consumed by both the grade mode and the cloud/glass density, persisted in the same
cookie. Otherwise a device can end up graded at full strength while its clouds are thinned, or vice
versa, and the two knobs drift apart over time.

### 3d. Widen the mode type

`getColorGradeMode()` returns `'on' | 'off'`, consumed at [App.tsx:15](src/App.tsx#L15). Widen to
`'full' | 'raster' | 'off'` with a body class per mode. The existing `.color-grade-off` rules
([Landscape.scss:1348-1363](src/components/Landscape.scss#L1348-L1363)) stay as last resort.

---

## Phase 4 — Cut the remaining SVG filter's cost

- **Shrink the surfaces.** `.color-grade-background` is `position: fixed; inset: 0`
  ([App.scss:86-95](src/App.scss#L86-L95)) and `.color-grade-layer` wraps the whole landscape; both
  re-rasterise every tick. Add `will-change: filter` to pin them as their own layers.
- **Slow the tick.** `TICK_MS = 150` invalidates every referencing element 6.7×/s while the hue moves
  1.08°/tick. At 250–300 ms the step is 1.8–2.2° — against a 16 s blend, nobody will see it. Pick the
  largest value that still looks smooth on the big flat sky areas during Phase 0.

  **Know what the tick does and doesn't buy, though.** The tick only matters for groups whose
  *contents* are otherwise static between ticks (`.color-grade-background`, an open popup's parchment,
  the Groove Grove treeline). The three biggest graded groups are never static: `.ServiceBubbles` and
  `.opening-clouds-behind` contain ~40 clouds that drift and breathe on CSS keyframes, and
  `.color-grade-layer` contains the sunrays rotating on a 120 s loop, the shine pulsing on a 20 s loop,
  the animated-WebP objects and the creatures. Any change inside a filtered group re-runs the filter
  over the group, so those three are re-graded **every frame their contents move, regardless of
  `TICK_MS`**. Slowing the tick helps the static groups and the CPU cost of the JS writes; it does
  nothing for the per-frame GPU cost of the big three. The levers for those are group *area* and
  *content* (fewer/smaller animating things inside - which is what the device tier does), or taking the
  always-animating content out of the graded group and grading it some other way (Class A/B), not the
  tick rate. Measure the three separately in Phase 0 rather than one aggregate number, or a tick-rate
  win on the background will hide a no-op on the hero.
- **Optional, measure first: fold the hue rotation into the table**, dropping `feColorMatrix` and halving
  the filter graph. `hueRotate`'s rows each sum to 1, so applying it in JS to the 25 stop colours before
  building the tables is *exactly* equivalent **for greyscale input**. It is **not** equivalent for
  non-neutral input, because the real pipeline mixes channels after a per-channel lookup. Verify against
  the art gallery, the parchment texture and Memories photos before keeping it; if anything shifts, drop
  this lever and take the win from the two above.

---

## Phase 5 — WebGL renderer core, and the one target worth it

Gate: build this only if Phase 0 + Phase 4 leave a real engine/hardware combination still failing.

### Architecture

One shared **WebGL2 context on an `OffscreenCanvas`**, `transferToImageBitmap()` →
per-element `<canvas getContext('bitmaprenderer')>`. `transferFromImageBitmap` is a pointer swap, not a
copy. Support: `OffscreenCanvas` Safari 16.4+, `ImageBitmapRenderingContext` Safari 15+.

Rejected, with reasons: per-element WebGL contexts (Chrome caps ~16 live contexts, we'd need 20–40);
texture atlas + `background-position` (CSS can't reference a canvas; blob re-encode is 20–60 ms/tick);
shared GL + per-element 2D `drawImage` — keep as a runtime fallback only, since Safari has historically
de-accelerated 2D canvases under memory pressure with no signal.

**Counter-evidence to weigh during Phase 0:** `transferToImageBitmap`
[incurs a full pixel readback on Firefox and Safari](https://bugzilla.mozilla.org/show_bug.cgi?id=1788206)
where Chrome keeps it on-GPU — i.e. the cheap path is cheap on the browser that didn't need fixing.
Benchmark the handoff on Firefox before committing to Phase 6.

Files: `src/components/colorGrade/gradeRenderer.ts` (context, program, uniforms, OffscreenCanvas pool
keyed by output size, registry, `webglcontextlost`/`restored` → fall back to SVG filter,
`import.meta.hot?.dispose` so Vite HMR doesn't leak contexts) and
`src/components/colorGrade/GradedCanvas.tsx` (ResizeObserver on `devicePixelContentBoxSize`, DPR
listener, un-graded `<img>` shown until the texture is live).

### Shader

Must reproduce `feComponentTransfer type="table"` exactly: **three independent per-channel 1D lookups**,
not a luminance gradient map. Use a 25-entry `vec3` uniform array, not a LUT texture — a texture would
quantise to 8 bits and drag in texel-centre subtleties.

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

### The one target worth building

**`.color-grade-background`** ([App.tsx:23](src/App.tsx#L23)). Largest graded area on the page, an empty
`aria-hidden` div with no children and nothing compositing into it. A fixed-viewport canvas at 1920×1080
is ~14 Mpx/s. If only one canvas target is ever built, build this one. Re-measure after.

---

## Phase 6 — The remaining Class B set, only if Phase 5 measured well

`FrameOverlay` and `Plaque` in [ArtGallery.tsx](src/components/ArtGallery.tsx) (6 frame PNGs, 6 plaque
PNGs) and `.groove-trees__img`.

`frameFilter()` ([ArtGallery.tsx:231-233](src/components/ArtGallery.tsx#L231-L233)) keeps working with
one change: drop the `url(#…)` token and keep the rest of the chain. The grade moves *inside* the
element, and the remaining CSS filter list applies to the element's output — the same order as today. All
27 `FRAME_ASSIGNMENTS` presets stay untouched, and `mixBlendMode: 'exclude'` stays on the element.

Required guards: `IntersectionObserver` so only on-screen tiles register (27 tiles exist, far fewer are
visible); cap grade-canvas DPR at 2 or below. Without these, ~30 double-buffered 800×800 output surfaces
is **~154 MB**, against an iOS Safari per-page canvas backing-store cap of roughly 224 MB — over it,
canvases silently go blank, on one of the two browsers this whole project is for.

`.groove-trees__img` needs its `<picture>` `media="(min-aspect-ratio: 8/5)"` source selection
re-implemented in JS and `object-fit: cover` moved into the shader UVs. Leave a cross-reference comment
at [GrooveGrove.scss:374](src/components/GrooveGrove.scss#L374) — if the two copies drift, the wrong
treeline art renders at the wrong crop and the layout still looks fine, so nobody notices.

---

## Explicitly not attempted

- **`.color-grade-layer`** and **`.ServiceBubbles` / `.opening-clouds-behind`** — Class C. They grade
  composites of blend-moded, animating, interactive subtrees. Stay on the SVG filter.
- **The four `::before` parchment/button textures** ([Landscape.scss:400](src/components/Landscape.scss#L400),
  [:583](src/components/Landscape.scss#L583), [GrooveGrove.scss:500](src/components/GrooveGrove.scss#L500),
  [:785](src/components/GrooveGrove.scss#L785)) — a pseudo-element can't host a canvas, and promoting each
  to a real child reworks stacking, `border-radius: inherit` and `overflow` clipping for four small
  elements that are on screen one or two at a time. Not worth the regression risk.

---

## Verification

1. **Firefox locally** — Firefox Profiler max frame gap, landscape + Groove Grove, grade on vs. off,
   `gfx.webrender.svg-filter-effects` true vs. false. Numbers, version and hardware in the commit message.
2. **Safari via BrowserStack** — first-ever check. Confirm it renders; screenshot landscape and art
   gallery against the same palette moment in Chrome. Confirm whether 3a's linearRGB detection fires and
   whether 3b's pre-warp makes the two match.
3. **Chrome regression check** — Phases 1, 2 and 4 change rendered output for *everyone*. Compare
   landscape, art gallery (all 27 presets), Groove Grove vinyl tints, popup parchment, and graded link
   text before/after.
4. **Exactness test** — a node test running a 256-step ramp through `gradePixel` and through a CPU
   transcription of the GLSL, asserting max Δ ≤ 1/255. This is what makes "exactly the current style"
   checkable rather than eyeballed.
5. **Fallback intact** — force `'off'`, confirm the well glow and popup link underline
   ([Landscape.scss:1348-1363](src/components/Landscape.scss#L1348-L1363)) still read correctly.
6. `npm run build` (runs `tsc --noEmit`).
7. **Lighthouse, both form factors**, against `vite preview` — the perf branch added the recipe (see the
   PR for `perf/lighter-site`): `CHROME_PATH=… npx lighthouse http://localhost:4173/ --preset=desktop
   --only-categories=performance` and the same without the preset for mobile. Watch the
   `non-composited-animations` audit specifically: anything the grade work adds that animates `filter`
   with a `url()` in it will show up there, and that's the single cheapest early warning that a change
   just moved a per-frame cost onto the main thread.
