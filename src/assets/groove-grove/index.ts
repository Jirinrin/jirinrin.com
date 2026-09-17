// Everything the Groove Grove shows, in the order the vinyls are laid out.
// `section` splits the list in two around the "Music Recommends" divider:
// 'mine' is music Jiri made or mixed, 'recommends' is music she collected and
// wants to hand to you.
//
// Cover art is the grayscale-flattened SoundCloud artwork (see covers/,
// generated once and committed - not fetched at runtime), laid over the
// grooved ring of the disc as a subtle texture. Only some releases have any;
// a vinyl without one just reads as a plain record, which is fine.

const coverFiles = import.meta.glob<string>(
  './covers/*.webp',
  { eager: true, import: 'default' }
);

export const getCover = (key?: string): string | undefined =>
  key ? coverFiles[`./covers/${key}.webp`] : undefined;

interface VinylBase {
  /** URL slug (/groove-grove/<id>) and the seed for this vinyl's layout/look. */
  id: string;
  /** Heading inside the player box. */
  title: string;
  /** Text running around the disc. Defaults to `title` when the full title is too long to read as a ring. */
  ringTitle?: string;
  /** Shown under the title in the player. Omitted where the vinyl's own content already opens with its prose (see the markdown kind). */
  description?: string;
  section: 'mine' | 'recommends';
  /** Key into covers/, if this release has artwork. */
  cover?: string;
}

export interface SeriesEntry {
  /** The big numeral on its own little vinyl above the player. */
  number: string;
  title: string;
  description: string;
  soundcloud: string;
  youtube?: string;
  cover?: string;
}

export interface SoundcloudVinyl extends VinylBase {
  kind: 'soundcloud';
  soundcloud: string;
  /** Playlists get the taller embed (it has a track list to show); single tracks the compact one. */
  playlist: boolean;
  youtube?: string;
}

export interface SeriesVinyl extends VinylBase {
  kind: 'series';
  entries: SeriesEntry[];
  /** Which entry is selected when the player opens (index into `entries`). */
  initialIndex: number;
}

export interface MarkdownVinyl extends VinylBase {
  kind: 'markdown';
  body: string;
}

export interface ExternalVinyl extends VinylBase {
  kind: 'external';
  href: string;
}

export type GrooveVinyl = SoundcloudVinyl | SeriesVinyl | MarkdownVinyl | ExternalVinyl;

import artistRecommends from '../objects/groove-grove-artist-recommends.md?raw';
import grooveGroveMd from '../objects/groove-grove.md?raw';

