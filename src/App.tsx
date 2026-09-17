import React, { useMemo } from 'react';
import { Provider } from 'react-redux';
import { CookiesProvider } from 'react-cookie';

import store from './store';

import Navbar from './components/Navbar';
import ServiceBubbles from './components/ServiceBubbles';
import LandscapeContainer from './components/LandscapeContainer';
import ColorGradeFilter, { getColorGradeMode } from './components/ColorGradeFilter';

import './App.scss';

// Diagnostics only, and lazily imported so none of it reaches the normal
// bundle: `?gradeprobe=1` mounts a panel that shows whether this engine can
// actually render the colour grade. See GradeProbeOverlay.tsx - it exists so
// that question can be answered on a device you cannot attach an inspector to.
const GradeProbeOverlay = React.lazy(() => import('./components/colorGrade/GradeProbeOverlay'));

function App() {
  const gradeEnabled = useMemo(() => getColorGradeMode() === 'on', []);
  const showProbe = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('gradeprobe'),
    [],
  );

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
