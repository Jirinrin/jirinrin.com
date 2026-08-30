import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CSSTransition } from 'react-transition-group';

import { changePage } from '../store/currentPageSlice';
import type { ChangePagePayload } from '../store/currentPageSlice';
import { useAppDispatch, useAppSelector } from '../store';
import { SITE_NAME } from '../assets/SITE_NAME';
import * as C from '../constants';

import './Navbar.scss';

const BASE_Y_OFFSET = window.innerHeight * 0.4;
const BASE_SCALE = 2;

const MIDDLE_THREE_ITEMS = ['about', 'center-name', 'projects'];

const NAV_ITEM_REFERENCE: Record<string, string> = {
  'contact': 'CONTACT',
  'about': 'ABOUT',
  'projects': 'PROJECTS',
  'awards': 'AWARDS',
  'soul': 'ゆーりのSOUL',
  'life': 'LIFE',
  'technologies': 'TECHNOLOGIES',
  'passions': 'PLEASURES',
  'programming': 'CODING STYLE',
  'future': 'THE FUTURE OF 侍鈴'
};

const calculateY = (scroll = window.pageYOffset): number => {
  const offset = BASE_Y_OFFSET - scroll * 2;
  return offset <= 0 ? 0 : offset;
};

const calculateTransform = (yOffset: number): number => {
  const scale = C.mapRange(BASE_Y_OFFSET - yOffset, 0, 500, BASE_SCALE, 1);
  return scale <= 1 ? 1 : scale;
};

interface NavbarProps {
  showAboutOptions?: boolean;
}

function Navbar({ showAboutOptions: initialShowAboutOptions = false }: NavbarProps) {
  const dispatch = useAppDispatch();
  const currentPage = useAppSelector(state => state.currentPage);
  const abouts = useAppSelector(state => state.abouts);

  const [yOffset, setYOffset] = useState(() => calculateY());
  const [scale, setScale] = useState(() => calculateTransform(calculateY()));
  const [threshold1, setThreshold1] = useState(0);
  const [threshold2, setThreshold2] = useState(0);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [overlayMode, setOverlayMode] = useState(false);
  const [showAboutOptions, setShowAboutOptions] = useState(initialShowAboutOptions);

  const overlayNodeRef = useRef<HTMLDivElement>(null);

  const updateScrollParams = (scroll?: number) => {
    const newYOffset = calculateY(scroll);
    setYOffset(newYOffset);
    setScale(calculateTransform(newYOffset));
  };

  useLayoutEffect(() => {
    const navBar = document.querySelector('nav') as HTMLElement;
    navBar.style.width = '10%';
    const navItems = document.querySelectorAll('.nav-item');
    let t1 = 0;
    let t2 = 0;
    navItems.forEach(li => {
      t1 += (li as HTMLElement).scrollWidth;
      if (MIDDLE_THREE_ITEMS.includes(li.id))
        t2 += (li as HTMLElement).scrollWidth;
    });
    navBar.style.width = '100%';
    setThreshold1(t1);
    setThreshold2(t2);

    const onScroll = (e: Event) => {
      e.preventDefault();
      updateScrollParams(window.pageYOffset);
    };
    const onResize = () => { setWindowWidth(window.innerWidth); updateScrollParams(); };

    window.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (yOffset > 0 && currentPage.landscape === 1)
      document.title = SITE_NAME;
  }, [yOffset, currentPage.landscape]);

  const goToPopup = (type: 'text' | 'about', id: string) => {
    dispatch(changePage({
      landscape: 1,
      popup: { type, id, text: abouts[id]?.text },
      forceLoad: true,
    }));
    setOverlayMode(false);
  };

  const goTo = (content: ChangePagePayload) => {
    dispatch(changePage({ ...content, forceLoad: true, showPopup: false }));
    setOverlayMode(false);
  };

  const displayForThreshold1 = () => windowWidth > threshold1;
  const displayForThreshold2 = () => windowWidth > threshold2;

  const hideOverlay = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).className.includes('nav-overlay')) return;
    setOverlayMode(false);
  };

  const renderNavItem = (id: string, onClick: () => void, isSubItem = false) => (
    <li id={id} className={`nav-item${isSubItem ? ' sub-nav-item' : ''}`} onClick={onClick} key={id}>
      {NAV_ITEM_REFERENCE[id]}
    </li>
  );

  return (
    <div className="rel-container nav-container">
      <nav>
        {displayForThreshold1() && renderNavItem('contact', () => goToPopup('text', 'contact-details'))}
        {displayForThreshold2() && renderNavItem('about',   () => goTo({ landscape: 1 }))}

        <div className="nav-filler"></div>
        <li
          onClick={() => setOverlayMode(true)}
          className="nav-item"
          id="center-name"
          style={{
            transform: `translateY(${yOffset}px) scale(${scale})`
          }}
        >
          <p>時鈴々</p>
          <p
            className="subtitle"
            style={{ opacity: yOffset / BASE_Y_OFFSET }}
          >
            Jiri Swen <br/>
            transdimensional tree elf
          </p>
        </li>
        <div className="nav-filler"></div>

        {displayForThreshold2() && renderNavItem('projects', () => goTo({ landscape: 2 }))}
        {displayForThreshold1() && renderNavItem('awards',   () => goToPopup('text', 'awards-cup'))}
      </nav>

      <CSSTransition
        nodeRef={overlayNodeRef}
        in={overlayMode}
        classNames="nav-overlay"
        unmountOnExit
        timeout={400}
      >
        <div ref={overlayNodeRef} className="nav-overlay" onClick={hideOverlay}>
          <li className="nav-item" id="nav-overlay-x" onClick={() => setOverlayMode(false)}>X</li>
          {renderNavItem('about',   () => setShowAboutOptions(!showAboutOptions))}
          {renderNavItem('contact', () => goToPopup('about', 'contact-details'))}
          {showAboutOptions &&
            <div>
              {renderNavItem('soul',         () => goToPopup('about', 'jiri-soul'),         true)}
              {renderNavItem('life',         () => goToPopup('about', 'octopus-tree'),      true)}
              {renderNavItem('technologies', () => goToPopup('about', 'groove-grove'), true)}
              {renderNavItem('passions',     () => goToPopup('about', 'hobby-heap'),        true)}
              {renderNavItem('programming',  () => goToPopup('about', 'spiral-tower'),      true)}
              {renderNavItem('future',       () => goToPopup('about', 'future-building'),   true)}
            </div>
          }
          {renderNavItem('projects', () => goTo({ landscape: 2 }))}
          {renderNavItem('awards',   () => goToPopup('text', 'awards-cup'))}
          <li className="nav-item" id="nav-filler-bottom" key="filler" />
        </div>
      </CSSTransition>
    </div>
  );
}

export default Navbar;
