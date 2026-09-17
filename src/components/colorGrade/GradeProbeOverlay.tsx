import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  expectedRamp,
  probeSvgDataUrl,
  runColorGradeProbe,
  type ProbeResult,
} from '../../utils/colorGradeProbe';
import { COLOR_GRADE_FILTER_ID } from '../ColorGradeFilter';

// A throwaway diagnostic panel, mounted only for `?gradeprobe=1`. It exists
// because the interesting browsers are the ones that are hardest to attach a
// profiler or an inspector to - an iPad, a borrowed phone - and "does the
// colour grade work here" needs an answer you can get by looking at a screen.
//
// The first version of this answered "can this engine run an SVG filter at
// all", and on iPad Safari (2026-09-18) the answer came back yes: a CSS
// `filter: url(#...)` on a real HTML element produced the spec's exact output,
// in sRGB. But the real page is still grey there. So the question has moved on
// from "can it" to "which of the things the real page does differently is the
// one that breaks", and the rows below are a bisect of exactly that.
//
// Every row feeds the same grey ramp through the same known-good filter
// definition, so any row that does not match EXPECTED has found the culprit.
// Read it as: the first row that differs from EXPECTED names the problem.

const PROBE_FILTER_ID = 'grade-probe-inline';
const LIVE_FILTER_ID = 'grade-probe-live';

// Two deliberately unmistakable tables. If the LIVE row alternates between
// them, this engine repaints filter-referencing elements when the filter's own
// attributes are rewritten - which is what the real grade does every tick, and
// what no static swatch can test.
const LIVE_TABLES = [
  { r: '0.1 0.9 0.2', g: '0.8 0.1 0.7', b: '0.3 0.6 0.95' },
  { r: '0.9 0.1 0.8', g: '0.2 0.7 0.1', b: '0.7 0.2 0.35' },
];

const SW = 22;

// The sizes to try, in CSS pixels of height at full width. iOS Safari drops a
// filter on a composited layer past some undocumented size, and does it
// silently - no console warning, no fallback, the element simply renders
// unfiltered. Finding roughly where that happens on the actual device is the
// whole point of this ladder, because .color-grade-layer is far larger than
// anything the earlier version of this panel tested (it used a 46px strip and
// called it "large", which proved nothing).
const SIZE_LADDER = [500, 1200, 2500, 5000];

// Each rung is clipped to a thin window so the panel stays readable - the
// filtered element underneath is still its full stated height, which is what
// the engine is being asked about.
const CLIP_H = 34;

function measure(selector: string): string {
  const el = document.querySelector(selector);
  if (!el) return 'not in DOM';
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const filter = cs.filter && cs.filter !== 'none' ? 'filter:yes' : 'filter:NONE';
  const wc = cs.willChange && cs.willChange !== 'auto' ? `wc:${cs.willChange}` : 'wc:-';
  return `${Math.round(r.width)}x${Math.round(r.height)} ${filter} ${wc}`;
}

// Every row of this panel renders inside the panel, which is a fixed element
// near the root. The real graded elements sit deep inside the landscape. Since
// the panel says the filter works and the page says it does not, the
// difference is somewhere in that ancestry - so list every ancestor that does
// something a filter cares about: its own filter (nested filtering), a
// transform or opacity (both force a separate rasterization), a blend mode, or
// backdrop-filter.
function ancestry(selector: string): string[] {
  const start = document.querySelector(selector);
  if (!start) return [`${selector}: not in DOM`];
  const out: string[] = [];
  let el: Element | null = start.parentElement;
  while (el && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    const notes: string[] = [];
    if (cs.filter && cs.filter !== 'none') notes.push(`filter:${cs.filter.slice(0, 28)}`);
    if (cs.transform && cs.transform !== 'none') notes.push(`transform:${cs.transform.slice(0, 28)}`);
    if (cs.opacity && cs.opacity !== '1') notes.push(`opacity:${cs.opacity}`);
    if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') notes.push(`blend:${cs.mixBlendMode}`);
    if (cs.backdropFilter && cs.backdropFilter !== 'none') notes.push('backdrop-filter');
    if (cs.isolation && cs.isolation !== 'auto') notes.push(`isolation:${cs.isolation}`);
    if (notes.length) {
      const name = el.id ? `#${el.id}` : `.${(el.className || '').toString().split(' ')[0] || el.tagName}`;
      out.push(`${name} ${notes.join(' ')}`);
    }
    el = el.parentElement;
  }
  return out.length ? out : ['(no ancestor does anything unusual)'];
}

