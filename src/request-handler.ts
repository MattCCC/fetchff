import type {
  DefaultResponse,
  RequestConfig,
  FetchResponse,
  HeadersObject,
} from './types/request-handler';
import type {
  DefaultParams,
  DefaultPayload,
  DefaultUrlParams,
} from './types/api-handler';
import type { StoredResponse } from './types/cache-manager';
import { applyInterceptors } from './interceptor-manager';
import { ResponseError } from './errors/response-error';
import { isObject, noop, processHeaders } from './utils';
import {
  markInFlight,
  setInFlightPromise,
  getInFlightPromise,
} from './inflight-manager';
import { parseResponseData, prepareResponse } from './response-parser';
import {
  generateCacheKey,
  getCacheData,
  getCachedResponse,
  getStoredCache,
  restoreCache,
  setCache,
} from './cache-manager';
import { withRetry } from './retry-handler';
import { withPolling } from './polling-handler';
import { fetchWithUploadProgress } from './upload-progress';
import { notifySubscribers } from './pubsub-manager';
import { addRevalidator } from './revalidator-manager';
import { enhanceError, withErrorHandling } from './error-handler';
import { FUNCTION, GET, HEAD } from './constants';
import { buildConfig } from './config-handler';

const inFlightResponse = Object.freeze({
  isFetching: true,
});

/**
 * Sends an HTTP request to the specified URL using the provided configuration and returns a typed response.
 *
 * @typeParam ResponseData - The expected shape of the response data. Defaults to `DefaultResponse`.
 * @typeParam RequestBody - The type of the request payload/body. Defaults to `DefaultPayload`.
 * @typeParam QueryParams - The type of the query parameters. Defaults to `DefaultParams`.
 * @typeParam PathParams - The type of the path parameters. Defaults to `DefaultUrlParams`.
 *
 * @param url - The endpoint URL to which the request will be sent.
 * @param config - Optional configuration object for the request, including headers, method, body, query, and path parameters.
 *
 * @returns A promise that resolves to a `FetchResponse` containing the typed response data and request metadata.
 *
 * @example
 * ```typescript
 * const { data } = await fetchf<UserData>('/api/user', { method: 'GET' });
 * console.log(data);
 * ```
 */
