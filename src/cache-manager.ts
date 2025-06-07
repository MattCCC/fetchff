/* eslint-disable @typescript-eslint/no-explicit-any */
import { hash } from './hash';
import { fetchf } from './index';
import type { FetcherConfig, FetchResponse } from './types/request-handler';
import type { CacheEntry } from './types/cache-manager';
import { GET, OBJECT, UNDEFINED } from './constants';
import { shallowSerialize, sortObject } from './utils';

const _cache = new Map<string, CacheEntry<any>>();
const DELIMITER = '|';
const MIN_LENGTH_TO_HASH = 64;

/**
 * Generates a unique cache key for a given URL and fetch options, ensuring that key factors
 * like method, headers, body, and other options are included in the cache key.
 * Headers and other objects are sorted by key to ensure consistent cache keys.
 *
 * @param {RequestConfig} options - The fetch options that may affect the request. The most important are:
 *   @property {string} [method="GET"] - The HTTP method (GET, POST, etc.).
 *   @property {HeadersInit} [headers={}] - The request headers.
 *   @property {BodyInit | null} [body=""] - The body of the request (only for methods like POST, PUT).
 *   @property {RequestMode} [mode="cors"] - The mode for the request (e.g., cors, no-cors, include).
 *   @property {RequestCredentials} [credentials="include"] - Whether to include credentials like cookies.
 *   @property {RequestCache} [cache="default"] - The cache mode (e.g., default, no-store, reload).
 *   @property {RequestRedirect} [redirect="follow"] - How to handle redirects (e.g., follow, error, manual).
 *   @property {string} [referrer=""] - The referrer URL to send with the request.
 *   @property {string} [integrity=""] - Subresource integrity value (a cryptographic hash for resource validation).
 * @returns {string} - A unique cache key based on the URL and request options. Empty if cache is to be burst.
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
export function generateCacheKey(options: RequestConfig): string {
  const {
    url = '',
    method = GET,
    headers = null,
    body = UNDEFINED,
    mode = 'cors',
    credentials = 'same-origin',
    cache = 'default',
    redirect = 'follow',
    referrer = 'about:client',
    integrity = '',
  } = options;

  // For GET requests, return early with just the URL as the cache key
  if (url && (method ?? GET).toUpperCase() === GET) {
    return method + DELIMITER + url.replace(/[^\w\-_|]/g, '');
  }

  // Bail early if cache should be burst
  if (cache === 'reload') {
    return '';
  }

  // Sort headers and body + convert sorted to strings for hashing purposes
  // Native serializer is on avg. 3.5x faster than a Fast Hash or FNV-1a
  let headersString = '';
  if (headers) {
    const obj =
      headers instanceof Headers
        ? Object.fromEntries((headers as any).entries())
        : headers;
    headersString = shallowSerialize(sortObject(obj));
    if (headersString.length > MIN_LENGTH_TO_HASH) {
      headersString = hash(headersString);
    }
  }

  let bodyString = '';
  if (body) {
    if (typeof body === 'string') {
      bodyString = body.length < MIN_LENGTH_TO_HASH ? body : hash(body); // hash only if large
    } else if (body instanceof FormData) {
      body.forEach((value, key) => {
        // Append key=value and '&' directly to the result
        bodyString += key + '=' + value + '&';
      });

      if (bodyString.length > MIN_LENGTH_TO_HASH) {
        bodyString = hash(bodyString);
      }
    } else if (
      (typeof Blob !== UNDEFINED && body instanceof Blob) ||
      (typeof File !== UNDEFINED && body instanceof File)
    ) {
      bodyString = 'BF' + body.size + body.type;
    } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
      bodyString = 'AB' + body.byteLength;
    } else {
      const o =
        typeof body === OBJECT
          ? JSON.stringify(sortObject(body))
          : String(body);

      bodyString = o.length > MIN_LENGTH_TO_HASH ? hash(o) : o;
    }
  }

  // Concatenate all key parts into a cache key string
  // Template literals are apparently slower
  return (
    method +
    DELIMITER +
    url +
    DELIMITER +
    mode +
    credentials +
    cache +
    redirect +
    referrer +
    integrity +
    DELIMITER +
    headersString +
    DELIMITER +
    bodyString
  ).replace(/[^\w\-_|]/g, ''); // Prevent cache poisoning by removal of anything that isn't letters, numbers, -, _, or |
}

/**
 * Checks if the cache entry is expired based on its timestamp and the maximum stale time.
 *
 * @param {number} timestamp - The timestamp of the cache entry.
 * @param {number|undefined} maxStaleTime - The maximum time in seconds that the cache entry is considered valid.
 * @returns {boolean} - Returns true if the cache entry is expired, false otherwise.
 */
