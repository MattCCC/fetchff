/* eslint-disable @typescript-eslint/no-explicit-any */
import { hash } from './hash';
import type {
  CacheKeyFunction,
  DefaultResponse,
  FetchResponse,
  MutationSettings,
  RequestConfig,
} from './types/request-handler';
import type { CacheEntry } from './types/cache-manager';
import { GET, STRING, UNDEFINED } from './constants';
import { isObject, sanitizeObject, sortObject, timeNow } from './utils';
import { revalidate } from './revalidator-manager';
import { notifySubscribers } from './pubsub-manager';
import type { DefaultPayload, DefaultParams, DefaultUrlParams } from './types';
import { removeInFlight } from './inflight-manager';
import { addTimeout } from './timeout-wheel';
import { defaultConfig } from './config-handler';
import { processHeaders } from './utils';

export const IMMEDIATE_DISCARD_CACHE_TIME = 0; // Use it for cache entries that need to be persistent until unused by components or manually deleted

const _cache = new Map<string, CacheEntry<any>>();
const DELIMITER = '|';
const MIN_LENGTH_TO_HASH = 64;
const CACHE_KEY_SANITIZE_PATTERN = /[^\w\-_|/:@.?=&~%#]/g;
const CACHE_KEY_NEEDS_SANITIZE = /[^\w\-_|/:@.?=&~%#]/; // Non-global for fast test

/**
 * Headers that may affect HTTP response content and should be included in cache key generation.
 * All header names must be lowercase to match normalized request headers.
 */
const CACHE_KEY_HEADER_WHITELIST = new Set([
  // Content negotiation
  'accept', // Affects response format (e.g. JSON, HTML)
  'accept-language', // Affects localization of the response
  'accept-encoding', // Affects response compression (e.g. gzip, br)

  // Authentication
  'authorization', // Affects access to protected resources

  // Request body metadata
  'content-type', // Affects how the request body is interpreted

  // Optional headers
  'referer', // May influence behavior in some APIs
  'origin', // Relevant in CORS or tenant-specific APIs
  'user-agent', // Included only for reason if server returns client-specific content

  // Cookies — only if server uses session-based responses
  'cookie', // Can fragment cache heavily; use only if necessary

  // Custom headers that may affect response content
  'x-api-key', // Token-based access, often affects authorization
  'x-requested-with', // AJAX requests (used historically for distinguishing frontend calls)
  'x-client-id', // Per-client/partner identity; often used in multi-tenant APIs
  'x-tenant-id', // Multi-tenant segmentation; often changes response per tenant
  'x-user-id', // Explicit user context (less common, but may exist)

  'x-app-version', // Used for version-specific behavior (e.g. mobile apps)
  'x-feature-flag', // Controls feature rollout behavior server-side
  'x-device-id', // Used when response varies per device/app instance
  'x-platform', // e.g. 'ios', 'android', 'web' — used in apps that serve different content

  'x-session-id', // Only if backend uses it to affect the response directly (rare)
  'x-locale', // Sometimes used in addition to or instead of `accept-language`
]);

/**
 * Generates a unique cache key for a given URL and fetch options, ensuring that key factors
 * like method, headers, body, and other options are included in the cache key.
 * Headers and other objects are sorted by key to ensure consistent cache keys.
 *
 * @param {RequestConfig} config - The fetch options that may affect the request. The most important are:
 *   @property {string} [method="GET"] - The HTTP method (GET, POST, etc.).
 *   @property {HeadersInit} [headers={}] - The request headers.
 *   @property {BodyInit | null} [body=""] - The body of the request (only for methods like POST, PUT).
 *   @property {RequestCredentials} [credentials="same-origin"] - Whether to include credentials (include, same-origin, omit).
 *   @property {RequestCache} [cache="default"] - The cache mode (e.g., default, no-store, reload).
 * @returns {string} - A unique cache key string based on the provided options.
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
export function generateCacheKey(
  config: RequestConfig,
  cacheKeyCheck = true,
): string {
  // This is super fast. Effectively a no-op if cacheKey is
  // a string or a function that returns a string.
  const key = config.cacheKey;

  if (key && cacheKeyCheck) {
    return typeof key === STRING
      ? (key as string)
      : (key as CacheKeyFunction)(config);
  }

  const {
    url = '',
    method = GET,
    headers = null,
    body = null,
    credentials = 'same-origin',
  } = config;

  // Sort headers and body + convert sorted to strings for hashing purposes
  // Native serializer is on avg. 3.5x faster than a Fast Hash or FNV-1a
  let headersString = '';
  if (headers) {
    let obj: Record<string, string>;

    if (headers instanceof Headers) {
      obj = processHeaders(headers);
    } else {
      obj = headers as Record<string, string>;
    }

    // Filter headers to only include those that affect request identity
    // Include only headers that affect request identity, not execution behavior
    const keys = Object.keys(obj);
    const len = keys.length;

    // Sort keys manually for fastest deterministic output
    if (len > 1) {
      keys.sort();
    }

    let str = '';
    for (let i = 0; i < len; ++i) {
      if (CACHE_KEY_HEADER_WHITELIST.has(keys[i].toLowerCase())) {
        str += keys[i] + ':' + obj[keys[i]] + ';';
      }
    }

    headersString = hash(str);
  }

  // For GET requests, return early with shorter cache key
  if (method === GET) {
    const cacheStr =
      method +
      DELIMITER +
      url +
      DELIMITER +
      credentials +
      DELIMITER +
      headersString;

    return CACHE_KEY_NEEDS_SANITIZE.test(cacheStr)
      ? cacheStr.replace(CACHE_KEY_SANITIZE_PATTERN, '')
      : cacheStr;
  }

  let bodyString = '';
  if (body) {
    if (typeof body === STRING) {
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
      const o = isObject(body)
        ? JSON.stringify(sortObject(body))
        : String(body);

      bodyString = o.length > MIN_LENGTH_TO_HASH ? hash(o) : o;
    }
  }

  // Concatenate all key parts into a cache key string
  // Template literals are apparently slower
  const cacheStr =
    method +
    DELIMITER +
    url +
    DELIMITER +
    credentials +
    DELIMITER +
    headersString +
    DELIMITER +
    bodyString;

  // Prevent cache poisoning by removal of control chars and unusual characters
  return CACHE_KEY_NEEDS_SANITIZE.test(cacheStr)
    ? cacheStr.replace(CACHE_KEY_SANITIZE_PATTERN, '')
    : cacheStr;
}

/**
 * Checks if the cache entry is expired based on its timestamp and the expiry time.
 *
 * @param {CacheEntry<any>} entry - The cache entry to check.
 * @returns {boolean} - Returns true if the cache entry is expired, false otherwise.
 */
function isCacheExpired(entry: CacheEntry<any>): boolean {
  // No expiry time means the entry never expires
  if (!entry.expiry) {
    return false;
  }

  return timeNow() > entry.expiry;
}

/**
 * Retrieves a cached response from the internal cache using the provided key.
 *
 * @param key - The unique key identifying the cached entry. If null, returns null.
 * @returns The cached {@link FetchResponse} if found, otherwise null.
 */
export function getCacheData<
  ResponseData,
  RequestBody,
  QueryParams,
  PathParams,
>(
  key: string | null,
): FetchResponse<ResponseData, RequestBody, QueryParams, PathParams> | null {
  if (!key) {
    return null;
  }

  const entry = _cache.get(key);

  return entry ? entry.data : null;
}

/**
 * Retrieves a cache entry if it exists and is not expired.
 *
 * @param {string} key Cache key to utilize
 * @returns {CacheEntry<T> | null} - The cache entry if it exists and is not expired, null otherwise.
 */
export function getCache<ResponseData, RequestBody, QueryParams, PathParams>(
  key: string | null,
):
  | CacheEntry<
      FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>
    >
  | null
  | undefined {
  return _cache.get(key as string);
}

/**
 * Sets a new cache entry or updates an existing one, with optional TTL (time-to-live).
 *
 * @param {string} key Cache key to utilize
 * @param {T} data - The data to be cached.
 * @param {number} [ttl] - Optional TTL in seconds. If not provided, the cache entry will not expire.
 * @param {number} [staleTime] - Optional stale time in seconds. If provided, the cache entry will be considered stale after this time.
 */
export function setCache<T = unknown>(
  key: string,
  data: T,
  ttl?: number,
  staleTime?: number,
): void {
  if (ttl === 0) {
    deleteCache(key);
    return;
  }

  const time = timeNow();
  const ttlMs = ttl ? ttl * 1000 : 0;
  const staleTimeMs = staleTime ? staleTime * 1000 : 0; // Ensure default value for staleTime

  _cache.set(key, {
    data,
    time,
    stale: staleTimeMs > 0 ? time + staleTimeMs : undefined, // Use undefined if staleTime is not set
    expiry: ttl === -1 ? undefined : time + ttlMs,
  });

  if (ttlMs > 0) {
    addTimeout(
      'c:' + key,
      () => {
        deleteCache(key, true);
      },
      ttlMs,
    );
  }
}

/**
 * Invalidates (deletes) a cache entry.
 *
 * @param {string} key Cache key to utilize
 * @param {boolean} [removeExpired=false] - If true, only deletes the cache entry if it is expired or stale.
 */
export function deleteCache(key: string, removeExpired: boolean = false): void {
  if (removeExpired) {
    const entry = getCache(key);

    // If the entry does not exist, or it is neither expired nor stale, do not delete
    if (!entry || !isCacheExpired(entry)) {
      return;
    }
  }

  _cache.delete(key);
}

/**
 * Prunes the cache by removing entries that have expired based on the provided cache time.
 */
export function pruneCache(): void {
  _cache.clear();
}

/**
 * Mutates a cache entry with new data and optionally revalidates it.
 *
 * @param {string | null} key Cache key to utilize. If null, no mutation occurs.
 * @param {ResponseData} newData - The new data to be cached.
 * @param {MutationSettings|undefined} settings - Mutation settings.
 */
export async function mutate<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
>(
  key: string | null,
  newData: ResponseData,
  settings?: MutationSettings,
): Promise<FetchResponse<
  ResponseData,
  RequestBody,
  QueryParams,
  PathParams
> | null> {
  // If no key is provided, do nothing
  if (!key) {
    return null;
  }

  const entry = getCache<ResponseData, RequestBody, QueryParams, PathParams>(
    key,
  );

  if (!entry) {
    return null;
  }

  const updatedData = isObject(newData) ? sanitizeObject(newData) : newData;

  const updatedResponse = {
    ...entry.data,
    data: updatedData,
  };

  const updatedEntry = {
    ...entry,
    data: updatedResponse,
  };

  _cache.set(key, updatedEntry);
  notifySubscribers(key, updatedResponse);

  if (settings && settings.refetch) {
    return await revalidate(key);
  }

  return null;
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
  if (!cacheKey || cacheTime === undefined || cacheTime === null) {
    return null;
  }

  // Check if cache should be bypassed
  const buster = requestConfig.cacheBuster || defaultConfig.cacheBuster;
  if (buster && buster(requestConfig)) {
    return null;
  }

  if (requestConfig.cache && requestConfig.cache === 'reload') {
    return null; // Skip cache lookup entirely
  }

  // Retrieve the cached entry
  const entry = getCache<ResponseData, RequestBody, QueryParams, PathParams>(
    cacheKey,
  );

  if (!entry) {
    return null;
  }

  const isExpired = isCacheExpired(entry);

  // If completely expired, delete and return null
  if (isExpired) {
    deleteCache(cacheKey);
    return null;
  }

  // Return data whether fresh or stale (SWR: serve stale, revalidation is timer-driven)
  return entry.data;
}

/**
 * Sets or deletes the response cache based on cache settings and notifies subscribers.
 *
 * @param {FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>} output - The response to cache.
 * @param {RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>} requestConfig - The request configuration.
 * @param {boolean} [isError=false] - Whether the response is an error.
 */
export function handleResponseCache<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
>(
  output: FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>,
  requestConfig: RequestConfig<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  >,
  isError: boolean = false,
): void {
  // It is string as it is called once request is made
  const cacheKey = requestConfig.cacheKey as string;

  if (cacheKey) {
    const cacheTime = requestConfig.cacheTime;
    const skipCache = requestConfig.skipCache;

    // Fast path: only set cache if cacheTime is positive and not skipping cache
    if (
      cacheTime &&
      (!isError || requestConfig.cacheErrors) &&
      !(skipCache && skipCache(output, requestConfig))
    ) {
      setCache(cacheKey, output, cacheTime, requestConfig.staleTime);
    }

    notifySubscribers(cacheKey, output);
    removeInFlight(cacheKey);

    const prevCacheKey = requestConfig._prevKey;

    if (prevCacheKey) {
      removeInFlight(prevCacheKey);
    }
  }
}
