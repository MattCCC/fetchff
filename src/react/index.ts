import {
  useEffect,
  useCallback,
  useSyncExternalStore,
  useMemo,
  useRef,
} from 'react';
import {
  fetchf,
  subscribe,
  buildConfig,
  mutate as globalMutate,
  setCache,
  generateCacheKey,
  getCachedResponse,
  getInFlightPromise,
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

import { decrementRef, incrementRef, INFINITE_CACHE_TIME } from './cache-ref';

const DEFAULT_DEDUPE_TIME_MS = 2000;
const DEFAULT_RESULT = {
  data: null,
  error: null,
  isFetching: false,
  config: {},
  headers: {},
};
const DEFAULT_REF = [null, {}, null] as [
  string | null,
  RequestConfig,
  string | null,
];

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
      config.body,
      config.mode,
      config.cache,
      config.redirect,
      config.referrer,
      config.headers,
      config.integrity,
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

  const currentValuesRef = useRef(DEFAULT_REF);
  currentValuesRef.current = [url, config, cacheKey];

  const shouldTriggerOnMount = useMemo(
    () => (config.immediate === undefined ? true : config.immediate),
    [config.immediate],
  );

  // Attempt to get the cached response immediately and if not available, return null
  const getSnapshot = useCallback(() => {
    const cached = getCachedResponse(
      cacheKey,
      // Stale-While-Revalidate Pattern: By setting -1 always return cached data if available (even if stale)
      INFINITE_CACHE_TIME,
      config,
    );

    return cached;
  }, [cacheKey, cacheTime]);

  // Subscribe to cache updates for the specific cache key
  const doSubscribe = useCallback(
    (cb: () => void) => {
      const unsubscribe = subscribe(cacheKey, (data: FetchResponse | null) => {
        // Optimistic Updates: Reflect that a fetch is happening, so to catch "fetching" state. This can help with UI updates (e.g., showing loading spinners).
        if (cacheKey && data && data.isFetching) {
          setCache(cacheKey, data);
        }

        return cb();
      });

      return unsubscribe;
    },
    [cacheKey],
  );

  const state =
    useSyncExternalStore<FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    > | null>(doSubscribe, getSnapshot, getSnapshot) ||
    (DEFAULT_RESULT as unknown as FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    >);

  const isUnresolved = !state.data && !state.error;
  const isFetching = state.isFetching || false;

  // Handle Suspense outside the snapshot function
  if (isUnresolved && config.strategy === 'reject') {
    const pendingPromise = getInFlightPromise(cacheKey, dedupeTime);

    if (pendingPromise) {
      throw pendingPromise;
    }
  }

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

      return await fetchf(currUrl, {
        ...currConfig,
        cacheKey: currCacheKey,
        dedupeTime,
        cacheTime,
        cacheBuster,
        // Ensure that errors are handled gracefully and not thrown by default
        strategy: 'softFail',
        cacheErrors: true,
      });
    },
    [cacheTime, dedupeTime],
  );

  useEffect(() => {
    // Load the initial data if not already cached and not currently fetching
    if (
      shouldTriggerOnMount &&
      currentValuesRef.current[0] &&
      !state.data &&
      !state.error &&
      !state.isFetching
    ) {
      // When the component mounts, we want to fetch data if:
      // 1. URL is provided
      // 2. shouldTriggerOnMount is true (so the "immediate" isn't specified or is true)
      // 3. There is no cached data
      // 4. There is no error
      // 5. There is no ongoing fetch operation
      refetch(false);
    }

    incrementRef(cacheKey);

    return () => {
      decrementRef(
        cacheKey,
        cacheTime,
        dedupeTime,
        currentValuesRef.current[0],
      );
    };
  }, [shouldTriggerOnMount, cacheKey, cacheTime]);

  const mutate = useCallback<
    UseFetcherResult<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    >['mutate']
  >(
    async (data, mutationSettings) => {
      return await globalMutate(cacheKey, data, mutationSettings);
    },
    [cacheKey],
  );

  // Consumers always destructure the return value and use the fields directly, so
  // memoizing the object doesn't change rerender behavior nor improve any performance here
  return {
    data: state.data,
    error: state.error,
    config: state.config,
    headers: state.headers,
    isValidating: isFetching,
    isLoading: !!url && (isFetching || (isUnresolved && shouldTriggerOnMount)),
    mutate,
    refetch,
  };
}
