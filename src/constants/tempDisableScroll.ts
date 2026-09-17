// source: https://stackoverflow.com/questions/4770025/how-to-disable-scrolling-temporarily

// left: 37, up: 38, right: 39, down: 40,
// spacebar: 32, pageup: 33, pagedown: 34, end: 35, home: 36
const keys: Record<number, number> = {37: 1, 38: 1, 39: 1, 40: 1};

function preventDefault(e: Event) {
  e.preventDefault();
}

function preventDefaultForScrollKeys(e: KeyboardEvent) {
  if (keys[e.keyCode]) {
    preventDefault(e);
    return false;
  }
}

export function disableScroll() {
  window.addEventListener('DOMMouseScroll', preventDefault, false);
  window.onwheel = preventDefault;
  (window as Window & typeof globalThis & {onmousewheel: unknown}).onmousewheel = preventDefault;
  window.ontouchmove = preventDefault;
  document.onkeydown = preventDefaultForScrollKeys;
}

export function enableScroll() {
  window.removeEventListener('DOMMouseScroll', preventDefault, false);
  (window as Window & typeof globalThis & {onmousewheel: unknown}).onmousewheel = null;
  window.onwheel = null;
  window.ontouchmove = null;
  document.onkeydown = null;
}
