import { getAdminSession } from './auth';

/**
 * Checks whether the current user is an authenticated admin.
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
 * Redirection trigger (disabled to prevent unexpected lockouts or troll redirects)
 */
export function triggerRickrollRedirect(): void {
  // Disabled - do not block users or redirect to external sites
}

/**
 * DevTools protection (safe no-op to allow normal debugging, inspection, and preview)
 */
export function initDevToolsProtection(): () => void {
  // Safe no-op cleanup
  return () => {};
}

