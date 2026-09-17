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

export function getDocHeight(): number {
  const body = document.body;
  const html = document.documentElement;
  return Math.max(
    body.scrollHeight,
    body.offsetHeight,
    html.clientHeight,
    html.scrollHeight,
    html.offsetHeight
  );
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
