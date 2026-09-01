import React, { forwardRef, useEffect, useState } from 'react';

import * as C from '../constants';
import { fetchProjectDescriptions } from '../store/projectsSlice';
import { changePage } from '../store/currentPageSlice';
import { useAppDispatch, useAppSelector } from '../store';

import boxDarkSmall from '../assets/box-dark-small.png';
import landscape2Img from '../assets/landscape/landscape-2.png';

interface Landscape2Props {
  scaleFactor: number;
  zoomInCanvas: (scroll?: number) => void;
  zoomOutCanvas: () => void;
  zoomIn: boolean;
  bottom: number;
  scrollDown: (smooth?: boolean, callback?: () => void) => void;
}

interface OpenedBook {
  book: HTMLElement;
  title: string;
  style: {
    left: string;
    top: string;
    width: string;
    height: string;
  };
  imageFilter: string;
}

const Landscape2 = forwardRef<HTMLDivElement, Landscape2Props>(function Landscape2({ scaleFactor, zoomInCanvas, zoomIn, bottom, scrollDown }: Landscape2Props, ref) {
  const dispatch = useAppDispatch();
  const projects = useAppSelector(state => state.projects);

  const [bookHeight] = useState(C.LARGE_BASE_BOOK_HEIGHT);
  const [openedBook, setOpenedBook] = useState<OpenedBook | null>(null);
  const [bookShadow, setBookShadow] = useState<string | null>(null);

  useEffect(() => {
    if (!projects[0].description)
      dispatch(fetchProjectDescriptions());
    setBookShadow(C.calculateBookShadow('.book--large'));
    scrollDown();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (openedBook) zoomInCanvas(window.pageYOffset);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedBook]);

  useEffect(() => {
    if (openedBook && zoomIn) {
      zoomInBook();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomIn]);

  useEffect(() => {
    if (!zoomIn) setOpenedBook(null);
  }, [zoomIn]);

  const getPadding = () => bookHeight * C.LARGE_BOOK_PADDING_PART;
  const getCoverFontSize = () => bookHeight - getPadding() * 2;
  const getTextWidth = (baseWidth: number) => baseWidth * getCoverFontSize() + getPadding() * 2;

  const getStackWidthRange = (): [number, number] => {
    const range: [number, number] = [0, 0];
    projects.forEach(p => {
      if (p.book.xOffset < range[0]) range[0] = p.book.xOffset;
      if (p.book.xOffset + p.book.width > range[1]) range[1] = p.book.xOffset + p.book.width;
    });
    return range;
  };

  const getStackWidth = () => {
    const range = getStackWidthRange();
    return getTextWidth(range[1] - range[0]);
  };

  const setupBookZoom = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    setOpenedBook({
      book: el,
      title: el.getElementsByTagName('p')[0].innerHTML,
      style: {
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
      },
      imageFilter: (el.getElementsByTagName('img')[0] as HTMLImageElement).style.filter,
    });
  };

  const zoomInBook = () => {
    const zoomBook = document.querySelector<HTMLElement>('#zooming-book');
    if (!zoomBook) return;
    const bookStack = zoomBook.parentNode?.parentNode as HTMLElement;
    if (!bookStack) return;

    const width = window.innerWidth;
    // The book grows into the same rect .popup-window/.popup-window-large
    // settles into (see Landscape.scss), but a bit larger all around so it
    // reads as a 'frame' the modal is being read inside of: FRAME_VW wider
    // on each side, both horizontally and vertically. Derive the book's own
    // width/height/offsets straight from the modal's own width/height
    // expressions (rather than hand-computed constants) so this stays
    // correct even where the modal's max-height/max-width caps kick in
    // above the 1400px breakpoint - keep modalWidthExpr/modalHeightExpr in
    // sync with .popup-window-large in Landscape.scss whenever it changes.
    const isMobile = width < 1000;
    const FRAME_VW = isMobile ? 5 : 3;
    const modalWidthExpr = isMobile ? '80vw'
      : width < 1400 ? '85vw'
      : 'min(85vw, 1400px)';
    const modalHeightExpr = isMobile ? 'calc(100vh - 23vw)'
      : width < 1400 ? 'calc(100vh - 20vw)'
      : 'min(calc(100vh - 15vw), 1000px)';

    const bookWidthExpr = `calc(${modalWidthExpr} + ${2 * FRAME_VW}vw)`;
    const bookHeightExpr = `calc(${modalHeightExpr} + ${2 * FRAME_VW}vw)`;
    // Half of the book's own top+bottom margin (modal's margin shrunk by
    // FRAME_VW on each side) - used below to vertically center the book the
    // same way the modal centers itself with `margin: auto auto`.
    const bookHalfMarginExpr = `calc((100vh - ${modalHeightExpr}) / 2 - ${FRAME_VW}vw)`;
    // How far the book's left edge sits from the viewport's left edge so it
    // ends up centered like the modal, just FRAME_VW further out.
    const leftOffsetExpr = `calc((100vw - ${modalWidthExpr}) / 2 - ${FRAME_VW}vw)`;

    zoomBook.style.left   = `calc(-1 * ${bookStack.style.left} + (${leftOffsetExpr}) / ${scaleFactor})`;
    zoomBook.style.top    = `calc(-1 * ${bookStack.style.top.split('calc')[1]} + ${C.CANVAS_HEIGHT}px - (100vh - ${bookHalfMarginExpr}) / ${scaleFactor} - ${bottom / scaleFactor}px)`;
    zoomBook.style.width  = `calc((${bookWidthExpr}) / ${scaleFactor})`;
    zoomBook.style.height = `calc((${bookHeightExpr}) / ${scaleFactor})`;
    zoomBook.className += ' book--large__zoomed';

    // img.book--large__background's border-radius (see Landscape.scss) is
    // set in pre-transform px and so shrinks visually with scaleFactor -
    // fine for the small stack thumbnails, but on mobile scaleFactor is
    // small enough that the now much bigger zoomed frame reads as barely
    // rounded at all. Bump it here to a bigger on-screen radius, corrected
    // back by scaleFactor the same way width/height are above.
    if (isMobile) {
      const bookImg = zoomBook.querySelector<HTMLImageElement>('img.book--large__background');
      if (bookImg) bookImg.style.borderRadius = `${20 / scaleFactor}px`;
    }

    const project = projects.find(p => openedBook && p.id === openedBook.book.id);
    if (!project) return;

    dispatch(changePage({
      popup: { type: 'project', project }
    }));
  };

  return (
    <div
      ref={ref}
      id="landscape-variant-container--2"
      className="bottom-container landscape-variant-container landscape--2"
      style={{
        transform: `scale(${scaleFactor}, ${scaleFactor})`,
        height: C.CANVAS_HEIGHT, width: C.CANVAS_WIDTH,
        bottom: -bottom
      }}
    >
      <div className="rel-container">
        <h2 className="landscape-name"> PROJECTS </h2>
        <img src={landscape2Img} className="landscape" id="landscape-2" alt="landscape 2" />

        <div
          id="book-stack--large"
          style={{
            left: C.LARGE_BOOK_BASE_LEFT,
            top: `calc(${C.LARGE_BOOK_BASE_BOTTOM}px - ${projects.length * bookHeight}rem)`,
            width: getStackWidth() + 'rem',
            height: bookHeight * projects.length + 'rem'
          }}
        >
          <div className="rel-container">
            {projects.map((p, i) =>
              <div
                className="book--large"
                key={`book--large-${i}`}
                id={p.id}
                style={{
                  height: bookHeight * 1.01 + 'rem',
                  width: getTextWidth(p.book.width) + 'rem',
                  top: p.book.yOffset * bookHeight + 'rem',
                  left: getTextWidth(p.book.xOffset) + 'rem'
                }}
                onClick={setupBookZoom}
              >
                <div className="rel-container">
                  <img
                    src={boxDarkSmall}
                    alt="book"
                    className="book--large__background"
                    style={{ filter: `brightness(${p.book.tintDeviation})` }}
                  />
                  <p
                    className="book--large__title"
                    style={{
                      fontSize: getCoverFontSize() + 'rem',
                      lineHeight: getCoverFontSize() * 1.2 + 'rem',
                    }}
                  >
                    <span className={`${p.book.tintDeviation < 1.5 ? 'dark-background' : (p.book.tintDeviation > 2.5 ? 'white-background' : '')}`}>
                      {p.title}
                    </span>
                  </p>
                </div>
              </div>
            )}
            {openedBook &&
              <div
                id="zooming-book"
                className="book--large book--large__zoomed"
                style={{
                  ...openedBook.style,
                  height: bookHeight * 1.01 + 'rem',
                }}
              >
                <div className="rel-container">
                  <img
                    src={boxDarkSmall}
                    alt="book"
                    className="book--large__background"
                    style={{ filter: openedBook.imageFilter }}
                  />
                </div>
              </div>
            }
            <div id="shadow-wrapper">
              <svg
                viewBox={`0 0 ${getStackWidth()} ${bookHeight * projects.length}`}
                width={getStackWidth() + 'rem'}
                height={bookHeight * projects.length + 'rem'}
                id="book-stack-svg">
                <path d={bookShadow ?? undefined} className="shadow book-stack-shadow--2" fill="black"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default Landscape2;
