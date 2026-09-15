import React from 'react';

import { CloudsLayer, type CloudSpec } from './OpeningClouds';

// The tail end of OpeningClouds' original span (see there for the vh/speed
// conventions) - this is the stretch where the landscape's own art actually
// becomes visible underneath. Rendered inside LandscapeContainer's own
// color-grade layer (see the mount point there) rather than ServiceBubbles',
// so these clouds share an isolated compositing group with the landscape art
// itself - the `glass` prop below (a masked backdrop-filter pane, see
// CloudsLayer) can then genuinely saturate/pick up that scenery's own colors,
// which it never could from inside a different filtered group.
const CLOUDS: CloudSpec[] = [
  { img: 2, top: '133vh', left: '72%', width: '19vw', speed: 0.6,  duration: 46, delay: -39, peakOpacity: 0.3,  direction: -1 },
  { img: 4, top: '144vh', left: '40%', width: '11vw', speed: 0.95, duration: 29, delay: -13, peakOpacity: 0.26, direction: 1 },
  { img: 0, top: '155vh', left: '18%', width: '13vw', speed: 1.1,  duration: 35, delay: -24, peakOpacity: 0.28, direction: -1 },
  { img: 3, top: '167vh', left: '62%', width: '10vw', speed: 0.7,  duration: 31, delay: -8,  peakOpacity: 0.24, direction: 1 },
  { img: 1, top: '176vh', left: '32%', width: '22vw', speed: 0.85, duration: 41, delay: -19, peakOpacity: 0.3,  direction: -1 },
  { img: 5, top: '183vh', left: '5%',  width: '12vw', speed: 1.25, duration: 28, delay: -6,  peakOpacity: 0.26, direction: 1 },
  { img: 2, top: '190vh', left: '80%', width: '15vw', speed: 0.65, duration: 37, delay: -31, peakOpacity: 0.28, direction: -1 },
  { img: 4, top: '197vh', left: '52%', width: '9vw',  speed: 1.1,  duration: 25, delay: -12, peakOpacity: 0.24, direction: 1 },
  { img: 0, top: '204vh', left: '20%', width: '11vw', speed: 0.9,  duration: 32, delay: -22, peakOpacity: 0.24, direction: -1 },
];

function BackgroundClouds() {
  return (
    <CloudsLayer clouds={CLOUDS} glass />
  );
}

export default BackgroundClouds;
