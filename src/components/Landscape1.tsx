import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { CSSTransition } from 'react-transition-group';
import { isMobile } from 'react-device-detect';
import { useCookies } from 'react-cookie';

import { changePage } from '../store/currentPageSlice';
import { fetchAboutTexts } from '../store/aboutsSlice';
import { useAppDispatch, useAppSelector } from '../store';

import * as C from '../constants';
import OBJECTS from '../assets/objects';
import CREATURES from '../assets/landscape/creatures';
import MUSIC_NOTES from '../assets/objects/images';

import boxDarkSmall from '../assets/box-dark-small.png';
import landscape1Img from '../assets/landscape/landscape-1.png';

// Pre-import dynamic assets at module scope (Vite replaces require())
const creatureImages = import.meta.glob<string>(
  '../assets/landscape/creatures/*.gif',
  { eager: true, import: 'default' }
);
const objectImages = import.meta.glob<string>(
  '../assets/landscape/objects/*.{png,gif}',
  { eager: true, import: 'default' }
);
const techIconImages = import.meta.glob<string>(
  '../assets/objects/images/*.png',
  { eager: true, import: 'default' }
);
const cloudImages = import.meta.glob<string>(
  '../assets/objects/images/circle-cloud-*.png',
  { eager: true, import: 'default' }
);

const getCreatureImage = (species: string) =>
  creatureImages[`../assets/landscape/creatures/${species}.gif`] ?? '';

const getObjectImage = (id: string, ext: string) =>
  objectImages[`../assets/landscape/objects/${id}.${ext}`] ?? '';

const getTechImage = (filename: string) =>
  techIconImages[`../assets/objects/images/${filename}`] ?? '';

const getCloudImage = (n: number) =>
  cloudImages[`../assets/objects/images/circle-cloud-${n}.png`] ?? '';

interface Landscape1Props {
  scaleFactor: number;
  zoomInCanvas: (scroll?: number) => void;
  zoomOutCanvas: () => void;
  zoomIn: boolean;
  scrollDown: (smooth?: boolean, callback?: () => void) => void;
  setPageName: (name?: string | null) => void;
}

interface TooltipData {
  contents: string;
  left: string;
  top: string;
  extraStyles: React.CSSProperties;
  white: boolean;
}

interface Creature {
  id: number;
  type: 'air' | 'ground';
  species: string;
  style: { left: number; top: number };
  timeoutId: ReturnType<typeof setTimeout>;
}

interface MusicCloud {
  id: number;
  cloudNumber: number;
  iconImage: string;
  style: { left: number; top: number };
  timeoutId: ReturnType<typeof setTimeout>;
}

