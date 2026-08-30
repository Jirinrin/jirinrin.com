import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CSSTransition } from 'react-transition-group';
import ReactMarkdown from 'react-markdown';
import ImageGallery from 'react-image-gallery';

import * as C from '../constants';
import { SITE_NAME } from '../assets/SITE_NAME';

import { updateWidths } from '../store/projectsSlice';
import { changePage } from '../store/currentPageSlice';
import { useAppDispatch, useAppSelector } from '../store';

import Landscape1 from './Landscape1';
import Landscape2 from './Landscape2';

import './Landscape.scss';
import 'react-image-gallery/styles/css/image-gallery.css';

import backArrow from '../assets/back-arrow.png';
import shine3 from '../assets/landscape/shine-3.png';
import sunrays from '../assets/landscape/sunrays.png';
import jiriHead from '../assets/landscape/jiri-head.png';
import githubIcon from '../assets/objects/images/github.png';

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

function LandscapeContainer() {
  const dispatch = useAppDispatch();
  const projects = useAppSelector(state => state.projects);
  const currentPage = useAppSelector(state => state.currentPage);

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
  const backArrowRef = useRef<HTMLImageElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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
        (popup.type === 'about' || popup.type === 'text')) {
      zoomInCanvas();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

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
    if (!(e.target as HTMLElement).className.includes('popup-window-background')) return;
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
              img: ({ src, alt, title }: { src?: string; alt?: string; title?: string }) => (
                <img
                  src={getObjectDetailImage(src ?? '')}
                  className={alt}
                  alt={(src ?? '').split('/').reverse()[0]}
                  title={popup.id === 'groove-grove' ? `${title} | ${getExperienceLevel(alt)} experience` : undefined}
                />
              ),
              a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
                if (href?.startsWith('tel-obf:')) {
                  const realTel = `tel:${deobfuscateDigits(href.slice('tel-obf:'.length))}`;
                  return (
                    <a href={realTel} onClick={() => window.open(realTel, '_blank')}>
                      {deobfuscateDigits(String(children))}
                    </a>
                  );
                }
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => href && window.open(href, '_blank')}>
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
                a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => href && window.open(href, '_blank')}>
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
              <ImageGallery
                items={popup.project.images.map(img => ({ original: getProjectImage(img) }))}
                showFullscreenButton={false}
                autoPlay={false}
                showPlayButton={false}
                showThumbnails={false}
              />
            }
          </div>
        );
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
          in={currentPage.showPopup}
          classNames="popup-window-background"
          unmountOnExit
          timeout={{ enter: 700, exit: 500 }}
        >
          <div ref={popupRef} className="popup-window-background" onClick={hidePopup}>
            <div className={`popup-window${currentPage.popup?.type === 'text' ? '' : ' popup-window-large'}`}>
              {renderPopup()}
            </div>
          </div>
        </CSSTransition>
      </div>

      <CSSTransition
        nodeRef={backArrowRef}
        in={currentPage.landscape === 2}
        classNames="back-arrow"
        mountOnEnter
        unmountOnExit
        timeout={{ enter: 10000, exit: 10000 }}
      >
        <img ref={backArrowRef} src={backArrow} alt="back arrow" className="back-arrow" onClick={goToProjects} />
      </CSSTransition>

      <div className="text-test" id="text-test"/>
      <div className="text-test" id="text-test-2"/>
    </div>
  );
}

export default LandscapeContainer;
