import { useCallback, useSyncExternalStore, useMemo, useRef } from 'react';
import {
  fetchf,
  subscribe,
  buildConfig,
  generateCacheKey,
  getCachedResponse,
  getInFlightPromise,
  getCache,
} from 'fetchff';
import type {
  DefaultParams,
  DefaultPayload,
  DefaultResponse,
  DefaultUrlParams,
  FetchResponse,
  RequestConfig,
} from '..';
import type { UseFetcherResult } from '../types/react-hooks';

import {
  decrementRef,
  DEFAULT_DEDUPE_TIME_MS,
  getRefCount,
  incrementRef,
  INFINITE_CACHE_TIME,
} from './cache-ref';

// In React, we use a default stale time of 5 minutes (SWR)
const DEFAULT_STALE_TIME = 300; // 5 minutes

// Pre-allocate objects to avoid GC pressure
const DEFAULT_RESULT = Object.freeze({
  data: null,
  error: null,
  isFetching: false,
  mutate: () => Promise.resolve(null),
  config: {},
  headers: {},
});

const FETCHING_RESULT = Object.freeze({
  ...DEFAULT_RESULT,
  isFetching: true,
});

const DEFAULT_REF = [null, {}, null] as [
  string | null,
  RequestConfig,
  string | null,
];

// RFC 7231: GET and HEAD are "safe methods" with no side effects
const SAFE_METHODS = new Set(['GET', 'HEAD', 'get', 'head']);

/**
 * High-performance React hook for fetching data with caching, deduplication, revalidation etc.
 *
 * @template ResponseData - The expected response data type.
 * @template RequestBody - The request payload type.
 * @template QueryParams - The query parameters type.
 * @template PathParams - The URL path parameters type.
 *
 * @param {string|null} url - The endpoint URL to fetch data from. Pass null to skip fetching.
 *   If the URL is null, the hook will not perform any fetch operation.
 *   If the URL is an empty string, it will default to the base URL configured in fetchff.
 *   If the URL is a full URL, it will be used as is.
 * @param {RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>} [config={}] - fetchff and native fetch compatible configuration.
 *
 * @returns {UseFetcherResult<ResponseData, RequestBody, QueryParams, PathParams>} An object containing:
 *   - `data`: The fetched data or `null` if not yet available.
 *   - `error`: Any error encountered during fetching or `null`.
 *   - `isLoading`: Boolean indicating if the request is in progress.
 *   - `mutate`: Function to update the cached data and optionally trigger revalidation.
 *
 * @remarks
 * - Designed for high performance: minimizes unnecessary re-renders and leverages fast cache key generation.
 * - Integrates with a global cache and pub/sub system for efficient state updates across contexts.
 * - Handles automatic revalidation, deduplication, retries, and cache management out of the box.
 *
 * @example
 * ```tsx
 * const { data, error, isLoading, mutate } = useFetcher('/api/data', {
 *   revalidateOnFocus: true,
 *   cacheTime: 5,
 *   dedupeTime: 2000,
 *   cacheKey: (config) => `custom-cache-key-${config.url}`,
 * });
 * ```
 */