function isCacheExpired(timestamp: number, maxStaleTime?: number): boolean {
  // If maxStaleTime is not provided (undefined, null, or 0), the cache entry is considered not expired.
  if (!maxStaleTime) {
    return false;
  }

  // Check if the current time exceeds the timestamp by more than maxStaleTime seconds
  return Date.now() - timestamp > maxStaleTime * 1000;
}

/**
 * Retrieves a cache entry if it exists and is not expired.
 *
 * @param {string} key Cache key to utilize
 * @param {number|undefined} cacheTime - Maximum time to cache entry in seconds.
 * @returns {CacheEntry<T> | null} - The cache entry if it exists and is not expired, null otherwise.
 */
export function getCache<T>(
  key: string,
  cacheTime?: number,
): CacheEntry<T> | null {
  const entry = _cache.get(key);

  if (entry) {
    if (!isCacheExpired(entry.timestamp, cacheTime)) {
      return entry;
    }

    deleteCache(key);
  }

  return null;
}

/**
 * Sets a new cache entry or updates an existing one.
 *
 * @param {string} key Cache key to utilize
 * @param {T} response - The data to be cached.
 */
export function setCache<T = unknown>(key: string, response: T): void {
  const cacheEntry: CacheEntry<T> = {
    data: response,
    timestamp: Date.now(),
  };

  _cache.set(key, cacheEntry);
}

/**
 * Revalidates a cache entry by fetching fresh data and updating the cache.
 *
 * @param {string} key Cache key to utilize
 * @param {FetcherConfig} config - The request configuration object.
 * @returns {Promise<void>} - A promise that resolves when the revalidation is complete.
 */
export async function revalidate(
  key: string,
  config: FetcherConfig,
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

    // Rethrow the error to forward it
    throw error;
  }
}

/**
 * Invalidates (deletes) a cache entry.
 *
 * @param {string} key Cache key to utilize
 */
export function deleteCache(key: string): void {
  _cache.delete(key);
}

/**
 * Prunes the cache by removing entries that have expired based on the provided cache time.
 * @param cacheTime - The maximum time to cache entry.
 */
export function pruneCache(cacheTime: number = 0): void {
  _cache.forEach((entry, key) => {
    if (isCacheExpired(entry.timestamp, cacheTime)) {
      deleteCache(key);
    }
  });
}

/**
 * Mutates a cache entry with new data and optionally revalidates it.
 *
 * @param {string} key Cache key to utilize
 * @param {FetcherConfig} config - The request configuration object.
 * @param {T} newData - The new data to be cached.
 * @param {boolean} revalidateAfter - If true, triggers revalidation after mutation.
 */
export function mutate<T>(
  key: string,
  config: FetcherConfig,
  newData: T,
  revalidateAfter: boolean = false,
): void {
  setCache(key, newData);

  if (revalidateAfter) {
    revalidate(key, config);
  }
}

/**
 * Retrieves a cached response if available and valid, otherwise returns null.
 *
 * @template ResponseData - The type of the response data.
 * @template RequestBody - The type of the request body.
 * @template QueryParams - The type of the query parameters.
 * @template PathParams - The type of the path parameters.
 * @param {string | null} cacheKey - The cache key to look up.
 * @param {number | undefined} cacheTime - The maximum time to cache entry.
 * @param {RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>} requestConfig - The fetcher configuration.
 * @returns {FetchResponse<ResponseData, RequestBody, QueryParams, PathParams> | null} - The cached response or null.
 */
export function getCachedResponse<
  ResponseData,
  RequestBody,
  QueryParams,
  PathParams,
>(
  cacheKey: string | null,
  cacheTime: number | undefined,
  requestConfig: RequestConfig<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  >,
): FetchResponse<ResponseData, RequestBody, QueryParams, PathParams> | null {
  // If cache key or time is not provided, return null
  if (!cacheKey || typeof cacheTime === UNDEFINED || cacheTime === null) {
    return null;
  }

  // Check if cache should be bypassed
  if (requestConfig?.cacheBuster?.(requestConfig)) {
    return null;
  }

  // Retrieve the cached entry
  const cachedEntry = getCache<
    FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>
  >(cacheKey, cacheTime);

  // If no cached entry or it is expired, return null
  return cachedEntry ? cachedEntry.data : null;
}
