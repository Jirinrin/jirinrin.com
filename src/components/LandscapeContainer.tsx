import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CSSTransition } from 'react-transition-group';
import ReactMarkdown from 'react-markdown';

import * as C from '../constants';
import { SITE_NAME } from '../assets/SITE_NAME';

import { updateWidths, fetchProjectDescriptions } from '../store/projectsSlice';
import { changePage } from '../store/currentPageSlice';
import { useAppDispatch, useAppSelector } from '../store';
import { getDeepLinkPath, resolveDeepLinkPath, OBJECT_POPUP_TYPES } from '../deeplinks';
import { allPlaqueVariants } from '../assets/art-gallery/frames';

import Landscape1 from './Landscape1';
import Landscape2 from './Landscape2';
import ArtGallery from './ArtGallery';
import ProjectGallery from './ProjectGallery';

import './Landscape.scss';

import backArrow from '../assets/back-arrow.png';
import shine3 from '../assets/landscape/shine-3.png';
import sunrays from '../assets/landscape/sunrays.png';
import jiriHead from '../assets/landscape/jiri-head.png';
import githubIcon from '../assets/objects/images/github.png';
import landscape2Img from '../assets/landscape/landscape-2.png';
import boxDarkSmall from '../assets/box-dark-small.png';

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

// Cheap string hash so a given button always lands on the same plaque
// (stable across re-renders) instead of reshuffling at random.
const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
};

const LIGHT_PLAQUES = allPlaqueVariants().map(p => p.light);

// A markdown paragraph consisting of nothing but a single link (e.g. `[Go visit KODAMAP](https://...)`
// on its own line) reads as a call-to-action, so render it as a button instead of a plain inline link.
// react-markdown renders a markdown link via *our own* overridden `a` component (see the `components`
// prop below), so the paragraph's single child here is an element of that custom component, not a
// literal `'a'` DOM element - checking `.type === 'a'` never matches, so this checks for an `href` prop
// instead, which every one of our `a` overrides is passed regardless of which one rendered it.
const renderParagraph = ({ children }: { children?: React.ReactNode }) => {
  const childArray = React.Children.toArray(children);
  const only = childArray[0];
  if (childArray.length === 1 && React.isValidElement(only) && typeof (only.props as { href?: unknown }).href === 'string') {
    const anchor = only as React.ReactElement<React.AnchorHTMLAttributes<HTMLAnchorElement>>;
    // One of the gallery's own light plaque paintings, reused here as the
    // button's texture - its own torn/irregular edges (rather than a plain
    // rectangle) are the whole point, so it's stretched across the button
    // exactly like button-bg.png used to be.
    const plaque = LIGHT_PLAQUES[hashString(anchor.props.href ?? '') % LIGHT_PLAQUES.length];
    return (
      <p className="popup-window-button-line">
        {React.cloneElement(anchor, {
          className: [anchor.props.className, 'popup-window-button'].filter(Boolean).join(' '),
          style: { ...anchor.props.style, '--button-plaque-bg': `url(${plaque})` } as React.CSSProperties,
        })}
      </p>
    );
  }
  return <p>{children}</p>;
};

