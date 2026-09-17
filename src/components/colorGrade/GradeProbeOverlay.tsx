import { useEffect, useRef, useState } from 'react';
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
  useEffect(() => {
    const read = () => setSizes({
      '.color-grade-layer': measure('.color-grade-layer'),
      '.color-grade-background': measure('.color-grade-background'),
      '.ServiceBubbles': measure('.ServiceBubbles'),
      '#Landscape-container': measure('#Landscape-container'),
    });
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
        maxHeight: '94vh',
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

      <div style={{ fontWeight: 700 }}>colour grade bisect</div>
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

      <div style={rowLabel}>untouched input ramp, for reference</div>
      <Ramp />

      <div style={{ ...rowLabel, opacity: 0.5, fontSize: 10, marginTop: 10 }}>
        the first row that does NOT match EXPECTED names the problem. row F uses whatever palette the site
        is currently on, so it will not match EXPECTED &mdash; for F the question is only whether it is
        COLOURED (working) or GREY (broken).
      </div>
    </div>
  );
}

export default GradeProbeOverlay;
