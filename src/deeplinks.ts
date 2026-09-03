// Single source of truth for URL deeplinks into the landscape: which landscape
// object / project maps to which path, in both directions. Generalizes the
// original /contact-only deeplink (see LandscapeContainer's currentPage effect)
// to every clickable object plus /projects and /projects/[project-id].
import type { CurrentPage } from './types';

type ObjectPopupType = 'text' | 'about' | 'gallery';

// About-object id -> URL slug. Kept explicit (rather than derived from `name`)
// since several names are non-ascii, long, or otherwise unfit for a URL.
export const OBJECT_SLUGS: Record<string, string> = {
  'gallery': 'gallery',
  'future-building': 'future-home',
  'hobby-heap': 'hobby-heap',
  'jiri-soul': 'soul',
  'octopus-tree': 'life',
  'spiral-tower': 'pillar-of-paradigm',
  'groove-grove': 'groove-grove',
  'contact-details': 'contact',
};

// Which popup type each object opens as (mirrors the switch in Landscape1's
// handleObjectClick / Navbar's goToPopup calls).
export const OBJECT_POPUP_TYPES: Record<string, ObjectPopupType> = {
  'gallery': 'gallery',
  'contact-details': 'text',
  'jiri-soul': 'text',
  'future-building': 'about',
  'hobby-heap': 'about',
  'octopus-tree': 'about',
  'spiral-tower': 'about',
  'groove-grove': 'about',
};

const SLUG_TO_OBJECT_ID: Record<string, string> = Object.fromEntries(
  Object.entries(OBJECT_SLUGS).map(([id, slug]) => [slug, id])
);

// The path the address bar should show for the given page state.
export const getDeepLinkPath = (page: CurrentPage): string => {
  if (page.showPopup && page.popup) {
    const { popup } = page;
    if (popup.type === 'project' && popup.project) return `/projects/${popup.project.id}`;
    if (popup.id && OBJECT_SLUGS[popup.id]) return `/${OBJECT_SLUGS[popup.id]}`;
  }
  if (page.landscape === 2) return '/projects';
  return '/';
};

export interface ResolvedDeepLink {
  landscape?: 1 | 2;
  popupId?: string;   // about-object id to open as a popup
  projectId?: string;  // project id to open as a 'project' popup
}

// Parses a pathname (from window.location on initial load) into the page
// state it refers to, or null if it isn't a known deeplink.
export const resolveDeepLinkPath = (pathname: string): ResolvedDeepLink | null => {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return null;

  const [, first, second] = path.split('/');

  if (first === 'projects') return second ? { landscape: 2, projectId: second } : { landscape: 2 };

  const objectId = SLUG_TO_OBJECT_ID[first];
  return objectId ? { popupId: objectId } : null;
};
