export interface ArtGalleryItem {
  id: string;
  title: string;
  rank: 1 | 2 | 3 | 4;
  /** filename (no extension) of the static image in ./images */
  image: string;
  /** true width / height of `image`, so the gallery can size its box without cropping or measuring at runtime */
  aspect: number;
  /** filename (no extension) of a video in ./videos, if this piece is animated */
  video?: string;
  /** whether the video should behave like a looping silent gif rather than a controls-driven clip */
  loopSilently?: boolean;
}

// Ranks are used to sort pieces, with rank 1 shown first ("front section" of the gallery)
// and rank 4 shown last. Order within a rank is preserved from this list.
const artGallery: ArtGalleryItem[] = [
  { id: 'trippy-landscape', title: 'Waiting for a Friend from Another World', rank: 1, image: 'trippy-landscape', aspect: 0.7494 },
  { id: 'torus', title: 'THE TORUS', rank: 1, image: 'torus-poster', aspect: 0.7069, video: 'torus' },
  { id: 'mystical-hill', title: 'My Third Place', rank: 1, image: 'mystical-hill', aspect: 1 },
  { id: 'crying', title: 'Crying', rank: 1, image: 'crying', aspect: 0.9237 },

  { id: 'torenrave', title: 'Torenrave', rank: 2, image: 'torenrave-poster', aspect: 0.7069, video: 'torenrave' },
  { id: 'halloween-toren-van-terreur', title: 'Toren van Terreur', rank: 2, image: 'halloween-toren-van-terreur', aspect: 0.7069 },
  { id: 'beautiful-corner', title: 'Make One Corner of this Earth More Beautiful', rank: 2, image: 'beautiful-corner', aspect: 0.5945 },
  { id: 'een-leukertje', title: 'Een Leukertje', rank: 2, image: 'een-leukertje', aspect: 0.6282 },
  { id: 'hanna-cover', title: 'Hanna', rank: 2, image: 'hanna_cover_inv_lores', aspect: 1.0052 },
  { id: 'kitchen-doodle', title: 'Another World\'s Kitchen', rank: 2, image: 'kitchen-doodle', aspect: 1.6149 },
  { id: 'yuurisaibou-doodle', title: 'Yuurisaibou', rank: 2, image: 'yuurisaibou-doodle', aspect: 0.622 },
  { id: 'mosaic', title: 'The Gear', rank: 2, image: 'mosaic-poster', aspect: 0.7194, video: 'mosaic' },
  { id: 'umu-worldview', title: 'The World of Umu', rank: 2, image: 'umu-worldview', aspect: 1.167 },

  { id: 'gefelicitno', title: 'GEFELICI-TNOR', rank: 3, image: 'gefelicitno', aspect: 1.3434 },
  { id: 'hanna-cover-purple', title: 'Hanna (Dark Mode)', rank: 3, image: 'hanna_cover_inv_purple', aspect: 1.0052 },
  { id: 'golf', title: 'A Wave', rank: 3, image: 'golf', aspect: 1 },
  { id: 'placemat', title: 'ゆうちゃんのお菓子', rank: 3, image: 'placemat', aspect: 1.3793 },
  { id: 'onderwater-cafe', title: 'Underwater Cafe', rank: 3, image: 'onderwater-cafe', aspect: 1 },
  { id: 'cool', title: 'Coolness Spell', rank: 3, image: 'cool', aspect: 1 },
  { id: 'teeming', title: 'Recovered Artifact', rank: 3, image: 'teeming', aspect: 1.4147 },

  { id: 'halloween-boom', title: 'Halloween: Boom', rank: 4, image: 'halloween-boom-poster', aspect: 1, video: 'halloween-boom', loopSilently: true },
  { id: 'halloween-hattori-a', title: 'Halloween: はっとり', rank: 4, image: 'halloween-hattori-a', aspect: 0.75 },
  { id: 'halloween-monster', title: 'Halloween: モンストー', rank: 4, image: 'halloween-monster', aspect: 1 },
  { id: 'halloween-yukiman', title: 'Halloween: 雪万', rank: 4, image: 'halloween-yukiman', aspect: 1 },
  { id: 'sfeer-foundry', title: 'Sfeer Foundry', rank: 4, image: 'sfeer-foundry', aspect: 1.4995 },
];

export default artGallery;
