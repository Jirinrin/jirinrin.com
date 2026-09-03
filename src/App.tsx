import React, { useEffect, useMemo } from 'react';
import { Provider } from 'react-redux';
import { CookiesProvider } from 'react-cookie';
import ReactGA from 'react-ga4';

import store from './store';

import Navbar from './components/Navbar';
import ServiceBubbles from './components/ServiceBubbles';
import LandscapeContainer from './components/LandscapeContainer';
import ColorGradeFilter, { getColorGradeMode } from './components/ColorGradeFilter';
import OpeningClouds from './components/OpeningClouds';

import './App.scss';

// TODO: Update tracking ID to your GA4 measurement ID (format: G-XXXXXXXXXX)
const GA_TRACKING_ID = 'G-TODO';

function App() {
  useEffect(() => {
    ReactGA.initialize(GA_TRACKING_ID);
    ReactGA.send('pageview');
  }, []);

  const gradeEnabled = useMemo(() => getColorGradeMode() === 'on', []);

  return (
    <CookiesProvider>
      <Provider store={store}>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
        <div className="App">
          {gradeEnabled && <ColorGradeFilter />}
          {gradeEnabled &&
            <div className="color-grade-background color-grade" aria-hidden>
              <OpeningClouds />
            </div>
          }
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
