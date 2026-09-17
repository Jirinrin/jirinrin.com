import { useEffect, useState } from 'react';
import {
  expectedRamp,
  probeSvgDataUrl,
  runColorGradeProbe,
  type ProbeResult,
} from '../../utils/colorGradeProbe';

// A throwaway diagnostic panel, mounted only for `?gradeprobe=1`. It exists
// because the interesting browsers are the ones that are hardest to attach a
// profiler or an inspector to - an iPad, a borrowed phone - and "does the
// colour grade work here" needs an answer you can get by looking at a screen.
//
// The three rows are the whole point, and they are in this order deliberately:
//
//   1. CSS filter on real HTML elements. This is the path the site actually
//      uses, and the path no API can read back. Compare it against row 3 by
//      eye: matching means the technique works here, matching row 2's
//      "untouched" strip instead means the engine dropped the filter.
//   2. The same filter applied to SVG content inside an <img>. This is what
//      colorGradeProbe.ts can measure numerically - a different code path.
//   3. What the filter is supposed to produce, computed in JS by the same
//      gradeClock code that drives the real thing.
//
// If row 1 and row 2 disagree, the numeric verdict above them is measuring
// something the site does not do, and must not be wired into
// getColorGradeMode(). That disagreement is the single most valuable thing
// this panel can tell you.

const PROBE_FILTER_ID = 'grade-probe-inline';

const swatch: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'inline-block',
  verticalAlign: 'top',
};

const label: React.CSSProperties = {
  margin: '10px 0 3px',
  fontSize: 11,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  opacity: 0.65,
};

function GradeProbeOverlay() {
  const [result, setResult] = useState<ProbeResult | null>(null);
  const expected = expectedRamp();

  useEffect(() => {
    let live = true;
    runColorGradeProbe().then(r => { if (live) setResult(r); });
    return () => { live = false; };
  }, []);

  const verdict = !result
    ? 'measuring...'
    : result.error
      ? `error: ${result.error}`
      : result.supported
        ? `FILTER APPLIED - interpolation space: ${result.space}`
        : 'FILTER IGNORED - the ramp came back untouched';

  return (
    <div
      style={{
        position: 'fixed',
        inset: '8px 8px auto 8px',
        zIndex: 99999,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '12px 14px',
        borderRadius: 8,
        background: 'rgba(12, 12, 16, 0.94)',
        color: '#eee',
        font: '13px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
        WebkitTextSizeAdjust: '100%',
      }}
    >
      {/* The probe filter, inlined so row 1 below can reference it from CSS.
          Same primitives and same values as the copy inside the data: URL. */}
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
        </defs>
      </svg>

      <div style={{ fontWeight: 700, marginBottom: 2 }}>colour grade probe</div>
      <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 8, wordBreak: 'break-all' }}>
        {navigator.userAgent}
      </div>

      <div
        style={{
          padding: '6px 8px',
          borderRadius: 4,
          background: result?.supported ? 'rgba(40, 140, 70, 0.3)' : 'rgba(150, 50, 50, 0.3)',
        }}
      >
        {verdict}
      </div>

      {result && !result.error && (
        <div style={{ fontSize: 11, opacity: 0.75, marginTop: 6 }}>
          max delta vs sRGB prediction: <b>{result.maxDeltaSRGB}</b>/255 &middot;{' '}
          vs linearRGB prediction: <b>{result.maxDeltaLinear}</b>/255 &middot;{' '}
          vs untouched input: <b>{result.maxDeltaFromInput}</b>/255
        </div>
      )}

      <div style={label}>1. css filter on html elements &mdash; what the site uses</div>
      <div style={{ filter: `url(#${PROBE_FILTER_ID})` }}>
        {expected.map(e => (
          <span key={e.input} style={{ ...swatch, background: `rgb(${e.input}, ${e.input}, ${e.input})` }} />
        ))}
      </div>

      <div style={label}>2. svg filter inside an &lt;img&gt; &mdash; what the probe measured</div>
      <img
        src={probeSvgDataUrl()}
        alt="probe ramp"
        style={{ height: 30, width: 30 * expected.length, imageRendering: 'pixelated', display: 'block' }}
      />

      <div style={label}>3. expected result, computed in js (srgb)</div>
      <div>
        {expected.map(e => <span key={e.input} style={{ ...swatch, background: e.sRGB }} />)}
      </div>

      <div style={label}>untouched input ramp, for reference</div>
      <div>
        {expected.map(e => (
          <span key={e.input} style={{ ...swatch, background: `rgb(${e.input}, ${e.input}, ${e.input})` }} />
        ))}
      </div>

      <div style={label}>if the engine were using linearrgb instead</div>
      <div>
        {expected.map(e => <span key={e.input} style={{ ...swatch, background: e.linear }} />)}
      </div>

      <div style={{ ...label, textTransform: 'none', opacity: 0.5, fontSize: 10, marginTop: 12 }}>
        row 1 matching row 3 = the technique works here. row 1 matching the untouched ramp = it does not,
        whatever row 2 says. add ?grade=on to the url to force the real grade on regardless of the sniff.
      </div>
    </div>
  );
}

export default GradeProbeOverlay;
