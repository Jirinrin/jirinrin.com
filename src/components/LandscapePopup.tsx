import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { CSSTransition } from 'react-transition-group';
import { isChromium } from 'react-device-detect';
import type { Plugin } from 'unified';
import type { Root } from 'hast';

import { changePage } from '../store/currentPageSlice';
import { useAppDispatch, useAppSelector } from '../store';
import { resolveDeepLinkPath, OBJECT_POPUP_TYPES } from '../deeplinks';

const ArtGallery = lazy(() => import('./ArtGallery'));
const Memories = lazy(() => import('./Memories'));
const GrooveGrove = lazy(() => import('./GrooveGrove'));
const ProjectGallery = lazy(() => import('./ProjectGallery'));
const ReactMarkdown = lazy(() => import('react-markdown'));

import githubIcon from '../assets/objects/images/github.png';
import buttonBg from '../assets/button-bg.webp';
import privacyText from '../assets/privacy.md?raw';

// Pre-import dynamic project images and markdown images (Vite replaces require())
const projectImages = import.meta.glob<string>(
  '../assets/projects/images/*',
  { eager: true, import: 'default' }
);
const objectDetailImages = import.meta.glob<string>(
  '../assets/objects/images/*',
  { eager: true, import: 'default' }
);

const getProjectImage = (img: string): string =>
  projectImages[`../assets/projects/images/${img}`] ?? '';

const getObjectDetailImage = (src: string): string =>
  objectDetailImages[`../assets/objects/images/${src}`] ?? '';

// Rotates digits back so the real phone number never appears as plain text in source/bundle
const deobfuscateDigits = (s: string, shift = 4): string =>
  s.replace(/\d/g, d => String((Number(d) + 10 - shift) % 10));

// A markdown paragraph consisting of nothing but a single link (e.g. `[Go visit KODAMAP](https://...)`
// on its own line) reads as a call-to-action, so render it as a button instead of a plain inline link.
// react-markdown renders a markdown link via *our own* overridden `a` component (see the `components`
// prop below), so the paragraph's single child here is an element of that custom component, not a
// literal `'a'` DOM element - checking `.type === 'a'` never matches, so this checks for an `href` prop
// instead, which every one of our `a` overrides is passed regardless of which one rendered it.
// The spiral tower's popup still cycles through an old-school `invert()`
// filter in dark mode (see Landscape.scss), which would discolor emoji right
// along with the text. Wrapping each one in its own `.emoji` span lets that
// stylesheet cancel the inversion back out with a second, synced `invert()`,
// so emoji keep showing their real colors. Applied to every popup rather
// than just that one - harmless elsewhere, since none of the others invert
// anything and an un-styled `.emoji` span behaves just like plain text.
// Matches characters whose *default* presentation is emoji (color) - plain
// pictographic symbols like © or ♥ render in the surrounding text color and
// should stay that way - plus any pictographic character explicitly forced
// into emoji style via U+FE0F, and ZWJ-joined sequences of either.
const EMOJI_RE = /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️)(?:‍(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️))*/gu;

interface EmojiWrappableNode {
  type: string;
  children?: EmojiWrappableNode[];
  value?: string;
  tagName?: string;
  properties?: { className?: string[] };
}

const splitEmoji = (node: EmojiWrappableNode): EmojiWrappableNode[] => {
  const matches = node.value?.match(EMOJI_RE);
  if (!node.value || !matches) return [node];
  const out: EmojiWrappableNode[] = [];
  node.value.split(EMOJI_RE).forEach((part, i) => {
    if (part) out.push({ type: 'text', value: part });
    if (matches[i]) out.push({
      type: 'element',
      tagName: 'span',
      properties: { className: ['emoji'] },
      children: [{ type: 'text', value: matches[i] }],
    });
  });
  return out;
};

const wrapEmoji = (node: EmojiWrappableNode) => {
  if (!node.children) return;
  node.children = node.children.flatMap(child => {
    wrapEmoji(child);
    return child.type === 'text' ? splitEmoji(child) : [child];
  });
};

