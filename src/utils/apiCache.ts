/**
 * Client-Side API Caching Utility
 * Implements in-memory Stale-While-Revalidate (SWR) caching with concurrent request deduplication
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  etag?: string;
}

const memoryCache = new Map<string, CacheItem<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

export interface CacheOptions {
  ttlMs?: number; // Time-to-live in milliseconds (default: 60,000ms = 1m)
  forceRefresh?: boolean; // Bypass cache and force network fetch
  tag?: string; // Tag for grouped cache invalidation
}

const taggedKeys = new Map<string, Set<string>>();

/**
 * Perform a cached fetch with in-memory SWR and deduplication
 */
export async function cachedApiFetch<T = any>(
  url: string,
  fetchOptions?: RequestInit,
  cacheOptions: CacheOptions = {}
): Promise<T> {
  const { ttlMs = 60000, forceRefresh = false, tag } = cacheOptions;
  const method = (fetchOptions?.method || 'GET').toUpperCase();

  // Non-GET requests should bypass cache and optionally invalidate tags
  if (method !== 'GET' && method !== 'HEAD') {
    const res = await fetch(url, fetchOptions);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  }

  const cacheKey = `${method}:${url}`;

  // Track tagged keys for targeted invalidation
  if (tag) {
    if (!taggedKeys.has(tag)) taggedKeys.set(tag, new Set());
    taggedKeys.get(tag)!.add(cacheKey);
  }

  // 1. Check in-flight promise to prevent duplicate requests
  if (!forceRefresh && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  // 2. Check fresh memory cache
  const cached = memoryCache.get(cacheKey);
  const now = Date.now();
  if (!forceRefresh && cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  // 3. Initiate network request
  const fetchPromise = (async () => {
    try {
      const headers = new Headers(fetchOptions?.headers || {});
      if (cached?.etag && !forceRefresh) {
        headers.set('If-None-Match', cached.etag);
      }

      const res = await fetch(url, {
        ...fetchOptions,
        headers
      });

      // 304 Not Modified -> return existing cached data
      if (res.status === 304 && cached) {
        cached.timestamp = now;
        return cached.data as T;
      }

      if (!res.ok) {
        // If network failed but we have stale cache, return stale as fallback
        if (cached) {
          console.warn(`[ApiCache] Network failed with ${res.status}, returning stale cache for ${url}`);
          return cached.data as T;
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const etag = res.headers.get('ETag') || undefined;
      const data = await res.json();

      memoryCache.set(cacheKey, {
        data,
        timestamp: now,
        etag
      });

      return data as T;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Invalidate cached items by tag
 */
export function invalidateClientCacheTag(tag: string): void {
  const keys = taggedKeys.get(tag);
  if (keys) {
    keys.forEach((k) => memoryCache.delete(k));
    keys.clear();
  }
}

/**
 * Clear entire client API cache
 */
export function clearClientApiCache(): void {
  memoryCache.clear();
  taggedKeys.clear();
}
