import { useEffect, useRef } from 'react';

/**
 * Tracks iOS virtual keyboard open/close state via CSS custom properties.
 * Does NOT scroll text inputs — iOS handles that natively.
 * Only manages --keyboard-height and .keyboard-open class on <html>.
 */
export function useKeyboardAware() {
  const originalViewportHeight = useRef<number>(0);

  useEffect(() => {
    originalViewportHeight.current = window.visualViewport?.height ?? window.innerHeight;

    function handleViewportResize() {
      const vp = window.visualViewport;
      if (!vp) return;

      const keyboardHeight = originalViewportHeight.current - vp.height;
      const isKeyboardOpen = keyboardHeight > 100;

      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${Math.max(keyboardHeight, 0)}px`
      );

      if (isKeyboardOpen) {
        document.documentElement.classList.add('keyboard-open');
      } else {
        document.documentElement.classList.remove('keyboard-open');
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      }
      document.documentElement.classList.remove('keyboard-open');
      document.documentElement.style.removeProperty('--keyboard-height');
    };
  }, []);
}