export async function fetchf<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
>(
  url: string,
  reqConfig: RequestConfig<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  > | null = null,
): Promise<FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>> {
  // Ultra-fast early cache check if cacheKey is provided as a string
  // For workloads dominated by repeated requests, this string caching optimization
  // can potentially support millions of requests per second with minimal CPU overhead
  if (reqConfig && typeof reqConfig.cacheKey === 'string') {
    const cached = getCachedResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    >(reqConfig.cacheKey, reqConfig.cacheTime, reqConfig);

    if (cached) {
      return cached;
    }
  }

  const fetcherConfig = buildConfig<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  >(url, reqConfig);

  const {
    timeout,
    cancellable,
    cacheKey,
    dedupeTime,
    cacheTime,
    staleTime,
    refetchOnFocus,
    refetchOnReconnect,
    pollingInterval = 0,
  } = fetcherConfig;
  const isCacheEnabled = cacheTime !== undefined || staleTime !== undefined;
  const method = fetcherConfig.method;

  // Cached responses of GET and HEAD requests are revalidated with their ETag.
  // Custom fetchers may not handle 304 responses, so they only send it when it's enabled for them.
  const isETagEnabled =
    isCacheEnabled &&
    (method === GET || method === HEAD) &&
    (fetcherConfig.etag ?? !fetcherConfig.fetcher);

  const needsCacheKey = !!(
    cacheKey ||
    timeout ||
    dedupeTime ||
    isCacheEnabled ||
    cancellable ||
    refetchOnFocus ||
    refetchOnReconnect
  );

  let _cacheKey: string | null = null;

  // Generate cache key if required
  if (needsCacheKey) {
    _cacheKey = generateCacheKey(fetcherConfig);
  }

  // Cache handling logic
  if (_cacheKey && isCacheEnabled) {
    const cached = getCachedResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    >(_cacheKey, cacheTime, fetcherConfig);

    if (cached) {
      return cached;
    }

    // Restore the response from the cache store, e.g. one saved during a previous page load
    if (fetcherConfig.cacheStore) {
      const stored = await getStoredCache(_cacheKey, fetcherConfig);
      const restored =
        stored &&
        toResponse<ResponseData, RequestBody, QueryParams, PathParams>(
          stored.data,
          _cacheKey,
          fetcherConfig,
        );

      // A stale response is shown until the request below revalidates it
      if (
        restored &&
        restoreCache(
          _cacheKey,
          { ...stored, data: restored },
          fetcherConfig.cacheStore,
        )
      ) {
        return restored;
      }
    }
  }

  // Deduplication logic
  if (_cacheKey && dedupeTime) {
    const inflight = getInFlightPromise<
      FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>
    >(_cacheKey, dedupeTime);

    if (inflight) {
      return inflight;
    }
  }

  const retryConfig = fetcherConfig.retry || {};
  const { retries = 0, resetTimeout } = retryConfig;

  // The actual request logic as a function (one poll attempt, with retries)
  const doRequestOnce = async (isStaleRevalidation: boolean, attempt = 0) => {
    // The cached response to revalidate. It's read before the cache is marked as fetching below.
    const cached =
      isETagEnabled &&
      getCacheData<ResponseData, RequestBody, QueryParams, PathParams>(
        _cacheKey,
      );

    // If cache key is specified, we will handle optimistic updates
    // and mark the request as in-flight, so to catch "fetching" state.
    // This is useful for Optimistic UI updates (e.g., showing loading spinners).
    if (!attempt) {
      if (_cacheKey && !isStaleRevalidation) {
        if (staleTime) {
          const existingCache = getCachedResponse(
            _cacheKey,
            cacheTime,
            fetcherConfig,
          );

          // Don't notify subscribers when cache exists
          // Let them continue showing stale data during background revalidation
          if (!existingCache) {
            setCache(_cacheKey, inFlightResponse, cacheTime, staleTime);
            notifySubscribers(_cacheKey, inFlightResponse);
          }
        } else {
          notifySubscribers(_cacheKey, inFlightResponse);
        }
      }

      // Attach cache key so that it can be reused in interceptors or in the final response
      fetcherConfig.cacheKey = _cacheKey;
    }

    const url = fetcherConfig.url as string;

    // Add the request to the queue. Make sure to handle deduplication, cancellation, timeouts in accordance to retry settings
    const controller = markInFlight(
      _cacheKey,
      url,
      timeout,
      dedupeTime || 0,
      !!cancellable,
      // Enable timeout either by default or when retries & resetTimeout are enabled
      !!(timeout && (!attempt || resetTimeout)),
    );

    // Do not create a shallow copy to maintain idempotency here.
    // This ensures the original object is mutated by interceptors whenever needed, including retry logic.
    const requestConfig = fetcherConfig;

    requestConfig.signal = controller.signal;

    let output: FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    >;
    let response: FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    > | null = null;

    try {
      if (fetcherConfig.onRequest) {
        // Zero-allocation yield to microtask queue so the outer fetchf() can call setInFlightPromise()
        // before onRequest interceptors run. This ensures that if onRequest triggers
        // another fetchf() with the same cacheKey, getInFlightPromise() finds item[4].
        // On retries (attempt > 0), setInFlightPromise() was already called during the first attempt.
        // The promise stored in item[4] is the outer doRequestPromise which covers all retries.
        // So the race only matters on the very first attempt when the outer scope hasn't had a chance to call setInFlightPromise() yet.
        if (_cacheKey && dedupeTime && !attempt) {
          await null;
        }

        await applyInterceptors(fetcherConfig.onRequest, requestConfig);
      }

      // Custom fetcher
      const fn = fetcherConfig.fetcher;
      const init = withETag(requestConfig, cached);

      response = (fn
        ? await fn<ResponseData, RequestBody, QueryParams, PathParams>(
            url,
            init,
          )
        : // Uploads with onUploadProgress are sent in a way that reports their progress
          await (requestConfig.onUploadProgress && requestConfig.body
            ? fetchWithUploadProgress(url, requestConfig)
            : fetch(url, init as RequestInit))) as unknown as FetchResponse<
        ResponseData,
        RequestBody,
        QueryParams,
        PathParams
      >;

      // Custom fetcher may return a raw data object instead of a Response instance
      if (isObject(response)) {
        // The server answered that the cached response is still valid, so it's reused instead of being sent again.
        // Like other cached responses, it has been parsed and transformed already.
        if (init !== requestConfig && response.status === 304) {
          return cached as FetchResponse<
            ResponseData,
            RequestBody,
            QueryParams,
            PathParams
          >;
        }

        // Case 1: Native Response instance
        if (typeof Response === FUNCTION && response instanceof Response) {
          response.data = requestConfig.parser
            ? await requestConfig.parser(response)
            : await parseResponseData(response);
        } else if (fn) {
          // Case 2: Custom fetcher that returns a response object
          if (!('data' in response && 'body' in response)) {
            // Case 3: Raw data, wrap it
            response = { data: response } as unknown as FetchResponse<
              ResponseData,
              RequestBody,
              QueryParams,
              PathParams
            >;
          }
        }

        // Attach config and data to the response
        // This is useful for custom fetchers that do not return a Response instance
        // and for interceptors that may need to access the request config
        response.config = requestConfig;

        // Check if the response status is not outside the range 200-299 and if so, output error
        // This is the pattern for fetch responses as per spec, but custom fetchers may not follow it so we check for `ok` property
        if (response.ok !== undefined && !response.ok) {
          throw new ResponseError(
            requestConfig.method +
              ' to ' +
              url +
              ' failed! Status: ' +
              (response.status || null),
            requestConfig,
            response,
          );
        }
      }

      output = prepareResponse<
        ResponseData,
        RequestBody,
        QueryParams,
        PathParams
      >(response, requestConfig);

      const onResponse = fetcherConfig.onResponse;

      if (onResponse) {
        await applyInterceptors(onResponse, output);
      }
    } catch (_error) {
      const error = _error as ResponseError<
        ResponseData,
        RequestBody,
        QueryParams,
        PathParams
      >;

      // Append additional information to Network, CORS or any other fetch() errors
      enhanceError<ResponseData, RequestBody, QueryParams, PathParams>(
        error,
        response,
        requestConfig,
      );

      // Prepare Extended Response
      output = prepareResponse<
        ResponseData,
        RequestBody,
        QueryParams,
        PathParams
      >(response, requestConfig, error);
    }

    return output;
  };

  // Inline and minimize function wrappers for performance
  // When retries are enabled, forward isStaleRevalidation so the first attempt
  // of a background SWR revalidation doesn't incorrectly mark the request as in-flight
  const baseRequest =
    retries > 0
      ? (isStaleRevalidation: boolean) =>
          withRetry(
            (_, attempt) => doRequestOnce(isStaleRevalidation, attempt),
            retryConfig,
          )
      : doRequestOnce;

  const { onLoadingSlow, loadingTimeout } = fetcherConfig;

  // Calls onLoadingSlow once a request, including its retries, is still pending after loadingTimeout.
  // Background revalidations don't show a loading state, so they are never considered slow.
  const request =
    onLoadingSlow && loadingTimeout
      ? async (isStaleRevalidation: boolean) => {
          if (isStaleRevalidation) {
            return baseRequest(isStaleRevalidation);
          }

          const timer = setTimeout(
            () => applyInterceptors(onLoadingSlow, fetcherConfig).catch(noop),
            loadingTimeout,
          );

          try {
            return await baseRequest(isStaleRevalidation);
          } finally {
            clearTimeout(timer);
          }
        }
      : baseRequest;

  const requestWithErrorHandling = (isStaleRevalidation = false) =>
    withErrorHandling<ResponseData, RequestBody, QueryParams, PathParams>(
      isStaleRevalidation,
      request,
      fetcherConfig,
    );

  // Avoid unnecessary function wrapping if polling is not enabled
  const doRequestPromise = pollingInterval
    ? withPolling<ResponseData, RequestBody, QueryParams, PathParams>(
        requestWithErrorHandling,
        pollingInterval,
        fetcherConfig.shouldStopPolling,
        fetcherConfig.maxPollingAttempts,
        fetcherConfig.pollingDelay,
        fetcherConfig.refreshWhenHidden,
        fetcherConfig.refreshWhenOffline,
      )
    : requestWithErrorHandling();

  // If deduplication is enabled, store the in-flight promise immediately
  if (_cacheKey) {
    if (dedupeTime) {
      setInFlightPromise(_cacheKey, doRequestPromise);
    }

    // Only register revalidator when revalidation features are actually requested
    if (staleTime || refetchOnFocus || refetchOnReconnect) {
      addRevalidator(
        _cacheKey,
        requestWithErrorHandling,
        undefined,
        staleTime,
        requestWithErrorHandling,
        !!refetchOnFocus,
        !!refetchOnReconnect,
      );
    }
  }

  return doRequestPromise;
}