// The grove's own heading and opening line still come from groove-grove.md,
// the same file every other landscape object's text lives in - so editing it
// changes the grove, rather than the markdown quietly becoming dead weight
// once the object stopped opening as a letter.
export const GROVE_TITLE = grooveGroveMd.match(/^#\s+(.+)$/m)?.[1].trim() ?? 'Groove Grove';
export const GROVE_INTRO = grooveGroveMd.replace(/^#\s+.+$/m, '').trim();

const VINYLS: GrooveVinyl[] = [
  {
    kind: 'soundcloud',
    id: 'hanna',
    title: 'hanna',
    description:
      'Piano improvisations for a friend\'s child who had just arrived in this world. Nothing was written down beforehand, I sat down at home and let the hands go. (It is still v0, so there are some sniffs and odd little bits in there I haven\'t cleaned out yet!)',
    section: 'mine',
    playlist: true,
    cover: 'hanna',
    soundcloud: 'https://soundcloud.com/maaask_nosk/sets/hanna_v0',
  },
  {
    kind: 'soundcloud',
    id: 'hyperfokus',
    title: 'CONEKT.IT HYPERFOKUS_1',
    ringTitle: 'HYPERFOKUS',
    description:
      'A morphing techno / whatever / wherever-it-goes set, played live from the CONEKT.IT home base at the Q42 Makerspace. HYPERFOKUS is meant to bring you into the zone and then quietly keep you there ♥',
    section: 'mine',
    playlist: false,
    cover: 'hyperfokus',
    soundcloud: 'https://soundcloud.com/maaask_nosk/hyperfokus_1-by-conektit-morphing-techno-set',
    youtube: '3fEUui6OaKQ',
  },
  {
    kind: 'series',
    id: 'adhdj',
    title: 'ADHDJ',
    description:
      'Chaotic DJ mixes I did. The whole idea is a mix that has ADHD and therefore cannot stay on one mood for longer than about ten minutes, and at some point I decided that was a feature. Five of them so far. Pick a number~',
    section: 'mine',
    // The series' own record in the grove wears the latest sleeve.
    cover: 'adhdj-5',
    initialIndex: 4,
    entries: [
      {
        number: '1',
        title: 'ADHDJ_1',
        description: 'Where the whole thing started. I noticed I could not stay on a single mood for more than ten minutes, so I stopped trying to 😁',
        soundcloud: 'https://soundcloud.com/maaask_nosk/adhdj_1',
        cover: 'adhdj-1',
      },
      {
        number: '2',
        title: 'ADHDJ_2 || Garage / house / future funk',
        description: 'The bouncy one. Garage, house, future funk, no sitting still here~!',
        soundcloud: 'https://soundcloud.com/maaask_nosk/adhdj_2',
        youtube: 'rJpMIqzA72I',
        cover: 'adhdj-2',
      },
      {
        number: '3',
        title: 'ADHDJ_3 || RESONANCES OF SHIN\'ENKYOU',
        description: 'A narrative mix that goes down and down through a lost civilisation encased at the bottom of the ocean. Atmospheric, cinematic, techno, trance, hi-tech. The most composed one of the five.',
        soundcloud: 'https://soundcloud.com/maaask_nosk/adhdj_3-resonances-of-shinenkyou',
        youtube: 'PbnbeGFupK8',
        cover: 'adhdj-3',
      },
      {
        number: '4',
        title: 'ADHDJ_4 || Spontaneous DJ sesh @ Q42 Makerspace',
        description: 'A spontaneous 11PM session in the Q42 Makerspace, which doubles as a hi-fi rave cave. Hops all over the electronic spectrum in true ADHDJ fashion. Enjoy!!',
        soundcloud: 'https://soundcloud.com/maaask_nosk/adhdj_4-spontaneouos-dj-sesh-q42-makerspace',
        youtube: '7iH6Mav1VaI',
        cover: 'adhdj-4',
      },
      {
        number: '5',
        title: 'ADHDJ_5 || Spontaneous 11PM DJ sesh その２',
        description: 'その２, the second late one at the Makerspace. I was really going at it, bounding all over the place~!',
        soundcloud: 'https://soundcloud.com/maaask_nosk/adhdj-5',
        youtube: 'hWxtIfOoQfE',
        cover: 'adhdj-5',
      },
    ],
  },
  {
    kind: 'soundcloud',
    id: 'experiments',
    title: 'maaask production experiments',
    ringTitle: 'production experiments',
    description:
      'Old production experiments, from back when I was mostly finding out what the software even did. Some of these are barely songs. They are more like little rooms I built and then wandered around in for a while :)',
    section: 'mine',
    playlist: true,
    cover: 'experiments',
    soundcloud: 'https://soundcloud.com/maaask_nosk/sets/maaask-production-experiments',
  },

  {
    kind: 'soundcloud',
    id: 'look-within',
    title: 'LOOK WITHIN',
    description:
      'Music for journeys that go deep within, in an order that nicely \'builds up\' toward intensity. Pick the ones you like and compose your own trip playlist ♡',
    section: 'recommends',
    playlist: true,
    cover: 'look-within',
    soundcloud: 'https://soundcloud.com/maaask_nosk/sets/lookwithin',
  },
  {
    kind: 'soundcloud',
    id: 'dakkon-odori',
    title: '脱魂踊り',
    description:
      'This one switches vibe a lot, on purpose. Lovely to ecstatic dance to: put it on, stop deciding anything, and let the body have the next few hours.',
    section: 'recommends',
    playlist: true,
    cover: 'dakkon-odori',
    soundcloud: 'https://soundcloud.com/maaask_nosk/sets/dywpwp3xgp7i',
  },
  {
    kind: 'soundcloud',
    id: 'suki-suki-psytechno',
    title: 'サイケテクノ',
    description:
      'Psychedelic techno DJ mixes that I love and always always want to put in front of other people. This may really be a beautiful gateway for you!',
    section: 'recommends',
    playlist: true,
    cover: 'suki-suki-psytechno',
    soundcloud: 'https://soundcloud.com/maaask_nosk/sets/hbebuou5o5dr',
  },
  {
    kind: 'markdown',
    id: 'artists',
    title: 'artists to listen to',
    // No `description`: this one's intro is the first paragraph of the
    // markdown itself, so the file stays the single place to edit it.
    section: 'recommends',
    cover: 'artists',
    body: artistRecommends,
  },
  {
    kind: 'external',
    id: 'more-music-tips',
    title: 'ceremony music',
    description:
      'More music for journeys that go inward, written up properly over on my Mushroom website! (Opens in a new tab)',
    section: 'recommends',
    cover: 'more-music-tips',
    href: 'https://kinoko.nosk.be/blog/music',
  },
];

export default VINYLS;
