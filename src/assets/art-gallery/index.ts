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
  { id: 'trippy-landscape', title: 'Trippy Landscape', rank: 1, image: 'trippy-landscape', aspect: 0.7494 },
  { id: 'torus', title: 'Torus', rank: 1, image: 'torus-poster', aspect: 0.7069, video: 'torus' },
  { id: 'mystical-hill', title: 'Mystical Hill', rank: 1, image: 'mystical-hill', aspect: 1 },
  { id: 'crying', title: 'Crying', rank: 1, image: 'crying', aspect: 0.9237 },

  { id: 'torenrave', title: 'Torenrave', rank: 2, image: 'torenrave-poster', aspect: 0.7069, video: 'torenrave' },
  { id: 'mosaic', title: 'Mosaic', rank: 2, image: 'mosaic-poster', aspect: 0.7194, video: 'mosaic' },
  { id: 'umu-worldview', title: 'Umu Worldview', rank: 2, image: 'umu-worldview', aspect: 1.167 },
  { id: 'halloween-toren-van-terreur', title: 'Halloween: Toren van Terreur', rank: 2, image: 'halloween-toren-van-terreur', aspect: 0.7069 },

  { id: 'cool', title: 'Cool', rank: 3, image: 'cool', aspect: 1 },
  { id: 'gefelicitno', title: 'GEFELICITNO', rank: 3, image: 'gefelicitno', aspect: 1.3434 },
  { id: 'golf', title: 'Golf', rank: 3, image: 'golf', aspect: 1 },
  { id: 'onderwater-cafe', title: 'Onderwater Café', rank: 3, image: 'onderwater-cafe', aspect: 1 },
  { id: 'placemat', title: 'Placemat', rank: 3, image: 'placemat', aspect: 1.3793 },
  { id: 'teeming', title: 'Teeming', rank: 3, image: 'teeming', aspect: 1.4147 },

  { id: 'halloween-boom', title: 'Halloween: Boom', rank: 4, image: 'halloween-boom-poster', aspect: 1, video: 'halloween-boom', loopSilently: true },
  { id: 'halloween-hattori-a', title: 'Halloween: はっとり', rank: 4, image: 'halloween-hattori-a', aspect: 0.75 },
  { id: 'halloween-hattori-b', title: 'Halloween: はっとり満赤', rank: 4, image: 'halloween-hattori-b', aspect: 0.6 },
  { id: 'halloween-monster', title: 'Halloween: モンストー', rank: 4, image: 'halloween-monster', aspect: 1 },
  { id: 'halloween-yukiman', title: 'Halloween: 雪万', rank: 4, image: 'halloween-yukiman', aspect: 1 },
  { id: 'sfeer-foundry', title: 'Sfeer Foundry', rank: 4, image: 'sfeer-foundry', aspect: 1.4995 },
];

export default artGallery;
