/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  DefaultResponse,
  RequestHandlerConfig,
  RequestConfig,
  RetryOptions,
  FetchResponse,
  RequestHandlerReturnType,
  CreatedCustomFetcherInstance,
} from './types/request-handler';
import type {
  DefaultParams,
  DefaultPayload,
  DefaultUrlParams,
} from './types/api-handler';
import { applyInterceptor } from './interceptor-manager';
import { ResponseError } from './errors/response-error';
import { delayInvocation, sanitizeObject } from './utils';
import {
  queueRequest,
  removeRequestFromQueue,
  setInFlightPromise,
  getInFlightPromise,
} from './queue-manager';
import { ABORT_ERROR, CANCELLED_ERROR } from './constants';
import { prepareResponse, parseResponseData } from './response-parser';
import { generateCacheKey, getCachedResponse, setCache } from './cache-manager';
import { buildConfig, defaultConfig, mergeConfig } from './config-handler';
import { getRetryAfterMs } from './retry-handler';

/**
 * Create Request Handler
 *
 * @param {RequestHandlerConfig} config - Configuration object for the request handler
 * @returns {Object} An object with methods for handling requests
 */
export function createRequestHandler(
  config: RequestHandlerConfig | null,
): RequestHandlerReturnType {
  const sanitizedConfig = config ? sanitizeObject(config) : {};
  const handlerConfig: RequestHandlerConfig = {
    ...defaultConfig,
    ...sanitizedConfig,
  };

  mergeConfig('retry', handlerConfig, defaultConfig, sanitizedConfig);
  mergeConfig('headers', handlerConfig, defaultConfig, sanitizedConfig);

  /**
   * Immediately create instance of custom fetcher if it is defined
   */
  const requestInstance = sanitizedConfig.fetcher?.create?.(handlerConfig);

  /**
   * Get Provider Instance
   *
   * @returns {CreatedCustomFetcherInstance | null} Provider's instance
   */
  const getInstance = (): CreatedCustomFetcherInstance | null => {
    return requestInstance || null;
  };

  /**
   * Request function to make HTTP requests with the provided URL and configuration.
   *
   * @param {string} url - Request URL
   * @param {RequestConfig} reqConfig - Request config passed when making the request
   * @throws {ResponseError} If the request fails or is cancelled
   * @returns {Promise<FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>>} Response Data
   */
  const request = async <
    ResponseData = DefaultResponse,
    QueryParams = DefaultParams,
    PathParams = DefaultUrlParams,
    RequestBody = DefaultPayload,
  >(
    url: string,
    reqConfig: RequestConfig<
      ResponseData,
      QueryParams,
      PathParams,
      RequestBody
    > | null = null,
  ): Promise<
    FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>
  > => {
    const _reqConfig = reqConfig ? sanitizeObject(reqConfig) : {};

    // Ensure immutability
    const mergedConfig = {
      ...handlerConfig,
      ..._reqConfig,
    };

    mergeConfig('retry', mergedConfig, handlerConfig, _reqConfig);
    mergeConfig('headers', mergedConfig, handlerConfig, _reqConfig);

    let response: FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    > | null = null;
    const fetcherConfig = buildConfig(url, mergedConfig);

    const {
      timeout,
      cancellable,
      dedupeTime,
      pollingInterval,
      shouldStopPolling,
      cacheTime,
      cacheKey,
    } = mergedConfig;

    // Prevent performance overhead of cache access
    let _cacheKey: string | null = null;

    // Generate cache key if required
    if (cacheTime || dedupeTime || cancellable || timeout) {
      _cacheKey = cacheKey
        ? cacheKey(fetcherConfig)
        : generateCacheKey(fetcherConfig);
    }

    // Cache handling logic
    if (cacheTime) {
      const cached = getCachedResponse<
        ResponseData,
        RequestBody,
        QueryParams,
        PathParams
      >(_cacheKey, cacheTime, mergedConfig.cacheBuster, fetcherConfig);

      if (cached) {
        return cached;
      }
    }

    // Deduplication logic
    if (_cacheKey && dedupeTime) {
      const inflight = getInFlightPromise(_cacheKey, dedupeTime);

      if (inflight) {
        return (await inflight) as FetchResponse<
          ResponseData,
          RequestBody,
          QueryParams,
          PathParams
        >;
      }
    }

    // The actual request logic as a promise
    const doRequest = (async () => {
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
      let attempt = 0;
      let pollingAttempt = 0;
      let waitTime: number = delay || 0;
      const _retries = retries > 0 ? retries : 0;

      while (attempt <= _retries) {
        try {
          // Add the request to the queue. Make sure to handle deduplication, cancellation, timeouts in accordance to retry settings
          const controller = await queueRequest(
            _cacheKey,
            fetcherConfig.url as string,
            timeout,
            dedupeTime,
            cancellable,
            // Reset timeouts by default or when retries are ON
            !!(timeout && (!_retries || resetTimeout)),
          );

          // Shallow copy to ensure basic idempotency
          // Note that the refrence of the main object does not change here so it is safe in context of queue management and interceptors
          const requestConfig: RequestConfig = {
            signal: controller.signal,
            ...fetcherConfig,
          };

          // Local interceptors
          await applyInterceptor(requestConfig, _reqConfig.onRequest);

          // Global interceptors
          await applyInterceptor(requestConfig, handlerConfig.onRequest);

          response = requestInstance?.request
            ? await requestInstance.request(requestConfig)
            : ((await fetch(
                requestConfig.url as string,
                requestConfig as RequestInit,
              )) as unknown as FetchResponse<
                ResponseData,
                RequestBody,
                QueryParams,
                PathParams
              >);

          // Add more information to response object
          if (response instanceof Response) {
            response.config = requestConfig;
            response.data = await parseResponseData(response);

            // Check if the response status is not outside the range 200-299 and if so, output error
            if (!response.ok) {
              throw new ResponseError(
                `${requestConfig.method} to ${requestConfig.url} failed! Status: ${response.status || null}`,
                requestConfig,
                response,
              );
            }
          }

          // Local interceptors
          await applyInterceptor(response, _reqConfig.onResponse);

          // Global interceptors
          await applyInterceptor(response, handlerConfig.onResponse);

          removeRequestFromQueue(_cacheKey);

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

          // Polling logic
          if (
            pollingInterval &&
            // If polling is not required, or polling attempts are exhausted
            (!shouldStopPolling || !shouldStopPolling(output, pollingAttempt))
          ) {
            // Restart the main retry loop
            pollingAttempt++;

            logger(mergedConfig, 'Polling attempt ' + pollingAttempt + '...');

            await delayInvocation(pollingInterval);

            continue;
          }

          if (
            cacheTime &&
            _cacheKey &&
            (!requestConfig.skipCache ||
              !requestConfig.skipCache(output, requestConfig))
          ) {
            setCache(_cacheKey, output);
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
          error.status = error?.status || response?.status || 0;
          error.statusText = error?.statusText || response?.statusText || '';
          error.config = fetcherConfig;
          error.request = fetcherConfig;
          error.response = response;

          // Prepare Extended Response
          const output = prepareResponse<
            ResponseData,
            QueryParams,
            PathParams,
            RequestBody
          >(response, fetcherConfig, error);

          if (
            // We check retries provided regardless of the shouldRetry being provided so to avoid infinite loops.
            // It is a fail-safe so to prevent excessive retry attempts even if custom retry logic suggests a retry.
            attempt === _retries || // Stop if the maximum retries have been reached
            !retryOn?.includes(error.status) || // Check if the error status is retryable
            !shouldRetry ||
            !(await shouldRetry(output, attempt)) // If shouldRetry is defined, evaluate it
          ) {
            if (!isRequestCancelled(error as ResponseError)) {
              logger(mergedConfig, 'FETCH ERROR', error as ResponseError);
            }

            // Local interceptors
            await applyInterceptor(error, _reqConfig.onError);

            // Global interceptors
            await applyInterceptor(error, handlerConfig.onError);

            // Remove the request from the queue
            removeRequestFromQueue(_cacheKey);

            // Only handle the error if the request was not cancelled,
            // or if it was cancelled and rejectCancelled is true
            const isCancelled = isRequestCancelled(error as ResponseError);
            const shouldHandleError =
              !isCancelled || mergedConfig.rejectCancelled;

            if (shouldHandleError) {
              const errorHandlingStrategy = mergedConfig.strategy;

              // Reject the promise
              if (errorHandlingStrategy === 'reject') {
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

      return prepareResponse<
        ResponseData,
        QueryParams,
        PathParams,
        RequestBody
      >(response, fetcherConfig);
    })();

    // If deduplication is enabled, store the in-flight promise
    if (_cacheKey && dedupeTime) {
      setInFlightPromise(_cacheKey, doRequest);
    }

    return doRequest;
  };

  return {
    getInstance,
    config: handlerConfig,
    request,
  };
}

/**
 * Output error response depending on chosen strategy
 *
 * @param {ResponseError} error               Error instance
 * @returns {boolean}                        True if request is aborted
 */
const isRequestCancelled = (error: ResponseError): boolean => {
  return error.name === ABORT_ERROR || error.name === CANCELLED_ERROR;
};

/**
 * Logs messages or errors using the configured logger's `warn` method.
 *
 * @param {RequestConfig} reqConfig - Request config passed when making the request
 * @param {...(string | ResponseError<any>)} args - Messages or errors to log.
 */
const logger = (
  reqConfig: RequestConfig,
  ...args: (string | ResponseError<any>)[]
): void => {
  const logger = reqConfig.logger;

  if (logger && logger.warn) {
    logger.warn(...args);
  }
};
