import React, { useEffect, useMemo } from 'react';
import { Provider } from 'react-redux';
import { CookiesProvider } from 'react-cookie';
import ReactGA from 'react-ga4';

import store from './store';

import Navbar from './components/Navbar';
import ServiceBubbles from './components/ServiceBubbles';
import LandscapeContainer from './components/LandscapeContainer';
import ColorGradeFilter, { ColorGradeOverlay, getColorGradeMode } from './components/ColorGradeFilter';

import './App.scss';

// TODO: Update tracking ID to your GA4 measurement ID (format: G-XXXXXXXXXX)
const GA_TRACKING_ID = 'G-TODO';

function App() {
  useEffect(() => {
    ReactGA.initialize(GA_TRACKING_ID);
    ReactGA.send('pageview');
  }, []);

  // On engines that actually honor `backdrop-filter: url(#svgFilter)` (Chromium
  // today), a single full-viewport overlay grades everything at once, so the
  // per-element filters are switched off to avoid double-processing the same
  // pixels. On Firefox the per-element filter measurably wrecks scroll
  // performance (see getColorGradeMode), so it's disabled outright there.
  const gradeMode = useMemo(() => getColorGradeMode(), []);
  const appClassName = gradeMode === 'overlay' ? 'App color-grade-via-overlay'
    : gradeMode === 'off' ? 'App color-grade-disabled'
    : 'App';

  return (
    <CookiesProvider>
      <Provider store={store}>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
        <div className={appClassName}>
          {gradeMode !== 'off' && <ColorGradeFilter />}
          {gradeMode === 'overlay' && <ColorGradeOverlay />}
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
