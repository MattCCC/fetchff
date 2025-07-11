import type {
  DefaultResponse,
  RequestConfig,
  FetchResponse,
} from './types/request-handler';
import type {
  DefaultParams,
  DefaultPayload,
  DefaultUrlParams,
} from './types/api-handler';
import { applyInterceptors } from './interceptor-manager';
import { ResponseError } from './errors/response-error';
import { isObject } from './utils';
import {
  markInFlight,
  setInFlightPromise,
  getInFlightPromise,
} from './inflight-manager';
import { parseResponseData, prepareResponse } from './response-parser';
import { generateCacheKey, getCachedResponse, setCache } from './cache-manager';
import { withRetry } from './retry-handler';
import { withPolling } from './polling-handler';
import { notifySubscribers } from './pubsub-manager';
import { addRevalidator } from './revalidator-manager';
import { enhanceError, withErrorHandling } from './error-handler';
import { FUNCTION } from './constants';
import { buildConfig } from './config-handler';

const inFlightResponse = {
  isFetching: true,
};

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
  const doRequestOnce = async (isStaleRevalidation = false, attempt = 0) => {
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
        await applyInterceptors(fetcherConfig.onRequest, requestConfig);
      }

      // Custom fetcher
      const fn = fetcherConfig.fetcher;

      response = (fn
        ? await fn<ResponseData, RequestBody, QueryParams, PathParams>(
            url,
            requestConfig,
          )
        : await fetch(
            url,
            requestConfig as RequestInit,
          )) as unknown as FetchResponse<
        ResponseData,
        RequestBody,
        QueryParams,
        PathParams
      >;

      if (isObject(response)) {
        // Add more information to response object
        if (typeof Response === FUNCTION && response instanceof Response) {
          response.data = await parseResponseData(response);
        }

        // Attach config and data to the response
        // This is useful for custom fetchers that do not return a Response instance
        // and for interceptors that may need to access the request config
        response.config = requestConfig;

        // Check if the response status is not outside the range 200-299 and if so, output error
        // This is the pattern for fetch responses as per spec, but custom fetchers may not follow it so we check for `ok` property
        if (response.ok !== undefined && !response.ok) {
          throw new ResponseError(
            `${requestConfig.method} to ${url} failed! Status: ${response.status || null}`,
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
        QueryParams,
        PathParams,
        RequestBody
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
  const baseRequest =
    retries > 0 ? () => withRetry(doRequestOnce, retryConfig) : doRequestOnce;

  const requestWithErrorHandling = (isStaleRevalidation = false) =>
    withErrorHandling<ResponseData, RequestBody, QueryParams, PathParams>(
      isStaleRevalidation,
      baseRequest,
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
      )
    : requestWithErrorHandling();

  // If deduplication is enabled, store the in-flight promise immediately
  if (_cacheKey) {
    if (dedupeTime) {
      setInFlightPromise(_cacheKey, doRequestPromise);
    }

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

  return doRequestPromise;
}