const rehypeUnEmoji: Plugin<[], Root> = () => (tree) => {
  wrapEmoji(tree as unknown as EmojiWrappableNode);
};

// Hobby Heap's "about" text lists a couple dozen interests under their own
// ### headings - way too much to read as one continuous scroll, so it's
// rendered as an accordion instead (see the 'hobby-heap' branch in
// renderPopup below). This just splits the raw markdown on those headings;
// everything before the first one is the always-visible intro, and each
// heading's own text becomes one collapsible section's body.
// A markdown line prefixed with `<!-- non-chromium-only -->` (e.g. the Chromium
// callout at the end of jiri-soul.md) only makes sense to readers who AREN'T on
// a Chromium browser - drop the whole line for Chromium visitors, and just strip
// the marker for everyone else, so the source stays plain markdown otherwise.
const NON_CHROMIUM_ONLY_RE = /^<!--\s*non-chromium-only\s*-->\s*/;

const applyBrowserConditionals = (markdown: string): string =>
  markdown
    .split('\n')
    .filter(line => !(isChromium && NON_CHROMIUM_ONLY_RE.test(line)))
    .map(line => line.replace(NON_CHROMIUM_ONLY_RE, ''))
    .join('\n');

interface AccordionSection { title: string; body: string }

const ACCORDION_HEADING_RE = /^### (.+)$/gm;

const splitAccordionSections = (markdown: string): { intro: string; sections: AccordionSection[] } => {
  const headings = [...markdown.matchAll(ACCORDION_HEADING_RE)];
  if (!headings.length) return { intro: markdown, sections: [] };

  const intro = markdown.slice(0, headings[0].index).trim();
  const sections = headings.map((heading, i) => ({
    title: heading[1].trim(),
    body: markdown.slice(heading.index! + heading[0].length, headings[i + 1]?.index ?? markdown.length).trim(),
  }));
  return { intro, sections };
};

const renderParagraph = ({ children }: { children?: React.ReactNode }) => {
  const childArray = React.Children.toArray(children);
  const only = childArray[0];
  if (childArray.length === 1 && React.isValidElement(only) && typeof (only.props as { href?: unknown }).href === 'string') {
    const anchor = only as React.ReactElement<React.AnchorHTMLAttributes<HTMLAnchorElement>>;
    return (
      <p className="popup-window-button-line">
        {React.cloneElement(anchor, {
          className: [anchor.props.className, 'popup-window-button'].filter(Boolean).join(' '),
          style: { ...anchor.props.style, '--button-bg': `url(${buttonBg})` } as React.CSSProperties,
        })}
      </p>
    );
  }
  return <p>{children}</p>;
};

const getExperienceLevel = (className?: string) => {
  if (!className) return null;
  if (className.includes('icon-dark'))   return 'Ample';
  if (className.includes('icon-middle')) return 'Enough';
  if (className.includes('icon-light'))  return 'Little';
  return null;
};

interface LandscapePopupProps {
  /** Closes the popup and zooms the canvas back out (see zoomOutCanvas in LandscapeContainer). */
  onClose: () => void;
}

