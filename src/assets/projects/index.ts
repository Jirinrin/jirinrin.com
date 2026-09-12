import type { ProjectBase } from '../../types';

const projects: ProjectBase[] = [
  {
    id: 'architecture-highlights',
    title: 'Architecture Highlights',
    github: false,
    images: [
      'arch-1.jpg',
      'arch-2.jpg',
      'arch-3.jpg',
      'arch-4.jpg',
      'arch-5.jpg',
      'arch-6.jpg',
      'arch-7.jpg',
      'arch-8.jpg',
      'arch-9.jpg',
      'arch-10.jpg',
      'arch-11.jpg',
      'arch-12.jpg',
      'arch-12a.jpg',
      'arch-13.jpg',
      'arch-14.jpg',
      'arch-15.jpg',
      'arch-16.jpg',
      'arch-17.jpg',
      'arch-18.jpg',
      'arch-19.jpg',
      'arch-20.jpg',
      'arch-21.jpg',
      'arch-22.jpg',
    ]
  },
  {
    id: 'jirinrin.com',
    title: 'Jirinrin.com',
    github: true,
    images: []
  },
  {
    id: 'projekt-kinoko',
    title: 'LOOK WITHIN',
    github: false,
    images: [],
    cover: { type: 'video', src: 'look-within-cover.mp4', ratio: 1200 / 396 },
  },
  {
    id: 'kodamap',
    title: 'KODAMAP',
    github: false,
    images: [],
    cover: { type: 'image', src: 'kodamap-cover.webp', ratio: 1600 / 337 },
  },
  {
    id: 'karaokeq',
    title: 'Karaokeq',
    github: true,
    images: []
  },
  {
    id: 'aya',
    title: 'AYA',
    github: true,
    images: []
  },
  {
    id: 'projectdansurando',
    title: 'Project Dansurando',
    github: false,
    images: [],
    cover: { type: 'video', src: 'dansurando-cover.mp4', ratio: 1600 / 296 },
  },
  {
    id: 'umu',
    title: 'umu',
    github: true,
    images: ['umu-1.webp', 'umu-2.webp']
  },
  {
    id: 'irukadrive',
    title: 'Iruka Drive',
    github: true,
    images: ['irukadrive-1.webp', 'irukadrive-2.webp'],
    cover: { type: 'image', src: 'irukadrive-cover.webp', ratio: 1600 / 435 },
  },
];

export default projects;
