import {TINY_BOOK_BASE_BOTTOM, TINY_BOOK_HEIGHT} from './BOOKS';

export const getTinyBookStackTop = (size: number): number => TINY_BOOK_BASE_BOTTOM - size * TINY_BOOK_HEIGHT;

export const calculateBookShadow = (bookClassName: string): string | null => {
  const $ = (px: string) => parseFloat(px);

  const books = document.querySelectorAll<HTMLElement>(bookClassName);
  if (books.length === 0) return null;

  let path = `M ${$(books[0].style.left)}, ${$(books[0].style.top) + $(books[0].style.height)}`;
  books.forEach((b, i) => {
    if (i !== 0)
      path += ` L ${$(b.style.left)}, ${$(b.style.top) + $(b.style.height)}`;
    path += ` L ${$(b.style.left)}, ${$(b.style.top)}`;
  });
  books.forEach((_, i) => {
    const b = books[books.length - 1 - i];
    path += ` L ${$(b.style.left) + $(b.style.width)}, ${$(b.style.top)}`;
    path += ` L ${$(b.style.left) + $(b.style.width)}, ${$(b.style.top) + $(b.style.height)}`;
  });

  path += 'Z';
  return path;
}

export function mapRange(num: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return (num - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

// Five layout reads, and every one of them flushes any pending style and
// layout work first. That is cheap once and ruinous in a loop - and this is
// in a loop: getPupilTranslation calls it three times, from an
// applyPupilTranslation that runs inside a requestAnimationFrame callback, so
// a moving cursor was costing fifteen forced synchronous layouts per frame.
//
// It profiled as the #3 self-time item on the content main thread (10.9% on
// `?perf=high`, 7.9% on low, ~2.3-2.5ms of every frame) on a fast Windows
// desktop with hardware WebRender - larger than the WebRender display list,
// larger than style computation, and roughly 140x the colour grade's own
// cost. See COLOR-GRADE-CROSS-BROWSER.md, which found it while looking for
// something else entirely.
//
// The document's height does not change *within* a frame, so cache it for the
// rest of the current frame and let the next animation frame drop it. This
// replaces an indefinite cache invalidated by a ResizeObserver + resize
// listeners, which went stale in Firefox: the height that matters is
// `scrollHeight`, which also grows from absolutely-positioned overflow and
// late image/font layout shifts that never resize <html> or <body>, so no
// observer fires - and a stale height here puts the pupils far off, down by
// the character's feet. A per-frame cache cannot go stale and still turns the
// fifteen reads per frame into at most five.
let docHeight: number | null = null;
let clearScheduled = false;

export function invalidateDocHeight(): void {
  docHeight = null;
}

function clearDocHeight(): void {
  clearScheduled = false;
  docHeight = null;
}

export function getDocHeight(): number {
  if (docHeight !== null) return docHeight;

  const body = document.body;
  const html = document.documentElement;
  docHeight = Math.max(
    body.scrollHeight,
    body.offsetHeight,
    html.clientHeight,
    html.scrollHeight,
    html.offsetHeight
  );
  if (!clearScheduled) {
    clearScheduled = true;
    requestAnimationFrame(clearDocHeight);
  }
  return docHeight;
}

export function getBottomScrollPos(): number {
  return getDocHeight() - window.innerHeight;
}

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
