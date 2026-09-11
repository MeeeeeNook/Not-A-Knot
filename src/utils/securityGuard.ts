import { getAdminSession } from './auth';

const RICKROLL_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

/**
 * Checks whether the current user is an authenticated admin.
 * Admins are exempt from DevTools inspection traps.
 */
export function isUserAdmin(): boolean {
  try {
    const session = getAdminSession();
    return Boolean(session && session.username);
  } catch {
    return false;
  }
}

/**
 * Triggers instant redirection to the Rickroll URL
 */
export function triggerRickrollRedirect(): void {
  // If user is authenticated as an admin, do not redirect
  if (isUserAdmin()) return;

  try {
    if (typeof window !== 'undefined') {
      // Clear page content immediately
      if (document.body) {
        document.body.innerHTML = '<div style="background:#000;color:#fff;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;font-weight:bold;font-size:18px;">Đang bảo vệ dữ liệu...</div>';
      }
      try {
        if (window.top && window.top !== window) {
          window.top.location.href = RICKROLL_URL;
          return;
        }
      } catch {}
      window.location.replace(RICKROLL_URL);
    }
  } catch {
    if (typeof window !== 'undefined') {
      window.location.href = RICKROLL_URL;
    }
  }
}

/**
 * Sets up anti-inspection and DevTools protection for non-admin visitors.
 * Allows normal right-click interactions, but actively detects when the DevTools /
 * Inspector panel is actually opened (via inspect, menu, or shortcuts) and redirects immediately.
 */
export function initDevToolsProtection(): () => void {
  if (typeof window === 'undefined') return () => {};

  let lastContextMenuTime = 0;

  // 1. Keyboard Shortcut Listener (F12, Ctrl+Shift+I/J/C, Cmd+Option+I/J/C, Ctrl+U)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (isUserAdmin()) return;

    const isF12 = e.key === 'F12' || e.keyCode === 123;
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const isAlt = e.altKey;

    // F12 key
    if (isF12) {
      e.preventDefault();
      e.stopPropagation();
      triggerRickrollRedirect();
      return;
    }

    // Ctrl+Shift+I / Cmd+Option+I (Inspect)
    if (
      (isCtrlOrMeta && isShift && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) ||
      (isCtrlOrMeta && isAlt && (e.key === 'I' || e.key === 'i' || e.keyCode === 73))
    ) {
      e.preventDefault();
      e.stopPropagation();
      triggerRickrollRedirect();
      return;
    }

    // Ctrl+Shift+J / Cmd+Option+J (Console)
    if (
      (isCtrlOrMeta && isShift && (e.key === 'J' || e.key === 'j' || e.keyCode === 74)) ||
      (isCtrlOrMeta && isAlt && (e.key === 'J' || e.key === 'j' || e.keyCode === 74))
    ) {
      e.preventDefault();
      e.stopPropagation();
      triggerRickrollRedirect();
      return;
    }

    // Ctrl+Shift+C / Cmd+Option+C (Inspect Element)
    if (
      (isCtrlOrMeta && isShift && (e.key === 'C' || e.key === 'c' || e.keyCode === 67)) ||
      (isCtrlOrMeta && isAlt && (e.key === 'C' || e.key === 'c' || e.keyCode === 67))
    ) {
      e.preventDefault();
      e.stopPropagation();
      triggerRickrollRedirect();
      return;
    }

    // Ctrl+U / Cmd+Option+U (View Source)
    if (
      (isCtrlOrMeta && (e.key === 'U' || e.key === 'u' || e.keyCode === 85)) ||
      (isCtrlOrMeta && isAlt && (e.key === 'U' || e.key === 'u' || e.keyCode === 85))
    ) {
      e.preventDefault();
      e.stopPropagation();
      triggerRickrollRedirect();
      return;
    }
  };

  // 2. Context Menu Listener (Tracks when user opens right-click menu to click "Inspect")
  const handleContextMenu = () => {
    if (isUserAdmin()) return;
    lastContextMenuTime = Date.now();

    // Prepare a console getter trap specifically for right-click inspect
    try {
      const img = new Image();
      Object.defineProperty(img, 'id', {
        get: function () {
          if (!isUserAdmin()) {
            triggerRickrollRedirect();
          }
          return 'inspect-trap';
        },
        configurable: true
      });
      console.log('%c', img);
    } catch {}
  };

  // 3. DevTools Open Detection on Window Resize
  // Only checks when DevTools panel actually docks/opens after right click or explicit action
  const handleResize = () => {
    if (isUserAdmin()) return;

    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const isRecentlyRightClicked = Date.now() - lastContextMenuTime < 10000;

    // High threshold (>200px) combined with recent right-click or significant dock size
    if ((widthDiff > 220 || heightDiff > 220) && isRecentlyRightClicked) {
      triggerRickrollRedirect();
    }
  };

  // Attach Listeners
  window.addEventListener('keydown', handleKeyDown, { capture: true });
  document.addEventListener('keydown', handleKeyDown, { capture: true });
  window.addEventListener('contextmenu', handleContextMenu, { capture: true });
  window.addEventListener('resize', handleResize);

  // Cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
    document.removeEventListener('keydown', handleKeyDown, { capture: true });
    window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    window.removeEventListener('resize', handleResize);
  };
}
