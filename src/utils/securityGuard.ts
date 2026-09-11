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
  // Disabled auto-redirect traps to prevent false positives in iframe preview, mobile view, and browser extensions
  return () => {};
}
