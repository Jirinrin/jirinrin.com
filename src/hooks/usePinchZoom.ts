import { useRef, useState } from 'react';

// Tracks pinch-to-zoom and (once zoomed) single-finger panning on a
// fullscreen image/video. Kept deliberately separate from framer-motion's own
// `drag` gesture (used for swipe-to-dismiss/swipe-to-navigate), which should
// only be enabled while this reports scale === 1, so the two never fight over
// the same touches.
export function usePinchZoom() {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [pinching, setPinching] = useState(false);
  const gesture = useRef<{
    mode: 'none' | 'pinch' | 'pan';
    startDist?: number;
    startScale?: number;
    lastX?: number;
    lastY?: number;
  }>({ mode: 'none' });

  const touchDistance = (touches: React.TouchList) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length >= 2) {
      setPinching(true);
      gesture.current = { mode: 'pinch', startDist: touchDistance(e.touches), startScale: transform.scale };
    } else if (e.touches.length === 1 && transform.scale > 1.02) {
      gesture.current = { mode: 'pan', lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (g.mode === 'pinch' && e.touches.length >= 2 && g.startDist) {
      const ratio = touchDistance(e.touches) / g.startDist;
      const scale = Math.min(4, Math.max(1, g.startScale! * ratio));
      setTransform(t => ({ ...t, scale }));
    } else if (g.mode === 'pan' && e.touches.length === 1 && g.lastX !== undefined) {
      const dx = e.touches[0].clientX - g.lastX;
      const dy = e.touches[0].clientY - g.lastY!;
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
      g.lastX = e.touches[0].clientX;
      g.lastY = e.touches[0].clientY;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length >= 2) return;
    setPinching(false);
    if (e.touches.length === 1) {
      gesture.current = { mode: 'pan', lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
    } else {
      gesture.current = { mode: 'none' };
      setTransform(t => (t.scale <= 1.02 ? { scale: 1, x: 0, y: 0 } : t));
    }
  };

  return {
    scale: transform.scale,
    style: { scale: transform.scale, x: transform.x, y: transform.y },
    isZoomed: transform.scale > 1.02 || pinching,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
