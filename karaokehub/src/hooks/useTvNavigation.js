import { useEffect } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable() {
  return Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null
  );
}

/**
 * When enabled, lets a TV remote's D-pad (which browsers on smart TVs and
 * streaming boxes report as ArrowUp/Down/Left/Right + Enter key events)
 * move focus around the page. Enter/Space already activate whatever's
 * focused natively, so this only needs to handle the arrow movement.
 */
export function useTvNavigation(enabled) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e) {
      const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
      if (!isArrow) return;

      const active = document.activeElement;
      const isTextEntry =
        active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

      // Let left/right move the text cursor normally inside a text field.
      if (isTextEntry && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const currentIndex = focusable.indexOf(active);
      const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
      let nextIndex;
      if (currentIndex === -1) {
        nextIndex = 0;
      } else {
        nextIndex = forward
          ? (currentIndex + 1) % focusable.length
          : (currentIndex - 1 + focusable.length) % focusable.length;
      }

      e.preventDefault();
      focusable[nextIndex]?.focus();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
