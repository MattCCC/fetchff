import type {
  DefaultResponse,
  RequestConfig,
  RetryOptions,
  FetchResponse,
} from './types/request-handler';
import type {
  DefaultParams,
  DefaultPayload,
  DefaultUrlParams,
} from './types/api-handler';
import { applyInterceptor } from './interceptor-manager';
import { ResponseError } from './errors/response-error';
import { delayInvocation, isObject, sanitizeObject } from './utils';
import {
  markInFlight,
  abortRequest,
  setInFlightPromise,
  getInFlightPromise,
} from './inflight-manager';
import { ABORT_ERROR, CANCELLED_ERROR, FUNCTION, REJECT } from './constants';
import { prepareResponse, parseResponseData } from './response-parser';
import {
  deleteCache,
  generateCacheKey,
  getCachedResponse,
  setCache,
} from './cache-manager';
import { buildConfig, defaultConfig, mergeConfigs } from './config-handler';
import { getRetryAfterMs } from './retry-handler';
import { withPolling } from './polling-handler';
import { notifySubscribers } from './pubsub-manager';
import { addRevalidator } from './revalidator-manager';

const inFlightResponse = {
  isFetching: true,
  data: null,
  error: null,
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
  const sanitizedReqConfig = reqConfig ? sanitizeObject(reqConfig) : {};
  const mergedConfig = reqConfig
    ? mergeConfigs(defaultConfig, sanitizedReqConfig)
    : { ...defaultConfig };
  const fetcherConfig = buildConfig(url, mergedConfig);

  let response: FetchResponse<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  > | null = null;

  const {
    timeout,
    cancellable,
    cacheKey,
    dedupeTime,
    cacheTime,
    revalidateOnFocus,
    revalidateOnReconnect,
    pollingInterval = 0,
  } = mergedConfig;

  const needsCacheKey = !!(
    cacheKey ||
    timeout ||
    dedupeTime ||
    cacheTime ||
    cancellable ||
    revalidateOnFocus ||
    revalidateOnReconnect
  );

  let _cacheKey: string | null = null;

  // Generate cache key if required
  if (needsCacheKey) {
    _cacheKey = generateCacheKey(fetcherConfig);
  }

  // Cache handling logic
  if (_cacheKey && cacheTime) {
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

  const {
    retries = 0,
    delay,
    backoff,
    retryOn,
    shouldRetry,
    maxDelay,
    resetTimeout,
  } = mergedConfig.retry as RetryOptions<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  >;

  // The actual request logic as a function (one poll attempt, with retries)
  const doRequestOnce = async (isStaleRevalidation = false) => {
    // If cache key is specified, we will handle optimistic updates
    // and mark the request as in-flight, so to catch "fetching" state.
    // This is useful for Optimistic UI updates (e.g., showing loading spinners).
    if (_cacheKey && !isStaleRevalidation) {
      setCache(_cacheKey, inFlightResponse);

      notifySubscribers(_cacheKey, inFlightResponse);
    }

    let attempt = 0;
    let waitTime: number = delay || 0;
    const _retries = retries > 0 ? retries : 0;
    const skipCache = mergedConfig.skipCache;

    while (attempt <= _retries) {
      const url = fetcherConfig.url as string;

      // Add the request to the queue. Make sure to handle deduplication, cancellation, timeouts in accordance to retry settings
      const controller = markInFlight(
        _cacheKey,
        url,
        timeout,
        dedupeTime || 0,
        !!cancellable,
        // Reset timeouts by default or when retries are ON
        !!(timeout && (!_retries || resetTimeout)),
      );

      // Create a shallow copy to maintain idempotency.
      // This ensures the original object is not mutated before passing to interceptors or fetchers.
      const requestConfig: RequestConfig = {
        ...fetcherConfig,
        signal: controller.signal,
      };

      try {
        if (mergedConfig.onRequest) {
          // Local interceptors
          await applyInterceptor(requestConfig, sanitizedReqConfig.onRequest);

          // Global interceptors
          await applyInterceptor(requestConfig, defaultConfig.onRequest);
        }

        // Backwards compatibility for custom fetcher
        const fn = mergedConfig.fetcher;

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

        // Attach config and data to the response
        // This is useful for custom fetchers that do not return a Response instance
        // and for interceptors that may need to access the request config
        if (isObject(response)) {
          // Add more information to response object
          if (typeof Response === FUNCTION && response instanceof Response) {
            response.data = await parseResponseData(response);
          }

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

        if (mergedConfig.onResponse) {
          // Local interceptors
          await applyInterceptor(response, sanitizedReqConfig.onResponse);

          // Global interceptors
          await applyInterceptor(response, defaultConfig.onResponse);
        }

        // Remove the request from the queue
        abortRequest(_cacheKey);

        const output = prepareResponse<
          ResponseData,
          QueryParams,
          PathParams,
          RequestBody
        >(response, requestConfig);

        // Retry on response logic
        if (
          shouldRetry &&
          attempt < _retries &&
          (await shouldRetry(output, attempt))
        ) {
          logger(
            mergedConfig,
            `Attempt ${attempt + 1} failed response data check. Retry in ${waitTime}ms.`,
          );

          await delayInvocation(waitTime);

          waitTime *= backoff || 1;
          waitTime = Math.min(waitTime, maxDelay || waitTime);
          attempt++;

          continue; // Retry the request
        }

        if (_cacheKey) {
          if (
            cacheTime &&
            (!skipCache ||
              !skipCache<ResponseData, RequestBody, QueryParams, PathParams>(
                output,
                requestConfig,
              ))
          ) {
            setCache(_cacheKey, output);
          } else {
            deleteCache(_cacheKey);
          }

          notifySubscribers(_cacheKey, output);
        }

        return output;
      } catch (err) {
        const error = err as ResponseError<
          ResponseData,
          QueryParams,
          PathParams,
          RequestBody
        >;

        // Append additional information to Network, CORS or any other fetch() errors
        error.status = error.status || response?.status || 0;
        error.statusText = error.statusText || response?.statusText || '';
        error.config = error.request = fetcherConfig;
        error.response = response;

        // Prepare Extended Response
        const output = prepareResponse<
          ResponseData,
          QueryParams,
          PathParams,
          RequestBody
        >(response, fetcherConfig, error);

        let shouldStopRetrying = false;

        // Safety first: always respect max retries
        // We check retries provided regardless of the shouldRetry being provided so to avoid infinite loops.
        // It is a fail-safe so to prevent excessive retry attempts even if custom retry logic suggests a retry.
        if (attempt === _retries) {
          shouldStopRetrying = true;
        } else {
          let customDecision: boolean | null = null;

          // Get custom decision if shouldRetry is provided
          if (shouldRetry) {
            const result = await shouldRetry(output, attempt);
            customDecision = result;
          }

          // Decision cascade:
          if (customDecision === true) {
            // shouldRetry explicitly says retry
            shouldStopRetrying = false;
          } else if (customDecision === false) {
            // shouldRetry explicitly says don't retry
            shouldStopRetrying = true;
          } else {
            // shouldRetry returned undefined/null, fallback to retryOn
            shouldStopRetrying = !(retryOn || []).includes(error.status);
          }
        }

        if (shouldStopRetrying) {
          // Local interceptors
          await applyInterceptor(error, sanitizedReqConfig.onError);

          // Global interceptors
          await applyInterceptor(error, defaultConfig.onError);

          // Remove the request from the queue
          abortRequest(_cacheKey);

          // Timeouts and request cancellations using AbortController do not throw any errors unless rejectCancelled is true.
          // Only handle the error if the request was not cancelled, or if it was cancelled and rejectCancelled is true.
          const isCancelled = isRequestCancelled(error as ResponseError);

          if (!isCancelled) {
            logger(mergedConfig, 'FETCH ERROR', error as ResponseError);
          }

          const shouldHandleError =
            !isCancelled || mergedConfig.rejectCancelled;

          if (_cacheKey) {
            if (
              cacheTime &&
              mergedConfig.cacheErrors &&
              (!skipCache ||
                !skipCache<ResponseData, RequestBody, QueryParams, PathParams>(
                  output,
                  mergedConfig,
                ))
            ) {
              setCache(_cacheKey, output);
            }

            notifySubscribers(_cacheKey, output);
          }

          if (shouldHandleError) {
            const errorHandlingStrategy = mergedConfig.strategy;

            // Reject the promise
            if (errorHandlingStrategy === REJECT) {
              return Promise.reject(error);
            } // Hang the promise
            else if (errorHandlingStrategy === 'silent') {
              await new Promise(() => null);
            }
          }

          return output;
        }

        // If the error status is 429 (Too Many Requests), handle rate limiting
        if (error.status === 429) {
          // Try to extract the "Retry-After" value from the response headers
          const retryAfterMs = getRetryAfterMs(output);

          // If a valid retry-after value is found, override the wait time before next retry
          if (retryAfterMs !== null) {
            waitTime = retryAfterMs;
          }
        }

        logger(
          mergedConfig,
          `Attempt ${attempt + 1} failed. Retry in ${waitTime}ms.`,
        );

        await delayInvocation(waitTime);

        waitTime *= backoff || 1;
        waitTime = Math.min(waitTime, maxDelay || waitTime);
        attempt++;
      }
    }

    return prepareResponse<ResponseData, QueryParams, PathParams, RequestBody>(
      response,
      fetcherConfig,
    );
  };

  // If polling is enabled, use withPolling to handle the request
  const doRequestPromise = pollingInterval
    ? withPolling<
        FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>
      >(
        doRequestOnce,
        pollingInterval,
        mergedConfig.shouldStopPolling,
        mergedConfig.maxPollingAttempts,
        mergedConfig.pollingDelay,
      )
    : doRequestOnce();

  // If deduplication is enabled, store the in-flight promise immediately
  if (_cacheKey) {
    if (dedupeTime) {
      setInFlightPromise(_cacheKey, doRequestPromise);
    }

    addRevalidator(
      _cacheKey,
      doRequestOnce,
      undefined,
      mergedConfig.staleTime,
      doRequestOnce,
      !!revalidateOnFocus,
      !!revalidateOnReconnect,
    );
  }

  return doRequestPromise;
}

/**
 * Output error response depending on chosen strategy
 *
 * @param {ResponseError} error               Error instance
 * @returns {boolean}                        True if request is aborted
 */
function isRequestCancelled(error: ResponseError): boolean {
  return error.name === ABORT_ERROR || error.name === CANCELLED_ERROR;
}

/**
 * Logs messages or errors using the configured logger's `warn` method.
 *
 * @param {RequestConfig} reqConfig - Request config passed when making the request
 * @param {...(string | ResponseError<any>)} args - Messages or errors to log.
 */
function logger(
  reqConfig: RequestConfig,
  ...args: (string | ResponseError)[]
): void {
  const logger = reqConfig.logger;

  if (logger && logger.warn) {
    logger.warn(...args);
  }
}
