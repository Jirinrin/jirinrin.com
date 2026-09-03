export const BASE_CANVAS_WIDTH  = 4961;
export const BASE_CANVAS_HEIGHT = 5662;

export const CANVAS_SCALE = 0.5;
export const CANVAS_WIDTH  = BASE_CANVAS_WIDTH * CANVAS_SCALE;
export const CANVAS_HEIGHT = BASE_CANVAS_HEIGHT * CANVAS_SCALE;

export const TOOLTIP_FONT_SIZE = 1;
export const TOOLTIP_PADDING = 1.1;

export const BASE_ZOOM_BLUR = 8;

export const TECH_CLOUD_START_POSITIONS = [
  {left: 185, top: 3923},
  {left: 275, top: 3952},
  {left: 125, top: 3972}
].map(pos => ({left: pos.left - 50, top: pos.top - 50}))
 .map(pos => ({left: pos.left * CANVAS_SCALE, top: pos.top * CANVAS_SCALE}));