const swatch: React.CSSProperties = {
  width: SW,
  height: SW,
  display: 'inline-block',
  verticalAlign: 'top',
};

const rowLabel: React.CSSProperties = {
  margin: '9px 0 2px',
  fontSize: 10.5,
  letterSpacing: '0.03em',
  opacity: 0.8,
};

function GradeProbeOverlay() {
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [liveFlip, setLiveFlip] = useState(0);
  const [flat, setFlat] = useState('(unset)');
  const liveRef = useRef<SVGFilterElement>(null);
  const expected = expectedRamp();

  useEffect(() => {
    let live = true;
    runColorGradeProbe().then(r => { if (live) setResult(r); });
    return () => { live = false; };
  }, []);

  // Rewrite the live filter's tableValues the same way ColorGradeFilter does -
  // setAttribute on the feFunc elements, not a React re-render - so this tests
  // the engine's invalidation behaviour rather than React's.
  useEffect(() => {
    let flip = 0;
    const id = window.setInterval(() => {
      flip = (flip + 1) % 2;
      const t = LIVE_TABLES[flip];
      const filter = liveRef.current;
      if (filter) {
        filter.querySelector('feFuncR')?.setAttribute('tableValues', t.r);
        filter.querySelector('feFuncG')?.setAttribute('tableValues', t.g);
        filter.querySelector('feFuncB')?.setAttribute('tableValues', t.b);
      }
      setLiveFlip(flip);
      setFlat(
        getComputedStyle(document.documentElement).getPropertyValue('--color-grade-flat').trim() || '(unset)',
      );
    }, 700);
    return () => window.clearInterval(id);
  }, []);

  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [anc, setAnc] = useState<string[]>([]);

  // The panel grew to fill the screen, which hides the two probes that are
  // drawn on the page itself - so it has to be possible to get it out of the
  // way. Collapsing clips it to its header rather than unmounting it, because
  // the rows have to keep rendering: L and M reference the same filter, and
  // the point is to look at the page with the panel still live.
  const [open, setOpen] = useState(true);

  // Portal targets, resolved after mount because the landscape renders after
  // this panel does.
  const [hosts, setHosts] = useState<{ outer: Element | null; inner: Element | null }>({
    outer: null,
    inner: null,
  });
  useEffect(() => {
    const id = window.setTimeout(() => setHosts({
      outer: document.querySelector('#Landscape-container'),
      inner: document.querySelector('.color-grade-layer'),
    }), 400);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    const read = () => setSizes({
      '.color-grade-layer': measure('.color-grade-layer'),
      '.color-grade-background': measure('.color-grade-background'),
      '.ServiceBubbles': measure('.ServiceBubbles'),
      '#Landscape-container': measure('#Landscape-container'),
    });
    setAnc(ancestry('.color-grade-layer'));
    read();
    const id = window.setInterval(read, 1500);
    return () => window.clearInterval(id);
  }, []);

  const siteFilterMounted = typeof document !== 'undefined'
    && !!document.getElementById(COLOR_GRADE_FILTER_ID);
  const reduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const Ramp = ({ style }: { style?: React.CSSProperties }) => (
    <div style={style}>
      {expected.map(e => (
        <span key={e.input} style={{ ...swatch, background: `rgb(${e.input}, ${e.input}, ${e.input})` }} />
      ))}
    </div>
  );

  const verdict = !result
    ? 'measuring...'
    : result.error
      ? `error: ${result.error}`
      : result.supported
        ? `FILTER APPLIED - space: ${result.space}`
        : 'FILTER IGNORED - ramp came back untouched';

  return (
    <div
      style={{
        position: 'fixed',
        inset: '6px 6px auto 6px',
        zIndex: 99999,
        maxHeight: open ? '70vh' : 30,
        overflowY: 'auto',
        padding: '10px 12px',
        borderRadius: 8,
        background: 'rgba(10, 10, 14, 0.96)',
        color: '#eee',
        font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
        WebkitTextSizeAdjust: '100%',
      }}
    >
      <svg aria-hidden focusable="false" style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id={PROBE_FILTER_ID} colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="table" tableValues="0.1 0.9 0.2" />
              <feFuncG type="table" tableValues="0.8 0.1 0.7" />
              <feFuncB type="table" tableValues="0.3 0.6 0.95" />
            </feComponentTransfer>
            <feColorMatrix type="hueRotate" values="90" />
          </filter>
          <filter id={LIVE_FILTER_ID} ref={liveRef} colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="table" tableValues={LIVE_TABLES[0].r} />
              <feFuncG type="table" tableValues={LIVE_TABLES[0].g} />
              <feFuncB type="table" tableValues={LIVE_TABLES[0].b} />
            </feComponentTransfer>
            <feColorMatrix type="hueRotate" values="90" />
          </filter>
        </defs>
      </svg>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 700, flex: '1 1 auto' }}>colour grade bisect</span>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            font: 'inherit',
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 5,
            border: '1px solid #666',
            background: '#222',
            color: '#eee',
          }}
        >
          {open ? 'hide' : 'show'}
        </button>
      </div>
      <div style={{ fontSize: 10, opacity: 0.55, margin: '2px 0 6px', wordBreak: 'break-all' }}>
        {navigator.userAgent}
      </div>
      <div style={{ fontSize: 10.5, opacity: 0.8, marginBottom: 6 }}>
        reduced-motion: <b>{reduced ? 'YES' : 'no'}</b> &middot; dpr: <b>{window.devicePixelRatio}</b> &middot;{' '}
        viewport: <b>{window.innerWidth}x{window.innerHeight}</b><br />
        site filter mounted: <b>{siteFilterMounted ? 'yes' : 'NO (add ?grade=on)'}</b> &middot;{' '}
        --color-grade-flat: <b>{flat}</b>
      </div>

      {/* The actual graded elements, measured on this device. If one of these
          is far larger than the first size in the ladder below that fails,
          that is the answer. */}
      <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 6, lineHeight: 1.5 }}>
        <div>.color-grade-layer &nbsp; <b>{sizes['.color-grade-layer']}</b></div>
        <div>.color-grade-background &nbsp; <b>{sizes['.color-grade-background']}</b></div>
        <div>.ServiceBubbles &nbsp; <b>{sizes['.ServiceBubbles']}</b></div>
        <div>#Landscape-container &nbsp; <b>{sizes['#Landscape-container']}</b></div>
      </div>

      <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 6, lineHeight: 1.5 }}>
        <div style={{ opacity: 0.6 }}>ancestors of .color-grade-layer that affect filtering:</div>
        {anc.map(a => <div key={a}>&nbsp;&nbsp;{a}</div>)}
      </div>

      <div
        style={{
          padding: '5px 7px',
          borderRadius: 4,
          fontSize: 11,
          background: result?.supported ? 'rgba(40, 140, 70, 0.3)' : 'rgba(150, 50, 50, 0.3)',
        }}
      >
        {verdict}
      </div>

      <div style={{ ...rowLabel, opacity: 1, fontWeight: 700, marginTop: 12 }}>
        EXPECTED &mdash; every row below should look like this
      </div>
      <div>{expected.map(e => <span key={e.input} style={{ ...swatch, background: e.sRGB }} />)}</div>

      <div style={rowLabel}>A. url() alone &mdash; known to work here</div>
      <Ramp style={{ filter: `url(#${PROBE_FILTER_ID})` }} />

      <div style={rowLabel}>B. url() + saturate(1) &mdash; the site&rsquo;s actual chain shape</div>
      <Ramp style={{ filter: `url(#${PROBE_FILTER_ID}) saturate(1)` }} />

      <div style={rowLabel}>C. url() + will-change: filter &mdash; added in the phase 4 pass</div>
      <Ramp style={{ filter: `url(#${PROBE_FILTER_ID})`, willChange: 'filter' }} />

      <div style={rowLabel}>
        D. url() on progressively larger layers &mdash; ios filtered-layer limits.
        the first height that goes grey is the ceiling.
      </div>
      {SIZE_LADDER.map(h => (
        <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 10, opacity: 0.6, width: 52, flex: '0 0 auto' }}>{h}px</span>
          <div style={{ height: CLIP_H, overflow: 'hidden', flex: '1 1 auto' }}>
            <div style={{ filter: `url(#${PROBE_FILTER_ID}) saturate(1)`, width: '100%', height: h }}>
              {expected.map(e => (
                <span
                  key={e.input}
                  style={{ ...swatch, height: CLIP_H, background: `rgb(${e.input},${e.input},${e.input})` }}
                />
              ))}
            </div>
          </div>
        </div>
      ))}

      <div style={rowLabel}>
        D2. same, but with will-change: filter &mdash; what .color-grade-layer now carries
      </div>
      {SIZE_LADDER.map(h => (
        <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 10, opacity: 0.6, width: 52, flex: '0 0 auto' }}>{h}px</span>
          <div style={{ height: CLIP_H, overflow: 'hidden', flex: '1 1 auto' }}>
            <div
              style={{
                filter: `url(#${PROBE_FILTER_ID}) saturate(1)`,
                willChange: 'filter',
                width: '100%',
                height: h,
              }}
            >
              {expected.map(e => (
                <span
                  key={e.input}
                  style={{ ...swatch, height: CLIP_H, background: `rgb(${e.input},${e.input},${e.input})` }}
                />
              ))}
            </div>
          </div>
        </div>
      ))}

      <div style={rowLabel}>
        E. live setAttribute rewrite &mdash; must ALTERNATE (now showing table {liveFlip + 1}/2)
      </div>
      <Ramp style={{ filter: `url(#${LIVE_FILTER_ID})` }} />

      <div style={rowLabel}>
        F. the site&rsquo;s own live filter {siteFilterMounted ? '' : '(not mounted - add ?grade=on)'}
      </div>
      <Ramp style={{ filter: siteFilterMounted ? `url(#${COLOR_GRADE_FILTER_ID}) saturate(1)` : 'none' }} />

      <div style={rowLabel}>G. svg filter inside an &lt;img&gt; &mdash; what the numeric probe measured</div>
      <img
        src={probeSvgDataUrl()}
        alt="probe ramp"
        style={{ height: SW, width: SW * expected.length, imageRendering: 'pixelated', display: 'block' }}
      />

      {/* Everything above this point passes on iPad, including a 5000px tall
          layer - so size is not the answer. What every row above still lacks
          is what .color-grade actually carries besides the filter itself. */}

      <div style={rowLabel}>
        H. url() + saturate(1) + <b>transition: filter 0.6s ease</b> &mdash; what .color-grade carries.
        a url() filter is not interpolable, so the list has to fall back to discrete.
      </div>
      <Ramp
        style={{
          filter: siteFilterMounted ? `url(#${COLOR_GRADE_FILTER_ID}) saturate(1)` : 'none',
          transition: 'filter 0.6s ease',
        }}
      />

      <div style={rowLabel}>
        I. H + will-change: filter &mdash; the exact property set on .color-grade-layer
      </div>
      <Ramp
        style={{
          filter: siteFilterMounted ? `url(#${COLOR_GRADE_FILTER_ID}) saturate(1)` : 'none',
          transition: 'filter 0.6s ease',
          willChange: 'filter',
        }}
      />

      <div style={rowLabel}>
        J. I + a moving child &mdash; a filtered group whose contents never stop changing,
        which is the one thing a static swatch can never reproduce
      </div>
      <div
        style={{
          filter: siteFilterMounted ? `url(#${COLOR_GRADE_FILTER_ID}) saturate(1)` : 'none',
          transition: 'filter 0.6s ease',
          willChange: 'filter',
          position: 'relative',
          height: SW,
          overflow: 'hidden',
        }}
      >
        {expected.map(e => (
          <span key={e.input} style={{ ...swatch, background: `rgb(${e.input},${e.input},${e.input})` }} />
        ))}
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 18,
            height: SW,
            background: '#fff',
            animation: 'gradeprobe-sweep 1.6s linear infinite',
          }}
        />
      </div>
      <style>{'@keyframes gradeprobe-sweep { from { transform: translateX(0) } to { transform: translateX(180px) } }'}</style>

      <div style={rowLabel}>
        K. position: fixed + filter &mdash; the .color-grade-background shape (pinned bottom-left,
        below this panel)
      </div>
      <div
        style={{
          position: 'fixed',
          left: 6,
          bottom: 6,
          zIndex: 99998,
          filter: siteFilterMounted ? `url(#${COLOR_GRADE_FILTER_ID}) saturate(1)` : 'none',
          transition: 'filter 0.6s ease',
          willChange: 'filter',
        }}
      >
        {expected.map(e => (
          <span key={e.input} style={{ ...swatch, background: `rgb(${e.input},${e.input},${e.input})` }} />
        ))}
      </div>

      {/* The panel is a fixed element near the root; the graded elements are
          deep inside the landscape. These two put the same ramp INSIDE that
          subtree, which is the one thing no row above does. */}
      <div style={rowLabel}>
        L &amp; M are drawn on top of the landscape itself, not in this panel &mdash; tap
        &ldquo;hide&rdquo; above, scroll to the TOP of the page, and look at the top-left. L is a ramp carrying the site filter itself; M is a
        ramp carrying NO filter of its own, sitting inside .color-grade-layer, so the layer&rsquo;s
        own grade should colour it.
      </div>

      {hosts.outer && createPortal(
        <div
          style={{
            position: 'absolute',
            top: 44,
            left: 4,
            zIndex: 9999,
            filter: siteFilterMounted ? `url(#${COLOR_GRADE_FILTER_ID}) saturate(1)` : 'none',
          }}
        >
          <div style={{ font: '9px monospace', color: '#fff', background: '#000' }}>L in-landscape</div>
          {expected.map(e => (
            <span key={e.input} style={{ ...swatch, background: `rgb(${e.input},${e.input},${e.input})` }} />
          ))}
        </div>,
        hosts.outer,
      )}

      {hosts.inner && createPortal(
        <div style={{ position: 'absolute', top: 100, left: 4, zIndex: 9999 }}>
          <div style={{ font: '9px monospace', color: '#fff', background: '#000' }}>M inside layer</div>
          {expected.map(e => (
            <span key={e.input} style={{ ...swatch, background: `rgb(${e.input},${e.input},${e.input})` }} />
          ))}
        </div>,
        hosts.inner,
      )}

      {/* N is M with one property added: a running transform animation, which
          promotes it to its own compositor layer. Same parent, same lack of a
          filter of its own, same reliance on the ancestor's grade. If N is
          grey while M is coloured, a promoted layer is escaping the group's
          filter - which is exactly what the animating art does and the static
          probe does not. */}
      {hosts.inner && createPortal(
        <div
          style={{
            position: 'absolute',
            top: 156,
            left: 4,
            zIndex: 9999,
            animation: 'gradeprobe-drift 3s ease-in-out infinite alternate',
          }}
        >
          <div style={{ font: '9px monospace', color: '#fff', background: '#000' }}>N animated in layer</div>
          {expected.map(e => (
            <span key={e.input} style={{ ...swatch, background: `rgb(${e.input},${e.input},${e.input})` }} />
          ))}
        </div>,
        hosts.inner,
      )}
      <style>
        {'@keyframes gradeprobe-drift { from { transform: translateX(0) } to { transform: translateX(40px) } }'}
      </style>

      <div style={rowLabel}>untouched input ramp, for reference</div>
      <Ramp />

      <div style={{ ...rowLabel, opacity: 0.5, fontSize: 10, marginTop: 10 }}>
        the first row that does NOT match EXPECTED names the problem. rows F and H&ndash;K use whatever
        palette the site is currently on, so they will not match EXPECTED &mdash; for those the only
        question is whether they are COLOURED (working) or GREY (broken).
      </div>
    </div>
  );
}

export default GradeProbeOverlay;
