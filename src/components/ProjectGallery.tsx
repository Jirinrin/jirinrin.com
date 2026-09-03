import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';

import backArrow from '../assets/back-arrow.png';
import { usePinchZoom } from '../hooks/usePinchZoom';

interface ProjectGalleryProps {
  images: string[];
  getImage: (img: string) => string;
}

interface FullscreenImageProps {
  src: string;
  onClose: () => void;
}

// Remounted (via `key`) every time the current image changes, so each image
// always opens back up at scale 1 - no stale zoom/pan carried over from the
// previous picture.
function FullscreenImage({ src, onClose }: FullscreenImageProps) {
  const pinch = usePinchZoom();

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const distance = Math.hypot(info.offset.x, info.offset.y);
    const velocity = Math.hypot(info.velocity.x, info.velocity.y);
    if (distance > 110 || velocity > 550) onClose();
  };

  return (
    <motion.div
      className="project-gallery-fullscreen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onClick={onClose}
    >
      <motion.img
        src={src}
        alt=""
        className="project-gallery-fullscreen__image"
        drag={!pinch.isZoomed}
        dragElastic={0.65}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={pinch.style}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        {...pinch.handlers}
      />
      <button type="button" className="project-gallery-fullscreen__close" onClick={onClose} aria-label="Close">×</button>
    </motion.div>
  );
}

function ProjectGallery({ images, getImage }: ProjectGalleryProps) {
  // Direction travels alongside the index so the crossfade/slide knows which
  // way to animate in and out - a plain index alone can't tell "went to 0
  // via next" from "went to 0 via prev".
  const [[index, direction], setState] = useState<[number, number]>([0, 0]);
  const [fullscreen, setFullscreen] = useState(false);

  const go = (delta: number) =>
    setState(([i]) => [(i + delta + images.length) % images.length, delta]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (fullscreen && e.key === 'Escape') setFullscreen(false);
      if (images.length <= 1) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, fullscreen]);

  if (images.length === 0) return null;

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -80 || info.velocity.x < -400) go(1);
    else if (info.offset.x > 80 || info.velocity.x > 400) go(-1);
  };

  return (
    <div className="project-gallery" onClick={e => e.stopPropagation()}>
      <div className="project-gallery__viewport">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={index}
            src={getImage(images[index])}
            alt=""
            className="project-gallery__image"
            drag={images.length > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            onTap={() => setFullscreen(true)}
            custom={direction}
            initial={{ opacity: 0, x: direction < 0 ? -60 : 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction < 0 ? 60 : -60 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
          />
        </AnimatePresence>

        {images.length > 1 && (
          <>
            <button
              type="button"
              className="project-gallery__nav project-gallery__nav--prev"
              onClick={() => go(-1)}
              aria-label="Previous image"
            >
              <img src={backArrow} alt="" />
            </button>
            <button
              type="button"
              className="project-gallery__nav project-gallery__nav--next"
              onClick={() => go(1)}
              aria-label="Next image"
            >
              <img src={backArrow} alt="" />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="project-gallery__dots">
          {images.map((_, i) => (
            <span
              key={i}
              className={`project-gallery__dot${i === index ? ' project-gallery__dot--active' : ''}`}
              onClick={() => setState([i, i > index ? 1 : -1])}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {fullscreen && (
          <FullscreenImage
            key={index}
            src={getImage(images[index])}
            onClose={() => setFullscreen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProjectGallery;
