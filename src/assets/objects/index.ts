import * as C from '../../constants';
import projects from '../projects';
import { isMobile } from 'react-device-detect';
import type { AboutObject } from '../../types';

type ObjectsMap = Record<string, AboutObject>;

const objects: ObjectsMap = {
  'awards-cup': {
    id: 'awards-cup',
    name: 'Endowment Shrine (construction中)',
    left: 2731,
    top: 3542,
    hasText: true,
    extension: 'png'
  },
  'future-building': {
    id: 'future-building',
    name: 'あたしの FUTURE HOME',
    left: 479.5,
    top: 3765,
    hasText: true,
    extension: isMobile ? 'png' : 'gif'
  },
  'hobby-heap': {
    id: 'hobby-heap',
    name: 'Hobby Heap',
    left: 74,
    top: 4377,
    hasText: true,
    extension: 'png'
  },
  'jiri-soul': {
    id: 'jiri-soul',
    name: 'Jiri\'s SOUL',
    left: 2103,
    top: 4330,
    width: 207 * C.CANVAS_SCALE,
    height: 232 * C.CANVAS_SCALE,
    hasText: true,
    extension: 'png'
  },
  'octopus-tree': {
    id: 'octopus-tree',
    name: 'The Tree of Life',
    left: 1321,
    top: 4205,
    hasText: true,
    extension: isMobile ? 'png' : 'gif'
  },
  'spiral-tower': {
    id: 'spiral-tower',
    name: 'Pillar of Paradigm',
    left: 4238,
    top: 2760,
    hasText: true,
    extension: isMobile ? 'png' : 'gif'
  },
  'groove-grove': {
    id: 'groove-grove',
    name: 'Groove Grove',
    left: 0,
    top: 3919,
    hasText: true,
    extension: 'png'
  },
  'book-stack': {
    id: 'book-stack',
    name: 'Stack \'o\' Projects',
    left: C.TINY_BOOK_BASE_LEFT,
    top: C.getTinyBookStackTop(projects.length),
    width: C.TINY_BOOK_WIDTH * C.CANVAS_SCALE,
    height: C.TINY_BOOK_HEIGHT * C.CANVAS_SCALE * projects.length,
    hasText: false,
    extension: 'png'
  },
  'contact-details': {
    id: 'contact-details',
    name: 'Search Envelope',
    left: 1247,
    top: 5225,
    hasText: true,
    extension: 'png'
  }
};

Object.values(objects).forEach(obj => {
  obj.left = (obj.left ?? 0) * C.CANVAS_SCALE;
  obj.top = (obj.top ?? 0) * C.CANVAS_SCALE;
});

export default objects;
