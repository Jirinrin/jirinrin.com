import React, { useEffect, useMemo, useState } from 'react';
import { Provider } from 'react-redux';
import { CookiesProvider } from 'react-cookie';

import store from './store';

import Navbar from './components/Navbar';
import ServiceBubbles from './components/ServiceBubbles';
import LandscapeContainer from './components/LandscapeContainer';
import ColorGradeFilter, { getColorGradeMode, isGradeModeForced } from './components/ColorGradeFilter';
import { isTierForced, recordMeasuredTier } from './utils/deviceTier';
import { startFrameBudgetWatchdog } from './utils/frameBudgetWatchdog';

import './App.scss';

// Diagnostics only, and lazily imported so none of it reaches the normal
// bundle: `?gradeprobe=1` mounts a panel that shows whether this engine can
// actually render the colour grade. See GradeProbeOverlay.tsx - it exists so
// that question can be answered on a device you cannot attach an inspector to.
const GradeProbeOverlay = React.lazy(() => import('./components/colorGrade/GradeProbeOverlay'));

function App() {
  const [gradeMode, setGradeMode] = useState(getColorGradeMode);
  const gradeEnabled = gradeMode === 'on';
  const showProbe = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('gradeprobe'),
    [],
  );

  // Start in the full grade and watch what this machine actually manages, then
  // back off if it is struggling - rather than deciding in advance from the
  // browser's name, which is the mistake this replaces. See
  // frameBudgetWatchdog.ts for the numbers behind the threshold.
  //
  // The verdict is persisted into the shared device tier, so the *next* load
  // starts in the right mode instead of re-janking its way to the same answer,
  // and the cloud/glass density follows the same flag rather than a second
  // opinion of its own. Those layers read the tier when they mount, so they
  // pick it up on that next load; the grade, being the expensive thing that
  // was actually measured, comes off immediately.
  //
  // Nothing runs when either knob is pinned by the URL - forcing a mode to
  // look at it should never write a verdict about the machine.
  useEffect(() => {
    if (!gradeEnabled || isGradeModeForced() || isTierForced()) return;
    return startFrameBudgetWatchdog(verdict => {
      if (!verdict.struggling) return;
      recordMeasuredTier(true);
      setGradeMode('off');
    });
  }, [gradeEnabled]);

  return (
    <CookiesProvider>
      <Provider store={store}>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
        <div className={`App${gradeEnabled ? '' : ' color-grade-off'}`}>
          {gradeEnabled && <ColorGradeFilter />}
          {gradeEnabled && <div className="color-grade-background color-grade" aria-hidden />}
          {showProbe && (
            <React.Suspense fallback={null}>
              <GradeProbeOverlay />
            </React.Suspense>
          )}
          <Navbar showAboutOptions={false} />
          <div id="main">
            <ServiceBubbles />
            <LandscapeContainer />
          </div>
        </div>
      </Provider>
    </CookiesProvider>
  );
}

export default App;
