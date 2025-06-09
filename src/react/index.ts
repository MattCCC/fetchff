import { useEffect, useCallback, useSyncExternalStore, useMemo } from 'react';
import { fetchf } from 'fetchff';
import type {
  DefaultParams,
  DefaultPayload,
  DefaultResponse,
  DefaultUrlParams,
  FetchResponse,
  RequestConfig,
} from '..';
import {
  generateCacheKey,
  getCachedResponse,
  mutate as globalMutate,
} from 'fetchff/cache-manager';
import { subscribe } from 'fetchff/pubsub-manager';
import { getInFlightPromise } from 'fetchff/queue-manager';
import { buildConfig } from 'fetchff/config-handler';
import { UseFetcherResult } from '../types/react-hooks';
import { REJECT } from 'fetchff/constants';

const DEFAULT_DEDUPE_TIME_MS = 2000;

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
 * @returns {UseFetcherResult<ResponseData>} An object containing:
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
  const _cacheKey = useMemo(
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

  // Attempt to get the cached response immediately and if not available, return null
  const getSnapshot = () => getCachedResponse(_cacheKey, 0, config);

  const state = useSyncExternalStore<FetchResponse<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  > | null>(
    // Subscribe to cache updates
    (cb) => subscribe(_cacheKey, cb),
    // Client snapshot - pure function, no side effects
    getSnapshot,
    // Server snapshot - consistent with client
    getSnapshot,
  );

  const dedupeTime = config.dedupeTime ?? DEFAULT_DEDUPE_TIME_MS;

  const refetch = useCallback(() => {
    if (!url) {
      return Promise.resolve(null);
    }

    return fetchf(url, {
      dedupeTime,
      cacheKey: _cacheKey,
      strategy: 'softFail',
      ...config,
    });
  }, [url, _cacheKey]);

  useEffect(() => {
    // Load the initial data if not already cached and not currently fetching
    if (url && !state?.data && !state?.error && !state?.isFetching) {
      refetch();
    }
  }, [state?.data, state?.error, state?.isFetching, refetch]);

  const mutate = useCallback<
    UseFetcherResult<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    >['mutate']
  >(
    async (data, mutationSettings) => {
      return await globalMutate(_cacheKey, data, mutationSettings);
    },
    [_cacheKey],
  );

  // Handle Suspense outside the snapshot function
  const pendingPromise = getInFlightPromise(_cacheKey, dedupeTime);

  if (!state && pendingPromise && config.strategy === REJECT) {
    throw pendingPromise;
  }

  // Consumers always destructure the return value and use the fields directly, so
  // memoizing the object doesn't change rerender behavior nor improve any performance here
  return {
    data: state?.data ?? null,
    error: state?.error ?? null,
    isValidating: state?.isFetching ?? false,
    isLoading: !!url && (state?.isFetching ?? !state),
    mutate,
    refetch,
  };
}