function LandscapeContainer() {
  const dispatch = useAppDispatch();
  const projects = useAppSelector(state => state.projects);
  const currentPage = useAppSelector(state => state.currentPage);
  const abouts = useAppSelector(state => state.abouts);

  const [scaleFactor, setScaleFactor] = useState(() => window.innerWidth / C.CANVAS_WIDTH);
  const [zoomIn, setZoomIn] = useState(false);
  const [frameOffset, setFrameOffset] = useState(0);
  const [animationOngoing, setAnimationOngoing] = useState(false);

  // Use a ref for frameOffset so the scroll listener always sees the latest value
  const frameOffsetRef = useRef(0);

  const prevCurrentPage = useRef(currentPage);

  // nodeRefs for CSSTransition (required in react-transition-group v4 + React 18)
  const landscape1Ref = useRef<HTMLDivElement>(null);
  const landscape2Ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Preload eagerly: the back arrow, and Landscape2's own background/book images,
  // only ever load once the user first reaches Projects (mountOnEnter/unmountOnExit
  // above and in Landscape2). On that first visit the browser fetching+decoding
  // landscape-2.png and box-dark-small.png (much heavier than the arrow itself)
  // jams the main thread right as the back arrow's fade-in starts, so it drops
  // frames and appears to pop in instead of fading. Warming the cache for all of
  // them ahead of time keeps that first visit as cheap as every later one.
  useEffect(() => {
    for (const src of [backArrow, landscape2Img, boxDarkSmall]) {
      const img = new Image();
      img.src = src;
    }
  }, []);

  const calculateScaleFactor = (windowSize = window.innerWidth) => windowSize / C.CANVAS_WIDTH;

  const handleResize = () => setScaleFactor(calculateScaleFactor(window.innerWidth));

  const updateAnimations = (firstDelete = false) => {
    void firstDelete;
    const style = document.createElement('style');
    const container = document.querySelector('#Landscape-container');
    if (!container) return;

    const sf = scaleFactor;
    const exit1 = 'translate(-100vw, 0)';
    const exit2 = 'translate(100vw, 0)';
    const enter = 'translate(0, 0)';

    const t0 = 'div.landscape-variant-container';
    const t1 = ' { transform: ';
    const t2 = ` scale(${sf}) !important; }`;

    const rules = [
      t0 + '.landscape--1-enter'                         + t1 + exit1 + t2,
      t0 + '.landscape--1-exit.landscape--1-exit-active' + t1 + exit1 + t2,
      t0 + '.landscape--2-exit.landscape--2-exit-active' + t1 + exit2 + t2,
      t0 + '.landscape--1-enter.landscape--1-enter-active' + t1 + enter + t2,
      t0 + '.landscape--1-exit'                          + t1 + enter + t2,
      t0 + '.landscape--2-exit'                          + t1 + enter + t2,
    ];

    rules.forEach(r => style.appendChild(document.createTextNode(r)));
    container.appendChild(style);
  };

  useEffect(() => {
    // Measure text widths for book positioning
    const widths = projects.map(p => {
      const test = document.getElementById('text-test') as HTMLElement | null;
      if (!test) return null;
      test.style.fontSize = '1000px';
      test.style.padding = '0';
      test.innerHTML = p.title;
      return (test.clientWidth + 1) / 1000;
    });
    dispatch(updateWidths(widths));

    window.addEventListener('resize', handleResize);
    updateAnimations();

    return () => window.removeEventListener('resize', handleResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!animationOngoing) updateAnimations(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scaleFactor]);

  // Blocks the page from scrolling behind the modal when the cursor is over
  // the dimmed background (not the popup box itself, which has its own
  // internal scroll). Needs a real non-passive listener via ref - React
  // makes onWheel passive by default, so preventDefault() from JSX would
  // silently do nothing. Can't just lock scroll globally (e.g. overflow:
  // hidden on html/body) either: opening a popup can itself trigger a
  // programmatic window.scrollTo (see zoomInCanvas), which a global lock
  // would swallow and leave the page snapped to the top.
  useEffect(() => {
    const bg = popupRef.current;
    if (!bg) return;
    const blockBackgroundScroll = (e: WheelEvent) => {
      if (e.target === bg) e.preventDefault();
    };
    bg.addEventListener('wheel', blockBackgroundScroll, { passive: false });
    return () => bg.removeEventListener('wheel', blockBackgroundScroll);
  }, [currentPage.showPopup]);

  useEffect(() => {
    const prev = prevCurrentPage.current;
    prevCurrentPage.current = currentPage;

    const pageChanged = JSON.stringify(currentPage) !== JSON.stringify(prev);
    if (!pageChanged) return;

    // Don't scroll when closing a popup on landscape 2
    if (!(currentPage.landscape === 2 && prev.showPopup === true && currentPage.showPopup === false)) {
      scrollDown(true);
    }

    const { popup } = currentPage;
    const { popup: oldPopup } = prev;

    if (!zoomIn && popup &&
        (!oldPopup
          || popup.id !== oldPopup.id
          || (currentPage.showPopup !== prev.showPopup && currentPage.showPopup)) &&
        (popup.type === 'about' || popup.type === 'text' || popup.type === 'gallery')) {
      zoomInCanvas();
    }

    // Deeplink support: this is the single choke point every way of changing
    // page/popup state passes through (object clicks, navbar items, the
    // initial-load effect below), so it's the one place we need to keep the
    // URL in sync rather than touching every call site individually.
    // replaceState (not pushState) on purpose: there's no popstate/back-button
    // handling for popup state anywhere in the app, so adding history entries
    // here would make the back button "close" the popup in a way nothing else
    // supports (and would fight the user's real back-navigation expectations).
    const newPath = getDeepLinkPath(currentPage);
    const oldPath = getDeepLinkPath(prev);
    if (newPath !== oldPath) {
      window.history.replaceState(null, '', newPath);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Deeplink support: if the page was loaded directly at a known deeplink path
  // (/contact, /gallery, /pillar-of-paradigm, /projects, /projects/[id], ...),
  // play through the same steps a real visitor triggering that navigation
  // would (scroll into view, then zoom/open), rather than snapping straight to
  // the end state - see the two branches below for the object-popup and
  // project cases respectively. Object-popup text and project descriptions are
  // fetched asynchronously (by Landscape1/Landscape2 on mount, or triggered
  // explicitly below for the project case since it may not have mounted yet),
  // so this effect just waits and re-checks as that data arrives.
  const deepLinkHandledRef = useRef(false);
  const deepLinkFetchedDescriptionsRef = useRef(false);
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    const link = resolveDeepLinkPath(window.location.pathname);
    if (!link) { deepLinkHandledRef.current = true; return; }

    if (link.projectId) {
      const project = projects.find(p => p.id === link.projectId);
      if (!project) { deepLinkHandledRef.current = true; return; }
      if (!project.description) {
        if (!deepLinkFetchedDescriptionsRef.current) {
          deepLinkFetchedDescriptionsRef.current = true;
          dispatch(fetchProjectDescriptions());
        }
        return;
      }
      deepLinkHandledRef.current = true;
      // Same sequence a click on the book-stack + a click on the book itself
      // would produce: scroll to the projects landscape (mirrors book-stack's
      // own onClick), wait for its landscape--2 CSSTransition to finish
      // sliding in (1200ms enter timeout, see the transition below), then
      // click the actual book DOM node so Landscape2's own zoom-open
      // animation runs and opens the popup exactly as it would for a real
      // click - rather than snapping the popup open immediately.
      scrollDown(true, () => {
        dispatch(changePage({ landscape: 2 }));
        setTimeout(() => document.getElementById(project.id)?.click(), 1200);
      });
      return;
    }

    if (link.popupId) {
      const type = OBJECT_POPUP_TYPES[link.popupId];
      const text = abouts[link.popupId]?.text;
      if (type !== 'gallery' && !text) return;
      deepLinkHandledRef.current = true;
      // Same sequence handleObjectClick/goToPopup use: scroll down first,
      // then open the popup once we're there, so the zoom-in/modal only
      // appears once the object is actually in view.
      scrollDown(true, () => dispatch(changePage({ popup: { type, id: link.popupId, text } })));
      return;
    }

    deepLinkHandledRef.current = true;
    dispatch(changePage({ landscape: link.landscape }));
  }, [abouts, projects, dispatch]);

  const scrollTo = (offset = 0, callback?: () => void) => {
    window.scrollTo({ top: C.getBottomScrollPos() - offset, left: 0, behavior: 'auto' });
    if (callback) setTimeout(callback, 1000);
  };

  const scrollDown = (smooth = false, callback?: () => void) => {
    window.scrollTo({ top: C.getBottomScrollPos(), left: 0, behavior: smooth ? 'smooth' : 'auto' });
    if (callback) setTimeout(callback, 100);
  };

  // Keep ref in sync so the scroll listener always reads the latest value
  frameOffsetRef.current = frameOffset;
  // Stable callback — same reference across renders, reads frameOffset from ref
  const scrollToFrameOffset = useCallback(() => {
    window.scrollTo({ top: C.getBottomScrollPos() - frameOffsetRef.current, left: 0, behavior: 'auto' });
  }, []); // empty deps intentional: reads only from refs and pure C functions

  const getBottomOffset = (scroll?: number) => {
    if (!scroll) return 0;
    return C.getDocHeight() - scroll - window.innerHeight;
  };

  const zoomInCanvas = (scroll?: number) => {
    const bottomOffset = getBottomOffset(scroll);
    setZoomIn(true);
    setFrameOffset(bottomOffset);

    // We need to scroll after state update — use timeout to defer
    setTimeout(() => {
      if (bottomOffset === 0) {
        scrollTo(bottomOffset, () => window.addEventListener('scroll', scrollToFrameOffset));
      } else {
        scrollTo(bottomOffset);
        window.addEventListener('scroll', scrollToFrameOffset);
      }
    }, 0);
  };

  const zoomOutCanvas = () => {
    window.removeEventListener('scroll', scrollToFrameOffset);
    setTimeout(() => window.removeEventListener('scroll', scrollToFrameOffset), 1000);
    setZoomIn(false);
    setFrameOffset(0);
    dispatch(changePage({ showPopup: false }));
  };

  const hidePopup = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.target !== e.currentTarget) return;
    zoomOutCanvas();
  };

  const goToProjects = (e: React.MouseEvent) => {
    e.preventDefault();
    dispatch(changePage({ landscape: 1 }));
  };

  const setPageName = (customName?: string | null) => {
    if (customName)
      document.title = `${customName} | ${SITE_NAME}`;
    else if (currentPage.landscape === 2)
      document.title = `Projects | ${SITE_NAME}`;
    else if (window.pageYOffset / C.getBottomScrollPos() > 0.6)
      document.title = `About | ${SITE_NAME}`;
    else
      document.title = SITE_NAME;
  };

  const getExperienceLevel = (className?: string) => {
    if (!className) return null;
    if (className.includes('icon-dark'))   return 'Ample';
    if (className.includes('icon-middle')) return 'Enough';
    if (className.includes('icon-light'))  return 'Little';
    return null;
  };

  const renderPopup = () => {
    const { popup } = currentPage;
    if (!popup) return null;

    switch (popup.type) {
      case 'text':
      case 'about':
        return (
          <ReactMarkdown
            urlTransform={(url) => url}
            components={{
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
                return (
                  <a href={href} className={className} style={style} target="_blank" rel="noopener noreferrer" onClick={() => href && window.open(href, '_blank')}>
                    {children}
                  </a>
                );
              }
            }}
          >
            {popup.text ?? ''}
          </ReactMarkdown>
        );
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
            <ReactMarkdown
              components={{
                p: renderParagraph,
                a: ({ href, className, style, children }: { href?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) => (
                  <a href={href} className={className} style={style} target="_blank" rel="noopener noreferrer" onClick={() => href && window.open(href, '_blank')}>
                    {children}
                  </a>
                )
              }}
            >
              {popup.project?.description ?? ''}
            </ReactMarkdown>
            <br/>
            <br/>
            {popup.project?.images[0] &&
              <ProjectGallery
                key={popup.project.id}
                images={popup.project.images}
                getImage={getProjectImage}
              />
            }
          </div>
        );
      case 'gallery':
        // Rendered separately by <ArtGallery>, outside this generic popup box.
        return null;
      default:
        throw new Error('Nonexisting popup type');
    }
  };

  setPageName();

  return (
    <div
      ref={containerRef}
      id="Landscape-container"
      className="bottom-container full-width"
      style={zoomIn
        ? { height: '100%', width: '100vw', bottom: frameOffset }
        : { height: '100%', width: scaleFactor * C.CANVAS_WIDTH }
      }
    >
      <div className="rel-container overflow-hidden">
        <div className="color-grade-layer color-grade">
          <img
            src={shine3}
            className="landscape full-width"
            id="shining-effect" alt="shining effect"
            style={{ bottom: -frameOffset - (C.CANVAS_HEIGHT / C.CANVAS_WIDTH) * window.innerWidth * 0.27 }}
          />
          <img
            src={sunrays}
            className="landscape full-width"
            id="sunrays" alt="sunrays"
            style={{ bottom: -frameOffset - (C.CANVAS_HEIGHT / C.CANVAS_WIDTH) * window.innerWidth * 0.27 }}
          />
          <img src={jiriHead} className="landscape full-width" id="jiri-head" alt="floating head"
            style={{ bottom: -frameOffset }}/>

          <CSSTransition
            nodeRef={landscape1Ref}
            in={currentPage.landscape === 1 && !!projects[0].book.xOffset}
            classNames="landscape--1"
            mountOnEnter
            unmountOnExit
            timeout={{ enter: 1000, exit: 1200 }}
            onExited={() => setAnimationOngoing(false)}
          >
            <Landscape1
              ref={landscape1Ref}
              scaleFactor={scaleFactor}
              zoomInCanvas={zoomInCanvas}
              zoomOutCanvas={zoomOutCanvas}
              zoomIn={zoomIn}
              scrollDown={scrollDown}
              setPageName={setPageName}
            />
          </CSSTransition>

          <CSSTransition
            nodeRef={landscape2Ref}
            in={currentPage.landscape === 2}
            classNames="landscape--2"
            mountOnEnter
            unmountOnExit
            timeout={{ enter: 1200, exit: 1000 }}
            onExited={() => setAnimationOngoing(false)}
          >
            <Landscape2
              ref={landscape2Ref}
              scaleFactor={scaleFactor}
              zoomInCanvas={zoomInCanvas}
              zoomOutCanvas={zoomOutCanvas}
              zoomIn={zoomIn}
              bottom={frameOffset}
              scrollDown={scrollDown}
            />
          </CSSTransition>
        </div>

        <CSSTransition
          nodeRef={popupRef}
          in={currentPage.showPopup && currentPage.popup?.type !== 'gallery'}
          classNames="popup-window-background"
          unmountOnExit
          timeout={{ enter: 700, exit: 500 }}
        >
          <div ref={popupRef} className="popup-window-background" onClick={hidePopup}>
            <div className={`popup-window${currentPage.popup?.type === 'text' ? '' : ' popup-window-large'}`}>
              <div className="popup-window-content">
                {renderPopup()}
              </div>
            </div>
          </div>
        </CSSTransition>

        <ArtGallery
          open={currentPage.showPopup && currentPage.popup?.type === 'gallery'}
          onClose={zoomOutCanvas}
        />
      </div>

      <img
        src={backArrow}
        alt="back arrow"
        className={`back-arrow${currentPage.landscape === 2 && !currentPage.showPopup ? '' : ' back-arrow--hidden'}`}
        onClick={goToProjects}
      />

      <div className="text-test" id="text-test"/>
      <div className="text-test" id="text-test-2"/>
    </div>
  );
}

export default LandscapeContainer;
