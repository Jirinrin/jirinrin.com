import React, { useMemo } from 'react';
import { Provider } from 'react-redux';
import { CookiesProvider } from 'react-cookie';

import store from './store';

import Navbar from './components/Navbar';
import ServiceBubbles from './components/ServiceBubbles';
import LandscapeContainer from './components/LandscapeContainer';
import ColorGradeFilter, { getColorGradeMode } from './components/ColorGradeFilter';

import './App.scss';

function App() {
  const gradeEnabled = useMemo(() => getColorGradeMode() === 'on', []);

  return (
    <CookiesProvider>
      <Provider store={store}>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"/>
        <div className={`App${gradeEnabled ? '' : ' color-grade-off'}`}>
          {gradeEnabled && <ColorGradeFilter />}
          {gradeEnabled && <div className="color-grade-background color-grade" aria-hidden />}
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