const Landscape1 = forwardRef<HTMLDivElement, Landscape1Props>(function Landscape1({ scaleFactor, zoomIn, scrollDown, setPageName }: Landscape1Props, ref) {
  const dispatch = useAppDispatch();
  const projects = useAppSelector(state => state.projects);
  const abouts = useAppSelector(state => state.abouts);
  const currentPage = useAppSelector(state => state.currentPage);

  const [cookies, setCookie] = useCookies(['hasVisited']);

  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomTranslation, setZoomTranslation] = useState('');
  const [bookShadow, setBookShadow] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [activeCreatures, setActiveCreatures] = useState<Creature[]>([]);
  const [activeMusicClouds, setActiveMusicClouds] = useState<MusicCloud[]>([]);

  const tooltipNodeRef = useRef<HTMLParagraphElement>(null);
  const prevZoomIn = useRef(zoomIn);

  const getTooltipFontSize = () => `${C.TOOLTIP_FONT_SIZE / scaleFactor}rem`;
  const getTooltipPaddingX = () => `${(C.TOOLTIP_PADDING - C.TOOLTIP_FONT_SIZE / 2) / scaleFactor}rem`;
  const getTooltipPaddingY = () => `${C.TOOLTIP_PADDING / scaleFactor}rem`;

  const showTooltipFn = (e: { currentTarget: HTMLElement; message?: string }) => {
    let target = e.currentTarget;
    if (target.id === 'book-stack') return;
    if (target.id === 'book-stack-svg') target = target.parentNode as HTMLElement;

    const test = document.getElementById('text-test-2') as HTMLElement;
    test.style.fontSize = getTooltipFontSize();
    test.style.padding = getTooltipPaddingX();
    test.innerHTML = e.message ?? target.getAttribute('name') ?? '';
    const width = test.clientWidth + 1;
    let extraStyles: React.CSSProperties = {};
    let left = parseInt(target.style.left) + (target.clientWidth - width) / 2 + 'px';
    if (parseInt(target.style.left) + width > C.CANVAS_WIDTH)
      left = `calc(${C.CANVAS_WIDTH - width}px - ${getTooltipPaddingY()} * 1.5)`;
    if (parseInt(target.style.left) <= (width - target.clientWidth) / 2) {
      if (left[0] === 'c') {
        extraStyles = {
          width: `calc(${C.CANVAS_WIDTH}px - ${getTooltipPaddingY()} * 2.5)`,
          whiteSpace: 'normal',
          lineHeight: 'normal'
        };
      }
      left = `calc(${getTooltipPaddingX()} * 1)`;
    }

    setShowTooltip(true);
    setTooltip({
      contents: e.message ?? target.getAttribute('name') ?? (target.id === 'book-stack' ? OBJECTS['book-stack'].name : '') ?? (target.id === 'jiri-soul' ? OBJECTS['jiri-soul'].name : '') ?? '',
      left,
      top: `calc(${parseInt(target.style.top) - target.clientHeight * 0.1}px - ${(C.TOOLTIP_FONT_SIZE + C.TOOLTIP_PADDING * 2.5) / scaleFactor}rem)`,
      extraStyles,
      white: !!e.message
    });
  };

  const hideTooltip = () => setShowTooltip(false);

  const handleMousemove = (e: MouseEvent) => {
    setCursorPos({ x: e.pageX, y: e.pageY });
  };

  const displayWelcomeMessage = () => {
    window.removeEventListener('scroll', handleScroll);
    setCookie('hasVisited', true, { path: '/' });

    const jiriSoul = document.getElementById('jiri-soul');
    if (!jiriSoul) return;

    showTooltipFn({
      currentTarget: jiriSoul,
      message: 'Welcome to Jiri\'s Domain! Click on the stuffs to get cool info!'
    });
    setTimeout(hideTooltip, 5000);
  };

  const handleScroll = () => {
    if (window.pageYOffset > C.getBottomScrollPos() * 0.9)
      setTimeout(displayWelcomeMessage, 2000);
  };

  useEffect(() => {
    if (!abouts['jiri-soul'].text)
      dispatch(fetchAboutTexts());

    setBookShadow(C.calculateBookShadow('.book--tiny'));

    if (!isMobile) {
      if (!cookies.hasVisited)
        window.addEventListener('scroll', handleScroll);
      document.addEventListener('mousemove', handleMousemove);

      const creatureId = setInterval(generateCreature, 6000);
      const cloudId = setInterval(generateMusicCloud, 5000);

      return () => {
        if (!cookies.hasVisited) window.removeEventListener('scroll', handleScroll);
        document.removeEventListener('mousemove', handleMousemove);
        clearInterval(creatureId);
        clearInterval(cloudId);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle zoomIn changes (equivalent to componentDidUpdate for zoomIn)
  useEffect(() => {
    if (prevZoomIn.current !== zoomIn) {
      prevZoomIn.current = zoomIn;
      if (zoomIn && currentPage.popup?.id) {
        // Scoped to .landscape-object because the navbar's "gallery" nav item
        // also uses id="gallery", and a plain #id selector would pick that up instead.
        const obj = document.querySelector<HTMLImageElement & HTMLDivElement>(`.landscape-object#${currentPage.popup.id}`);
        if (!obj) return;
        setPageName(obj.getAttribute('name'));
        updateZoomData({
          left: parseFloat(obj.style.left),
          top: parseFloat(obj.style.top),
          width: obj.naturalWidth || parseFloat(obj.style.width),
          height: obj.naturalHeight || parseFloat(obj.style.width)
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomIn]);

  useEffect(() => {
    setPageName();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tooltip]);

  const getPupilTranslation = (): React.CSSProperties => {
    if (!cursorPos.x || !cursorPos.y) return {};
    const { x, y } = cursorPos;
    const soul = OBJECTS['jiri-soul'];
    const soulClientX = ((( soul.left ?? 0) + (soul.width ?? 0) / 2) / C.CANVAS_WIDTH) * document.documentElement.clientWidth;
    const soulClientY = C.getDocHeight() - (((C.CANVAS_HEIGHT - (soul.top ?? 0) + (soul.height ?? 0) * 0.8) / C.CANVAS_HEIGHT)) * C.getDocHeight();

    let left: number, top: number;
    if (x < soulClientX)
      left = C.mapRange(x, 0, soulClientX, -15 * C.CANVAS_SCALE, 0);
    else
      left = C.mapRange(x, soulClientX, document.documentElement.clientWidth, 0, 5 * C.CANVAS_SCALE);

    if (y < soulClientY)
      top = C.mapRange(y, 0, soulClientY, -15 * C.CANVAS_SCALE, 0);
    else
      top = C.mapRange(y, soulClientY, C.getDocHeight(), 0, 15 * C.CANVAS_SCALE);

    return { left, top };
  };

  const zoomPopup = (id: string, type: 'text' | 'about' | 'gallery' | 'memories') => {
    dispatch(changePage({
      popup: { type, id, text: abouts[id]?.text }
    }));
  };

  const updateZoomData = (zoomRegion: { left: number; top: number; width: number; height: number }) => {
    const innerWidth = window.innerWidth;
    const sampleWidth = window.innerHeight / innerWidth > zoomRegion.height / zoomRegion.width;
    const sf = sampleWidth
      ? (innerWidth / zoomRegion.width * 0.9)
      : (window.innerHeight / zoomRegion.height * 0.9);

    const xOffset = -zoomRegion.left;
    const yOffset = (C.CANVAS_HEIGHT * sf - zoomRegion.top * sf - window.innerHeight) / sf;

    let xOffsetExtra = sampleWidth ? zoomRegion.width * 0.05
      : (innerWidth / window.innerHeight) * zoomRegion.height / 2 - zoomRegion.width / 2;
    let yOffsetExtra = sampleWidth ? (window.innerHeight / innerWidth) * zoomRegion.width / 2 - zoomRegion.height / 2
      : zoomRegion.width * 0.05;

    const canvasWidthDiff = zoomRegion.left + (sampleWidth ? zoomRegion.width : (innerWidth / window.innerHeight) * zoomRegion.height) - C.CANVAS_WIDTH;
    if (canvasWidthDiff > 0) xOffsetExtra = 1 / 0.9 * canvasWidthDiff;
    const canvasWidthDiff2 = zoomRegion.left - xOffsetExtra;
    if (canvasWidthDiff2 < 0) xOffsetExtra += canvasWidthDiff2;
    const canvasHeightDiff = zoomRegion.top + (sampleWidth ? (window.innerHeight / innerWidth) * zoomRegion.width : zoomRegion.height) - C.CANVAS_HEIGHT;
    if (canvasHeightDiff > 0) yOffsetExtra = 1 / (1920 / window.innerWidth * 0.2) * canvasHeightDiff;

    setZoomScale(sf);
    setZoomTranslation(`translate(${xOffset + xOffsetExtra}px, ${yOffset + yOffsetExtra}px)`);
  };

  const getTransformation = () => zoomIn
    ? `scale(${zoomScale}) ${zoomTranslation}`
    : `scale(${scaleFactor})`;

  const getBlur = () => zoomIn ? C.BASE_ZOOM_BLUR / zoomScale : 0;

  const handleObjectClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    const id = e.currentTarget.id;
    switch (id) {
      case 'gallery':
        scrollDown(true, () => zoomPopup(id, 'gallery'));
        return;
      case 'well-of-memories':
        scrollDown(true, () => zoomPopup(id, 'memories'));
        return;
      case 'contact-details':
      case 'jiri-soul':
        scrollDown(true, () => zoomPopup(id, 'text'));
        return;
      case 'future-building':
      case 'hobby-heap':
      case 'octopus-tree':
      case 'spiral-tower':
      case 'groove-grove':
        scrollDown(true, () => zoomPopup(id, 'about'));
        return;
      case 'book-stack':
        scrollDown(true, () => dispatch(changePage({ landscape: 2 })));
        return;
      default:
        throw new Error('id of the thing you clicked on seems invalid');
    }
  };

  const generateCreature = () => {
    const creatureId = Math.random();
    const creatureTypes = Object.keys(CREATURES) as Array<'air' | 'ground'>;
    const creatureType = creatureTypes[Math.round(Math.random() * creatureTypes.length - 0.5)];
    const creatureSpecies = CREATURES[creatureType][Math.round(creatureId * CREATURES[creatureType].length - 0.5)];
    let style: { left: number; top: number };
    let timeout: number;

    switch (creatureType) {
      case 'ground':
        style = {
          left: C.mapRange(Math.random(), 0, 1, 915 * C.CANVAS_SCALE, 1150 * C.CANVAS_SCALE),
          top: C.mapRange(Math.random(), 0, 1, 4100 * C.CANVAS_SCALE, 4300 * C.CANVAS_SCALE)
        };
        timeout = 10000;
        break;
      case 'air':
        style = {
          left: Math.random() * C.CANVAS_WIDTH * 0.5,
          top: Math.random() * C.CANVAS_HEIGHT * 0.6
        };
        timeout = 20000;
        break;
    }

    const creatureTimeoutId = setTimeout(() =>
      setActiveCreatures(prev => prev.filter(c => c.id !== creatureId)),
      timeout + 1000
    );

    setActiveCreatures(prev => [...prev, {
      id: creatureId,
      type: creatureType,
      species: creatureSpecies,
      style,
      timeoutId: creatureTimeoutId
    }]);
  };

  const generateMusicCloud = () => {
    const cloudId = Math.random();
    const cloudNumber = Math.round(Math.random() * 3 - 0.5) + 1;
    const chimneyCoords = C.TECH_CLOUD_START_POSITIONS[Math.round(Math.random() * 3 - 0.5)];
    const iconImage = MUSIC_NOTES[Math.round(Math.random() * MUSIC_NOTES.length - 0.5)];

    const musicCloudTimeoutId = setTimeout(() =>
      setActiveMusicClouds(prev => prev.filter(c => c.id !== cloudId)),
      11000
    );

    setActiveMusicClouds(prev => [...prev, {
      id: cloudId,
      cloudNumber,
      iconImage,
      style: chimneyCoords,
      timeoutId: musicCloudTimeoutId
    }]);
  };

  return (
    <div
      ref={ref}
      id="landscape-variant-container--1"
      className="bottom-container landscape-variant-container landscape--1"
      style={{
        transform: getTransformation(),
        height: C.CANVAS_HEIGHT, width: C.CANVAS_WIDTH,
        filter: `blur(${getBlur()}px)`
      }}
    >
      <div className="rel-container">
        <h2 className="landscape-name"> ABOUT </h2>
        <img src={landscape1Img} className="landscape" id="landscape-1" alt="landscape 1" />

        {abouts['jiri-soul'] &&
          Object.values(abouts).map(obj => {
            if (obj.left === undefined || obj.top === undefined) return null;
            const commonProps = {
              id: obj.id,
              name: obj.name,
              className: 'landscape-object',
              style: { left: obj.left, top: obj.top } as React.CSSProperties,
              onClick: handleObjectClick,
              onMouseOver: obj.id === 'book-stack' ? undefined : (e: React.MouseEvent<HTMLElement>) => showTooltipFn({ currentTarget: e.currentTarget }),
              onMouseOut: obj.id === 'book-stack' ? undefined : hideTooltip
            };

            if (obj.id === 'book-stack') {
              return (
                <div key={obj.id} {...commonProps} style={{ ...commonProps.style, width: obj.width, height: obj.height }}>
                  {projects.map((p, i) =>
                    <img
                      src={boxDarkSmall}
                      className="book--tiny"
                      key={`book--tiny-${i}`}
                      id={`book--tiny-${i}`}
                      alt="book"
                      style={{
                        height: C.TINY_BOOK_HEIGHT * C.CANVAS_SCALE,
                        width: C.TINY_BOOK_HEIGHT * C.CANVAS_SCALE * p.book.width,
                        top: C.TINY_BOOK_HEIGHT * C.CANVAS_SCALE * p.book.yOffset,
                        left: C.TINY_BOOK_HEIGHT * C.CANVAS_SCALE * p.book.xOffset,
                        filter: `brightness(${p.book.tintDeviation})`
                      }}
                    />
                  )}
                  <svg
                    width={obj.width} height={obj.height}
                    id="book-stack-svg"
                    onMouseOver={(e) => showTooltipFn({ currentTarget: e.currentTarget as unknown as HTMLElement })}
                    onMouseOut={hideTooltip}
                  >
                    <path d={bookShadow ?? undefined} fill="none" id="book-stack-hitbox"/>
                    <path d={bookShadow ?? undefined} className="shadow book-stack-shadow--1" fill="black"/>
                  </svg>
                </div>
              );
            } else if (obj.id === 'jiri-soul') {
              return (
                <div key={obj.id} {...commonProps} style={{ ...commonProps.style, width: obj.width, height: obj.height }}>
                  <img id="jiri-soul__container" src={getObjectImage(obj.id, obj.extension)} alt="jiri soul container" />
                  <img id="jiri-soul__pupils" src={getObjectImage('jiri-soul-pupils', 'png')} alt="jiri soul pupils"
                    style={getPupilTranslation()}
                  />
                </div>
              );
            } else if (obj.id === 'well-of-memories') {
              return (
                <div key={obj.id} {...commonProps}>
                  <img id="well-of-memories__sprite" src={getObjectImage(obj.id, obj.extension)} alt="well of memories" />
                  <div id="well-of-memories__shine" aria-hidden="true" />
                </div>
              );
            } else {
              return (
                <img key={obj.id} {...commonProps} src={getObjectImage(obj.id, obj.extension)} alt={obj.id} />
              );
            }
          })
        }

        <CSSTransition
          nodeRef={tooltipNodeRef}
          in={showTooltip}
          classNames="tooltip"
          unmountOnExit
          timeout={500}
        >
          <p
            ref={tooltipNodeRef}
            className={`tooltip ${tooltip?.white ? 'tooltip__white' : 'tooltip__black'}`}
            style={{
              left: tooltip?.left,
              top: tooltip?.top,
              fontSize: `${C.TOOLTIP_FONT_SIZE / scaleFactor}rem`,
              padding: `${getTooltipPaddingY()} ${getTooltipPaddingX()}`,
              ...(tooltip?.extraStyles)
            }}
          >
            {tooltip?.contents}
          </p>
        </CSSTransition>

        <div>
          {activeCreatures.map(cr =>
            <img
              src={getCreatureImage(cr.species)}
              className={`creature ${cr.type}-creature ${cr.species}`}
              alt={cr.species}
              style={cr.style}
              key={cr.id}
            />
          )}
        </div>
        <div>
          {activeMusicClouds.map(cloud =>
            <div className="music-cloud-container" style={cloud.style} key={cloud.id}>
              <img src={getTechImage(cloud.iconImage)} className="music-cloud__icon" alt="technology icon" />
              <img src={getCloudImage(cloud.cloudNumber)} className="music-cloud__cloud" alt="tech cloud" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default Landscape1;