export function useFetcher<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
>(
  url: string | null,
  config: RequestConfig<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  > = {},
): UseFetcherResult<ResponseData, RequestBody, QueryParams, PathParams> {
  // Efficient cache key generation based on URL and request parameters.
  // Optimized for speed: minimizes unnecessary function calls when possible
  const cacheKey = useMemo(
    () => (url === null ? null : generateCacheKey(buildConfig(url, config))),
    [
      config.cacheKey,
      url,
      config.url,
      config.method,
      config.headers,
      config.body,
      config.params,
      config.urlPathParams,
      config.apiUrl,
      config.baseURL,
      config.withCredentials,
      config.credentials,
    ],
  );
  const dedupeTime = config.dedupeTime ?? DEFAULT_DEDUPE_TIME_MS;
  const cacheTime = config.cacheTime || INFINITE_CACHE_TIME;
  const staleTime = config.staleTime ?? DEFAULT_STALE_TIME;

  // Determine if the fetch should be triggered immediately on mount
  const shouldTriggerOnMount =
    config.immediate ?? SAFE_METHODS.has(config.method || 'GET');

  const currentValuesRef = useRef(DEFAULT_REF);
  currentValuesRef.current = [url, config, cacheKey];

  // Attempt to get the cached response immediately and if not available, return null
  const getSnapshot = useCallback(() => {
    const cached = getCache<ResponseData, RequestBody, QueryParams, PathParams>(
      cacheKey,
    );

    // Only throw for Suspense if we're in 'reject' mode and have no data
    if (
      config.strategy === 'reject' &&
      cacheKey &&
      (!cached || (!cached.data.data && !cached.data.error))
    ) {
      const pendingPromise = getInFlightPromise(cacheKey, dedupeTime);

      if (pendingPromise) {
        throw pendingPromise;
      }

      // If no pending promise but we need to fetch, start fetch and throw the promise
      if (!cached) {
        const [currUrl, currConfig, currCacheKey] = currentValuesRef.current;

        if (currUrl) {
          const fetchPromise = fetchf(currUrl, {
            ...currConfig,
            cacheKey: currCacheKey,
            dedupeTime,
            cacheTime,
            staleTime,
            strategy: 'softFail',
            cacheErrors: true,
            _isAutoKey: !currConfig.cacheKey,
          });

          throw fetchPromise;
        }
      }
    }

    if (cached) {
      return cached.data.isFetching && !config.keepPreviousData
        ? (FETCHING_RESULT as unknown as FetchResponse<
            ResponseData,
            RequestBody,
            QueryParams,
            PathParams
          >)
        : cached.data;
    }

    return (shouldTriggerOnMount
      ? FETCHING_RESULT
      : DEFAULT_RESULT) as unknown as FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    >;
  }, [cacheKey]);

  // Subscribe to cache updates for the specific cache key
  const doSubscribe = useCallback(
    (cb: () => void) => {
      incrementRef(cacheKey);

      // When the component mounts, we want to fetch data if:
      // 1. URL is provided
      // 2. shouldTriggerOnMount is true (so the "immediate" isn't specified or is true)
      // 3. There is no cached data
      // 4. There is no error
      // 5. There is no ongoing fetch operation
      const shouldFetch =
        shouldTriggerOnMount && url && cacheKey && getRefCount(cacheKey) === 1; // Check if no existing refs

      // Initial fetch logic
      if (shouldFetch) {
        // Stale-While-Revalidate Pattern: Check for both fresh and stale data
        const cached = getCachedResponse(cacheKey, cacheTime, config);

        if (!cached) {
          refetch(false);
        }
      }

      const unsubscribe = subscribe(cacheKey, cb);

      return () => {
        decrementRef(cacheKey, cacheTime, dedupeTime, url);
        unsubscribe();
      };
    },
    [cacheKey, shouldTriggerOnMount, url, dedupeTime, cacheTime],
  );

  const state = useSyncExternalStore<
    FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>
  >(doSubscribe, getSnapshot, getSnapshot);

  const refetch = useCallback(
    async (forceRefresh = true) => {
      const [currUrl, currConfig, currCacheKey] = currentValuesRef.current;

      if (!currUrl) {
        return Promise.resolve(null);
      }

      // Truthy check for forceRefresh to ensure it's a boolean. It is useful in onClick handlers so to avoid additional annonymous function calls.
      const shouldRefresh = !!forceRefresh;

      // Fast path: check cache first if not forcing refresh
      if (!shouldRefresh && currCacheKey) {
        const cached = getCachedResponse(currCacheKey, cacheTime, currConfig);

        if (cached) {
          return Promise.resolve(cached);
        }
      }

      // When manual refetch is triggered, we want to ensure that the cache is busted
      // This can be disabled by passing `refetch(false)`
      const cacheBuster = shouldRefresh ? () => true : currConfig.cacheBuster;

      return fetchf(currUrl, {
        ...currConfig,
        cacheKey: currCacheKey,
        dedupeTime,
        cacheTime,
        staleTime,
        cacheBuster,
        // Ensure that errors are handled gracefully and not thrown by default
        strategy: 'softFail',
        cacheErrors: true,
        _isAutoKey: !currConfig.cacheKey,
      });
    },
    [cacheTime, dedupeTime],
  );

  const data = state.data;
  const isUnresolved = !data && !state.error;
  const isFetching = state.isFetching;
  const isLoading =
    !!url && (isFetching || (isUnresolved && shouldTriggerOnMount));

  // Consumers always destructure the return value and use the fields directly, so
  // memoizing the object doesn't change rerender behavior nor improve any performance here
  return {
    data,
    error: state.error,
    config: state.config,
    headers: state.headers,
    isFetching,
    isLoading,
    mutate: state.mutate,
    refetch,
  };
}
