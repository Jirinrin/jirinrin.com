export interface ArtGalleryItem {
  id: string;
  title: string;
  rank: 1 | 2 | 3 | 4;
  /** filename (no extension) of the static image in ./images */
  image: string;
  /** filename (no extension) of a video in ./videos, if this piece is animated */
  video?: string;
  /** whether the video should behave like a looping silent gif rather than a controls-driven clip */
  loopSilently?: boolean;
}

// Ranks are used to sort pieces, with rank 1 shown first ("front section" of the gallery)
// and rank 4 shown last. Order within a rank is preserved from this list.
const artGallery: ArtGalleryItem[] = [
  { id: 'crying', title: 'Crying', rank: 1, image: 'crying' },
  { id: 'mystical-hill', title: 'Mystical Hill', rank: 1, image: 'mystical-hill' },
  { id: 'torus', title: 'Torus', rank: 1, image: 'torus-poster', video: 'torus' },
  { id: 'trippy-landscape', title: 'Trippy Landscape', rank: 1, image: 'trippy-landscape' },

  { id: 'halloween-toren-van-terreur', title: 'Halloween: Toren van Terreur', rank: 2, image: 'halloween-toren-van-terreur' },
  { id: 'mosaic', title: 'Mosaic', rank: 2, image: 'mosaic-poster', video: 'mosaic' },
  { id: 'torenrave', title: 'Torenrave', rank: 2, image: 'torenrave-poster', video: 'torenrave' },
  { id: 'umu-worldview', title: 'Umu Worldview', rank: 2, image: 'umu-worldview' },

  { id: 'cool', title: 'Cool', rank: 3, image: 'cool' },
  { id: 'gefelicitno', title: 'GEFELICITNO', rank: 3, image: 'gefelicitno' },
  { id: 'golf', title: 'Golf', rank: 3, image: 'golf' },
  { id: 'onderwater-cafe', title: 'Onderwater Café', rank: 3, image: 'onderwater-cafe' },
  { id: 'placemat', title: 'Placemat', rank: 3, image: 'placemat' },
  { id: 'teeming', title: 'Teeming', rank: 3, image: 'teeming' },

  { id: 'halloween-boom', title: 'Halloween: Boom', rank: 4, image: 'halloween-boom-poster', video: 'halloween-boom', loopSilently: true },
  { id: 'halloween-hattori-a', title: 'Halloween: はっとり', rank: 4, image: 'halloween-hattori-a' },
  { id: 'halloween-hattori-b', title: 'Halloween: はっとり満赤', rank: 4, image: 'halloween-hattori-b' },
  { id: 'halloween-monster', title: 'Halloween: モンストー', rank: 4, image: 'halloween-monster' },
  { id: 'halloween-yukiman', title: 'Halloween: 雪万', rank: 4, image: 'halloween-yukiman' },
  { id: 'sfeer-foundry', title: 'Sfeer Foundry', rank: 4, image: 'sfeer-foundry' },
];

export default artGallery;
