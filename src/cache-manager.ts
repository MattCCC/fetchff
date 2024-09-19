/* eslint-disable @typescript-eslint/no-explicit-any */
import { hash } from './hash';
import { fetchf } from './index';
import type { RequestConfig } from './types/request-handler';
import type { CacheEntry } from './types/cache-manager';
import { OBJECT } from './const';
import { formDataToString, shallowSerialize, sortObject } from './utils';

const cache = new Map<string, CacheEntry<any>>();

/**
 * Generates a cache key for a given URL and fetch options, ensuring that key factors
 * like method, headers, body, and other options are included in the cache key.
 * Headers and other objects are sorted by key to ensure consistent cache keys.
 *
 * @param options - The fetch options that may affect the request. The most important are:
 *   @property {string} [method="GET"] - The HTTP method (GET, POST, etc.).
 *   @property {HeadersInit} [headers={}] - The request headers.
 *   @property {BodyInit | null} [body=""] - The body of the request (only for methods like POST, PUT).
 *   @property {RequestMode} [mode="cors"] - The mode for the request (e.g., cors, no-cors, same-origin).
 *   @property {RequestCredentials} [credentials="same-origin"] - Whether to include credentials like cookies.
 *   @property {RequestCache} [cache="default"] - The cache mode (e.g., default, no-store, reload).
 *   @property {RequestRedirect} [redirect="follow"] - How to handle redirects (e.g., follow, error, manual).
 *   @property {string} [referrer=""] - The referrer URL to send with the request.
 *   @property {string} [integrity=""] - Subresource integrity value (a cryptographic hash for resource validation).
 * @returns {string|null} - A unique cache key based on the URL and request options. Null if cache is to be burst.
 *
 * @example
 * const cacheKey = generateCacheKey({
 *   url: 'https://api.example.com/data',
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ name: 'Alice' }),
 *   mode: 'cors',
 *   credentials: 'include',
 * });
 * console.log(cacheKey);
 */
export function generateCacheKey(options: RequestConfig = {}): string | null {
  const {
    url = '',
    method = 'GET',
    headers = {},
    body = '',
    mode = 'cors',
    credentials = 'same-origin',
    cache = 'default',
    redirect = 'follow',
    referrer = '',
    integrity = '',
  } = options;

  // Bail early if cache should be burst
  if (cache === 'reload') {
    return null;
  }

  // Sort headers and body + convert sorted to strings for hashing purposes
  // Native serializer is on avg. 3.5x faster than a Fast Hash or FNV-1a
  const headersString = shallowSerialize(sortObject(headers));

  let bodyString = '';

  // In majority of cases we do not cache body
  if (body !== null) {
    if (typeof body === 'string') {
      bodyString = body;
    } else if (typeof body === OBJECT) {
      if (body instanceof FormData) {
        bodyString = formDataToString(body);
      } else {
        bodyString = JSON.stringify(sortObject(body));
      }
    } else if (body instanceof Blob || body instanceof File) {
      bodyString = `Blob/File:${body.size}:${body.type}`;
    } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
      bodyString = `ArrBuffer:${body.byteLength}`;
    }

    // Hash it for smaller output
    if (bodyString) {
      bodyString = hash(bodyString);
    }
  }

  // Concatenate all key parts into a cache key string
  // Template literals are apparently slower
  return (
    method +
    ':' +
    url +
    ':' +
    headersString +
    ':' +
    bodyString +
    ':' +
    mode +
    ':' +
    credentials +
    ':' +
    cache +
    ':' +
    redirect +
    ':' +
    referrer +
    ':' +
    integrity
  );
}

/**
 * Checks if the cache entry is expired based on its timestamp and the maximum stale time.
 *
 * @param {number} timestamp - The timestamp of the cache entry.
 * @param {number} maxStaleTime - The maximum stale time in seconds.
 * @returns {boolean} - Returns true if the cache entry is expired, false otherwise.
 */
function isCacheExpired(timestamp: number, maxStaleTime: number): boolean {
  return maxStaleTime && Date.now() - timestamp > maxStaleTime * 1000;
}

/**
 * Retrieves a cache entry if it exists and is not expired.
 *
 * @param {string} key Cache key to utilize
 * @param {RequestConfig} config - The request configuration object.
 * @returns {CacheEntry<T> | null} - The cache entry if it exists and is not expired, null otherwise.
 */
export function getCache<T>(
  key: string,
  config: RequestConfig,
): CacheEntry<T> | null {
  const entry = cache.get(key);

  if (entry) {
    if (!isCacheExpired(entry.timestamp, config.cacheTime)) {
      return entry;
    }

    cache.delete(key);
  }

  return null;
}

/**
 * Sets a new cache entry or updates an existing one.
 *
 * @param {string} key Cache key to utilize
 * @param {T} data - The data to be cached.
 * @param {boolean} isLoading - Indicates if the data is currently being fetched.
 */
export function setCache<T = unknown>(
  key: string,
  data: T,
  isLoading: boolean = false,
): void {
  cache.set(key, {
    data,
    isLoading,
    timestamp: Date.now(),
  });
}

/**
 * Revalidates a cache entry by fetching fresh data and updating the cache.
 *
 * @param {string} key Cache key to utilize
 * @param {RequestConfig} config - The request configuration object.
 * @returns {Promise<void>} - A promise that resolves when the revalidation is complete.
 */
export async function revalidate(
  key: string,
  config: RequestConfig = null,
): Promise<void> {
  try {
    // Fetch fresh data
    const newData = await fetchf(config.url, {
      ...config,
      cache: 'reload',
    });

    setCache(key, newData);
  } catch (error) {
    console.error(`Error revalidating ${config.url}:`, error);
  }
}

/**
 * Invalidates (deletes) a cache entry.
 *
 * @param {string} key Cache key to utilize
 */
export function deleteCache(key: string): void {
  cache.delete(key);
}

/**
 * Mutates a cache entry with new data and optionally revalidates it.
 *
 * @param {string} key Cache key to utilize
 * @param {RequestConfig} config - The request configuration object.
 * @param {T} newData - The new data to be cached.
 * @param {boolean} revalidateAfter - If true, triggers revalidation after mutation.
 */
export function mutate<T>(
  key: string,
  config: RequestConfig = null,
  newData: T,
  revalidateAfter: boolean = false,
): void {
  setCache(key, newData);

  if (revalidateAfter) {
    revalidate(key, config);
  }
}