function LandscapePopup({ onClose }: LandscapePopupProps) {
  const dispatch = useAppDispatch();
  const currentPage = useAppSelector(state => state.currentPage);
  const abouts = useAppSelector(state => state.abouts);

  // Which Hobby Heap section (by index) is currently expanded - null means
  // all collapsed. Only one at a time, accordion-style.
  const [openHobbySection, setOpenHobbySection] = useState<number | null>(null);

  // ArtGallery/Memories/GrooveGrove are lazy-loaded (framer-motion is heavy)
  // and are otherwise always mounted (with an `open` prop, using
  // AnimatePresence internally for their own exit animation) - to actually
  // defer loading their chunk until needed, only start rendering each one
  // once its `open` condition has been true at least once, and then keep it
  // mounted so the exit animation still works on subsequent closes.
  const [hasOpenedGallery, setHasOpenedGallery] = useState(false);
  const [hasOpenedMemories, setHasOpenedMemories] = useState(false);
  const [hasOpenedGroove, setHasOpenedGroove] = useState(false);

  // nodeRef for CSSTransition (required in react-transition-group v4 + React 18)
  const popupRef = useRef<HTMLDivElement>(null);

  // Always start fresh (all collapsed) whenever a popup opens or changes,
  // rather than remembering what was left open from a previous visit.
  useEffect(() => {
    setOpenHobbySection(null);
  }, [currentPage.popup?.id, currentPage.showPopup]);

  const isGalleryOpen = currentPage.showPopup && currentPage.popup?.type === 'gallery';
  const isMemoriesOpen = currentPage.showPopup && currentPage.popup?.type === 'memories';
  const isGrooveOpen = currentPage.showPopup && currentPage.popup?.type === 'groove';

  useEffect(() => { if (isGalleryOpen) setHasOpenedGallery(true); }, [isGalleryOpen]);
  useEffect(() => { if (isMemoriesOpen) setHasOpenedMemories(true); }, [isMemoriesOpen]);
  useEffect(() => { if (isGrooveOpen) setHasOpenedGroove(true); }, [isGrooveOpen]);

  // The SOUL's popup is the one 'text' object that doesn't read as a letter:
  // it's a glowing window with its own text scrolling inside it (see
  // `.popup-window--radiant` in Landscape.scss), so it's carved out of the
  // letter treatment below and given the fixed-size window instead.
  const isSoulPopup = currentPage.popup?.id === 'jiri-soul';

  // Landscape 1's object popups render as a "letter": one long box wrapped
  // around all of its content, scrolled as a whole by the backdrop, rather
  // than a fixed-size window with the text scrolling inside it. Landscape 2's
  // project popups (type 'project') keep the fixed-size window, since they
  // have to grow out of, and fit inside, the book.
  const isLetterPopup = (currentPage.popup?.type === 'text' || currentPage.popup?.type === 'about') && !isSoulPopup;

  // Blocks the page from scrolling behind the modal when the cursor is over
  // the dimmed background (not the popup box itself, which has its own
  // internal scroll). Needs a real non-passive listener via ref - React
  // makes onWheel passive by default, so preventDefault() from JSX would
  // silently do nothing. Can't just lock scroll globally (e.g. overflow:
  // hidden on html/body) either: opening a popup can itself trigger a
  // programmatic window.scrollTo (see zoomInCanvas), which a global lock
  // would swallow and leave the page snapped to the top. Skipped entirely for
  // letter popups: there the background *is* the scroll container, so blocking
  // its wheel events would stop the letter from scrolling at all -
  // `overscroll-behavior: contain` keeps it from chaining to the page instead.
  useEffect(() => {
    const bg = popupRef.current;
    if (!bg || isLetterPopup) return;
    const blockBackgroundScroll = (e: WheelEvent) => {
      if (e.target === bg) e.preventDefault();
    };
    bg.addEventListener('wheel', blockBackgroundScroll, { passive: false });
    return () => bg.removeEventListener('wheel', blockBackgroundScroll);
  }, [currentPage.showPopup, isLetterPopup]);

  const hidePopup = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.target !== e.currentTarget) return;
    onClose();
  };

  // Internal links within markdown text (e.g. hobby-heap's "Check the Groove
  // Grove" link) point at one of our own deeplink paths - rather than opening
  // that path in a new tab, do the SPA-native thing: swap the currently open
  // popup for the one that path resolves to, same as Navbar's goToPopup.
  // Falls back to a real navigation for any internal path we can't resolve
  // (e.g. a project link), and is a no-op for anything else.
  const navigateInternalLink = (href: string) => {
    const link = resolveDeepLinkPath(href);
    if (link?.popupId) {
      const text = link.popupId === 'privacy' ? privacyText : abouts[link.popupId]?.text;
      dispatch(changePage({
        landscape: 1,
        popup: { type: OBJECT_POPUP_TYPES[link.popupId], id: link.popupId, text },
        forceLoad: true,
      }));
      return;
    }
    if (link) {
      dispatch(changePage({ landscape: link.landscape, showPopup: false, forceLoad: true }));
      return;
    }
    window.location.href = href;
  };

  const renderPopup = () => {
    const { popup } = currentPage;
    if (!popup) return null;

    switch (popup.type) {
      case 'text':
      case 'about': {
        const text = applyBrowserConditionals(popup.text ?? '');
        const aboutMarkdownComponents = {
          p: renderParagraph,
          img: ({ src, alt, title }: { src?: string; alt?: string; title?: string }) => (
            <img
              src={getObjectDetailImage(src ?? '')}
              className={alt}
              alt={(src ?? '').split('/').reverse()[0]}
              title={popup.id === 'groove-grove' ? `${title} | ${getExperienceLevel(alt)} experience` : undefined}
            />
          ),
          a: ({ href, className, style, children }: { href?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) => {
            if (href?.startsWith('tel-obf:')) {
              const realTel = `tel:${deobfuscateDigits(href.slice('tel-obf:'.length))}`;
              return (
                <a href={realTel} className={className} style={style} onClick={() => window.open(realTel, '_blank')}>
                  {deobfuscateDigits(String(children))}
                </a>
              );
            }
            if (href?.startsWith('/')) {
              return (
                <a
                  href={href}
                  className={className}
                  style={style}
                  onClick={(e) => {
                    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    navigateInternalLink(href);
                  }}
                >
                  {children}
                </a>
              );
            }
            return (
              <a href={href} className={className} style={style} target="_blank" rel="noopener noreferrer" onClick={() => href && window.open(href, '_blank')}>
                {children}
              </a>
            );
          }
        };

        // Hobby Heap's interest list is long enough that reading it as one
        // continuous letter got unwieldy - split into an accordion instead,
        // so every interest's heading is visible up front but only one body
        // of text is open (and thus scrolled through) at a time.
        if (popup.id === 'hobby-heap') {
          const { intro, sections } = splitAccordionSections(text);
          return (
            <>
              <Suspense fallback={null}>
                <ReactMarkdown urlTransform={(url) => url} rehypePlugins={[rehypeUnEmoji]} components={aboutMarkdownComponents}>
                  {intro}
                </ReactMarkdown>
              </Suspense>
              <div className="accordion-list">
                {sections.map((section, i) => {
                  const isOpen = openHobbySection === i;
                  return (
                    <div className={`accordion-section${isOpen ? ' accordion-section--open' : ''}`} key={section.title}>
                      <h3 className="accordion-section__heading">
                        <button
                          type="button"
                          className="accordion-section__header"
                          aria-expanded={isOpen}
                          onClick={() => setOpenHobbySection(isOpen ? null : i)}
                        >
                          <span className="accordion-section__chevron" aria-hidden="true" />
                          {section.title}
                        </button>
                      </h3>
                      <div className="accordion-section__panel">
                        <div className="accordion-section__panel-inner">
                          <Suspense fallback={null}>
                            <ReactMarkdown urlTransform={(url) => url} rehypePlugins={[rehypeUnEmoji]} components={aboutMarkdownComponents}>
                              {section.body}
                            </ReactMarkdown>
                          </Suspense>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        }

        return (
          <Suspense fallback={null}>
            <ReactMarkdown urlTransform={(url) => url} rehypePlugins={[rehypeUnEmoji]} components={aboutMarkdownComponents}>
              {text}
            </ReactMarkdown>
          </Suspense>
        );
      }
      case 'project':
        return (
          <div>
            {popup.project?.github &&
              <a
                className="github-icon"
                href={`https://github.com/Jirinrin/${popup.project.id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => window.open(`https://github.com/Jirinrin/${popup.project!.id}`, '_blank')}
              >
                <img src={githubIcon} alt="github icon"/>
              </a>
            }
            {popup.project?.cover &&
              <div
                className="project-cover"
                style={{ '--cover-ratio': popup.project.cover.ratio } as React.CSSProperties}
              >
                {popup.project.cover.type === 'video'
                  ? <video src={getProjectImage(popup.project.cover.src)} autoPlay loop muted playsInline />
                  : <img src={getProjectImage(popup.project.cover.src)} alt="" />
                }
              </div>
            }
            <Suspense fallback={null}>
              <ReactMarkdown
                rehypePlugins={[rehypeUnEmoji]}
                components={{
                  p: renderParagraph,
                  img: ({ src, alt }: { src?: string; alt?: string }) => (
                    <img src={getProjectImage(src ?? '')} alt={alt ?? ''} />
                  ),
                  a: ({ href, className, style, children }: { href?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) => (
                    <a href={href} className={className} style={style} target="_blank" rel="noopener noreferrer" onClick={() => href && window.open(href, '_blank')}>
                      {children}
                    </a>
                  )
                }}
              >
                {popup.project?.description ?? ''}
              </ReactMarkdown>
            </Suspense>
            {popup.project?.images[0] &&
              <>
                <br/>
                <Suspense fallback={null}>
                  <ProjectGallery
                    key={popup.project.id}
                    images={popup.project.images}
                    getImage={getProjectImage}
                    landscape={popup.project.landscapeGallery}
                  />
                </Suspense>
              </>
            }
          </div>
        );
      case 'gallery':
      case 'memories':
      case 'groove':
        // Rendered separately by <ArtGallery> / <Memories> / <GrooveGrove>, outside this generic popup box.
        return null;
      default:
        throw new Error('Nonexisting popup type');
    }
  };

  return (
    <>
      <CSSTransition
        nodeRef={popupRef}
        in={currentPage.showPopup && currentPage.popup?.type !== 'gallery' && currentPage.popup?.type !== 'memories' && currentPage.popup?.type !== 'groove'}
        classNames="popup-window-background"
        unmountOnExit
        // Generous headroom past what the CSS itself takes (see the letter
        // variant's rise-in transition in Landscape.scss): RTG strips the
        // enter/exit classes the instant this timeout fires, whatever the
        // CSS transition's own progress is. Budgeting it right up against
        // the CSS duration (as this used to be, at 700/500 matching the
        // fade's own 700ms/500ms) left ~zero margin for RTG's own reflow
        // delay before the -active class even lands - invisible for a
        // small transform, but a big one gets caught mid-flight and
        // "snaps" the rest of the way when the class is yanked.
        timeout={{ enter: 900, exit: 650 }}
      >
        <div
          ref={popupRef}
          className={`popup-window-background${isLetterPopup ? ' popup-window-background--letter' : ''}`}
          onClick={hidePopup}
        >
          <div className={`popup-window${currentPage.popup?.type === 'text' && !isSoulPopup ? '' : ' popup-window-large'}${isLetterPopup ? ' popup-window--letter' : ''}${currentPage.popup?.id === 'spiral-tower' ? ' popup-window--inverting' : ''}${isSoulPopup ? ' popup-window--radiant' : ''}`}>
            <div className="popup-window-content">
              {renderPopup()}
            </div>
          </div>
        </div>
      </CSSTransition>

      {hasOpenedGallery &&
        <Suspense fallback={null}>
          <ArtGallery
            open={currentPage.showPopup && currentPage.popup?.type === 'gallery'}
            onClose={onClose}
          />
        </Suspense>
      }

      {hasOpenedMemories &&
        <Suspense fallback={null}>
          <Memories
            open={currentPage.showPopup && currentPage.popup?.type === 'memories'}
            onClose={onClose}
          />
        </Suspense>
      }

      {hasOpenedGroove &&
        <Suspense fallback={null}>
          <GrooveGrove
            open={currentPage.showPopup && currentPage.popup?.type === 'groove'}
            onClose={onClose}
          />
        </Suspense>
      }
    </>
  );
}

export default LandscapePopup;