/**
 * Recreates a response from its copy in a cache store.
 * The data was transformed before it was stored, so it isn't transformed again.
 *
 * @param stored - The stored copy of the response.
 * @param cacheKey - The cache key of the request.
 * @param config - The request configuration.
 * @returns The response, or null if the stored copy is invalid, e.g. has an unknown status.
 */
function toResponse<ResponseData, RequestBody, QueryParams, PathParams>(
  stored: StoredResponse,
  cacheKey: string,
  config: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>,
): FetchResponse<ResponseData, RequestBody, QueryParams, PathParams> | null {
  try {
    // Without the Fetch API (e.g. with a custom fetcher in tests), a plain response object is used
    const response = (typeof Response === FUNCTION
      ? new Response(null, stored)
      : {
          ok: true,
          status: stored.status,
          statusText: stored.statusText,
          headers: stored.headers,
        }) as unknown as FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    >;

    response.data = stored.data as typeof response.data;
    config.cacheKey = cacheKey;

    const output = prepareResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    >(response, {
      ...config,
      select: undefined,
      flattenResponse: false,
      defaultResponse: undefined,
    });

    output.config = config;

    return output;
  } catch {
    return null;
  }
}

/**
 * Asks the server whether a cached response is still valid, by sending its ETag in the If-None-Match header.
 * Then the server can answer 304 Not Modified instead of sending the response again.
 * Requests with an If-None-Match header of their own are sent as they are.
 *
 * @param config - The request configuration.
 * @param cached - The cached response of the request, if any.
 * @returns A copy of the configuration with the If-None-Match header, or the configuration itself if the cached response has no ETag.
 */
function withETag(
  config: RequestConfig,
  cached: FetchResponse | null | false,
): RequestConfig {
  const etag = cached && !cached.error && cached.headers?.etag;
  const headers = etag && processHeaders(config.headers as HeadersObject);

  return headers && !headers['if-none-match']
    ? { ...config, headers: { ...headers, 'if-none-match': etag } }
    : config;
}
