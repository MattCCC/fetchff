/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  DefaultResponse,
  RequestHandlerConfig,
  RequestConfig,
  Method,
  RetryOptions,
  FetchResponse,
  RequestHandlerReturnType,
  CreatedCustomFetcherInstance,
  FetcherConfig,
  FetcherInstance,
  Logger,
  HeadersObject,
} from './types/request-handler';
import type {
  BodyPayload,
  DefaultParams,
  DefaultPayload,
  DefaultUrlParams,
  QueryParams,
} from './types/api-handler';
import { applyInterceptor } from './interceptor-manager';
import { ResponseError } from './errors/response-error';
import {
  appendQueryParams,
  isJSONSerializable,
  replaceUrlPathParams,
  delayInvocation,
  flattenData,
  processHeaders,
  isSearchParams,
  sanitizeObject,
} from './utils';
import { addRequest, removeRequest } from './queue-manager';
import {
  ABORT_ERROR,
  APPLICATION_JSON,
  CANCELLED_ERROR,
  CHARSET_UTF_8,
  CONTENT_TYPE,
  FUNCTION,
  GET,
  HEAD,
  OBJECT,
  STRING,
  UNDEFINED,
} from './constants';
import { parseResponseData } from './response-parser';
import { generateCacheKey, getCache, setCache } from './cache-manager';

const defaultConfig: RequestHandlerConfig = {
  method: GET,
  strategy: 'reject',
  timeout: 30000,
  dedupeTime: 1000,
  defaultResponse: null,
  headers: {
    Accept: APPLICATION_JSON + ', text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
  },
  retry: {
    delay: 1000,
    maxDelay: 30000,
    resetTimeout: true,
    backoff: 1.5,

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
    retryOn: [
      408, // Request Timeout
      409, // Conflict
      425, // Too Early
      429, // Too Many Requests
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
    ],
  },
};

/**
 * Create Request Handler
 *
 * @param {RequestHandlerConfig} config - Configuration object for the request handler
 * @returns {Object} An object with methods for handling requests
 */
export function createRequestHandler(
  config: RequestHandlerConfig,
): RequestHandlerReturnType {
  const sanitizedConfig = sanitizeObject(config);
  const handlerConfig: RequestHandlerConfig = {
    ...defaultConfig,
    ...sanitizedConfig,
  };

  /**
   * Merges the specified property from the base configuration and the new configuration into the target configuration.
   *
   * @param {K} property - The property key to merge from the base and new configurations. Must be a key of RequestHandlerConfig.
   * @param {RequestHandlerConfig} targetConfig - The configuration object that will receive the merged properties.
   * @param {RequestHandlerConfig} baseConfig - The base configuration object that provides default values.
   * @param {RequestHandlerConfig} newConfig - The new configuration object that contains user-specific settings to merge.
   */
  const mergeConfig = <K extends keyof RequestHandlerConfig>(
    property: K,
    targetConfig: RequestHandlerConfig,
    baseConfig: RequestHandlerConfig,
    newConfig: RequestHandlerConfig,
  ) => {
    if (newConfig[property]) {
      targetConfig[property] = {
        ...baseConfig[property],
        ...newConfig[property],
      };
    }
  };

  mergeConfig('retry', handlerConfig, defaultConfig, sanitizedConfig);
  mergeConfig('headers', handlerConfig, defaultConfig, sanitizedConfig);

  /**
   * Gets a configuration value from `reqConfig`, defaulting to `handlerConfig` if not present.
   *
   * @param {RequestConfig} reqConfig - Request configuration object.
   * @param {keyof RequestConfig} name - Key of the configuration value.
   * @returns {T} - The configuration value.
   */
  const getConfig = <T = unknown>(
    reqConfig: RequestConfig,
    name: keyof RequestConfig,
  ): T => {
    return typeof reqConfig[name] !== UNDEFINED
      ? reqConfig[name]
      : handlerConfig[name];
  };

  /**
   * Immediately create instance of custom fetcher if it is defined
   */
  const customFetcher = getConfig<FetcherInstance>(sanitizedConfig, 'fetcher');
  const requestInstance = customFetcher?.create(handlerConfig) || null;

  /**
   * Get Provider Instance
   *
   * @returns {CreatedCustomFetcherInstance | null} Provider's instance
   */
  const getInstance = (): CreatedCustomFetcherInstance | null => {
    return requestInstance;
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
    const logger = getConfig<Logger>(reqConfig, 'logger');

    if (logger?.warn) {
      logger.warn(...args);
    }
  };

  /**
   * Ensures the `Content-Type` header is set to `application/json; charset=utf-8`
   * if it is not already present and the request method and body meet specific conditions.
   *
   * @param headers - The headers object to modify. Can be an instance of `Headers`
   *                  or a plain object conforming to `HeadersInit`.
   * @param method - The HTTP method of the request (e.g., 'PUT', 'DELETE', etc.).
   * @param body - The optional body of the request. If no body is provided and the
   *               method is 'PUT' or 'DELETE', the function exits without modifying headers.
   */
  const setContentTypeIfNeeded = (
    headers: HeadersInit,
    method: string,
    body?: unknown,
  ): void => {
    if (!body && ['PUT', 'DELETE'].includes(method)) {
      return;
    }

    const contentTypeValue = APPLICATION_JSON + ';' + CHARSET_UTF_8;

    if (headers instanceof Headers) {
      if (!headers.has(CONTENT_TYPE)) {
        headers.set(CONTENT_TYPE, contentTypeValue);
      }
    } else if (
      typeof headers === OBJECT &&
      !Array.isArray(headers) &&
      !headers[CONTENT_TYPE]
    ) {
      headers[CONTENT_TYPE] = contentTypeValue;
    }
  };

  /**
   * Build request configuration
   *
   * @param {string} url - Request url
   * @param {RequestConfig} requestConfig - Request config passed when making the request
   * @returns {RequestConfig} - Provider's instance
   */
  const buildConfig = (
    url: string,
    requestConfig: RequestConfig,
  ): FetcherConfig => {
    const method = getConfig<string>(
      requestConfig,
      'method',
    ).toUpperCase() as Method;
    const isGetAlikeMethod = method === GET || method === HEAD;

    const dynamicUrl = replaceUrlPathParams(
      url,
      getConfig(requestConfig, 'urlPathParams'),
    );

    // The explicitly passed "params"
    const explicitParams = getConfig<QueryParams>(requestConfig, 'params');

    // The explicitly passed "body" or "data"
    const explicitBodyData: BodyPayload =
      getConfig(requestConfig, 'body') || getConfig(requestConfig, 'data');

    // Final body data
    let body: RequestConfig['data'];

    // Only applicable for request methods 'PUT', 'POST', 'DELETE', and 'PATCH'
    if (!isGetAlikeMethod) {
      body = explicitBodyData;
    }

    const headers = getConfig<HeadersObject>(requestConfig, 'headers');

    setContentTypeIfNeeded(headers, method, body);

    // Native fetch compatible settings
    const isWithCredentials = getConfig<boolean>(
      requestConfig,
      'withCredentials',
    );

    const credentials = isWithCredentials
      ? 'include'
      : getConfig<RequestCredentials>(requestConfig, 'credentials');

    const urlPath = explicitParams
      ? appendQueryParams(dynamicUrl, explicitParams)
      : dynamicUrl;
    const isFullUrl = urlPath.includes('://');
    const baseURL = isFullUrl
      ? ''
      : getConfig<string>(requestConfig, 'baseURL') ||
        getConfig<string>(requestConfig, 'apiUrl');

    // Automatically stringify request body, if possible and when not dealing with strings
    if (
      body &&
      typeof body !== STRING &&
      !isSearchParams(body) &&
      isJSONSerializable(body)
    ) {
      body = JSON.stringify(body);
    }

    return {
      ...requestConfig,
      credentials,
      body,
      method,
      headers,
      url: baseURL + urlPath,
    };
  };

  /**
   * Process global Request Error
   *
   * @param {ResponseError<ResponseData, QueryParams, PathParams, RequestBody>} error      Error instance
   * @param {RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>} requestConfig   Per endpoint request config
   * @returns {Promise<void>}
   */
  const processError = async <
    ResponseData = DefaultResponse,
    QueryParams = DefaultParams,
    PathParams = DefaultUrlParams,
    RequestBody = DefaultPayload,
  >(
    error: ResponseError<ResponseData, QueryParams, PathParams, RequestBody>,
    requestConfig: RequestConfig<
      ResponseData,
      QueryParams,
      PathParams,
      RequestBody
    >,
  ): Promise<void> => {
    if (!isRequestCancelled(error as ResponseError)) {
      logger(requestConfig, 'API ERROR', error as ResponseError);
    }

    // Local interceptors
    await applyInterceptor(error, requestConfig?.onError);

    // Global interceptors
    await applyInterceptor(error, handlerConfig?.onError);
  };

  /**
   * Output default response in case of an error, depending on chosen strategy
   *
   * @param {ResponseError<ResponseData, QueryParams, PathParams, RequestBody>} error - Error instance
   * @param {FetchResponse<ResponseData, RequestBody> | null} response - Response. It may be "null" in case of request being aborted.
   * @param {RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>} requestConfig - Per endpoint request config
   * @returns {FetchResponse<ResponseData, RequestBody>} Response together with the error object
   */
  const outputErrorResponse = async <
    ResponseData = DefaultResponse,
    QueryParams = DefaultParams,
    PathParams = DefaultUrlParams,
    RequestBody = DefaultPayload,
  >(
    error: ResponseError<ResponseData, QueryParams, PathParams, RequestBody>,
    response: FetchResponse<ResponseData, RequestBody> | null,
    requestConfig: RequestConfig<
      ResponseData,
      QueryParams,
      PathParams,
      RequestBody
    >,
  ): Promise<any> => {
    const _isRequestCancelled = isRequestCancelled(error as ResponseError);
    const errorHandlingStrategy = getConfig<string>(requestConfig, 'strategy');
    const rejectCancelled = getConfig<boolean>(
      requestConfig,
      'rejectCancelled',
    );

    // By default cancelled requests aren't rejected (softFail strategy)
    if (!(_isRequestCancelled && !rejectCancelled)) {
      // Hang the promise
      if (errorHandlingStrategy === 'silent') {
        await new Promise(() => null);
      }
      // Reject the promise
      else if (errorHandlingStrategy === 'reject') {
        return Promise.reject(error);
      }
    }

    return outputResponse<ResponseData, QueryParams, PathParams, RequestBody>(
      response,
      requestConfig,
      error,
    );
  };

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
   * Handle Request depending on used strategy
   *
   * @param {string} url - Request url
   * @param {RequestConfig} reqConfig - Request config passed when making the request
   * @throws {ResponseError}
   * @returns {Promise<FetchResponse<ResponseData>>} Response Data
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
  ): Promise<FetchResponse<ResponseData, RequestBody>> => {
    const _reqConfig = sanitizeObject(reqConfig || {});
    const mergedConfig = {
      ...handlerConfig,
      ..._reqConfig,
    };

    mergeConfig('retry', mergedConfig, handlerConfig, _reqConfig);
    mergeConfig('headers', mergedConfig, handlerConfig, _reqConfig);

    let response: FetchResponse<ResponseData> | null = null;
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

    if (cacheTime) {
      _cacheKey = cacheKey
        ? cacheKey(fetcherConfig)
        : generateCacheKey(fetcherConfig);

      if (_cacheKey) {
        const cacheBuster = mergedConfig.cacheBuster;
        const shouldBust = cacheBuster && cacheBuster(fetcherConfig);

        if (!shouldBust) {
          const cachedEntry = getCache<FetchResponse<ResponseData>>(
            _cacheKey,
            cacheTime,
          );

          if (cachedEntry) {
            // Serve stale data from cache
            return cachedEntry.data;
          }
        }
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
    } = mergedConfig.retry as Required<
      RetryOptions<ResponseData, QueryParams, PathParams, RequestBody>
    >;

    let attempt = 0;
    let pollingAttempt = 0;
    let waitTime: number = delay;
    const _retries = retries > 0 ? retries : 0;

    while (attempt <= _retries) {
      try {
        // Add the request to the queue. Make sure to handle deduplication, cancellation, timeouts in accordance to retry settings
        const controller = await addRequest(
          fetcherConfig,
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
        await applyInterceptor(requestConfig, _reqConfig?.onRequest);

        // Global interceptors
        await applyInterceptor(requestConfig, handlerConfig?.onRequest);

        if (
          customFetcher !== null &&
          requestInstance !== null &&
          typeof requestInstance.request === FUNCTION
        ) {
          response = await requestInstance.request(requestConfig);
        } else {
          response = (await fetch(
            requestConfig.url as string,
            requestConfig as RequestInit,
          )) as unknown as FetchResponse<ResponseData, RequestBody>;
        }

        // Add more information to response object
        if (response instanceof Response) {
          response.config = requestConfig;
          response.data = await parseResponseData(response);

          // Check if the response status is not outside the range 200-299 and if so, output error
          if (!response.ok) {
            throw new ResponseError<
              ResponseData,
              QueryParams,
              PathParams,
              RequestBody
            >(
              `${requestConfig.url} failed! Status: ${response.status || null}`,
              requestConfig,
              response,
            );
          }
        }

        // Local interceptors
        await applyInterceptor(response, _reqConfig?.onResponse);

        // Global interceptors
        await applyInterceptor(response, handlerConfig?.onResponse);

        removeRequest(fetcherConfig);

        if (
          shouldRetry &&
          attempt < retries &&
          (await shouldRetry(
            { config: fetcherConfig, request: fetcherConfig, response },
            attempt,
          ))
        ) {
          logger(
            mergedConfig,
            `Attempt ${attempt + 1} failed response data check. Retry in ${waitTime}ms.`,
          );

          await delayInvocation(waitTime);

          waitTime *= backoff;
          waitTime = Math.min(waitTime, maxDelay);
          attempt++;
          continue; // Retry the request
        }

        // Polling logic
        if (
          pollingInterval &&
          (!shouldStopPolling || !shouldStopPolling(response, pollingAttempt))
        ) {
          // Restart the main retry loop
          pollingAttempt++;

          logger(requestConfig, 'Polling attempt ' + pollingAttempt + '...');

          await delayInvocation(pollingInterval);

          continue;
        }

        // If polling is not required, or polling attempts are exhausted
        const output = outputResponse<
          ResponseData,
          QueryParams,
          PathParams,
          RequestBody
        >(response, requestConfig);

        if (cacheTime && _cacheKey) {
          const skipCache = requestConfig.skipCache;

          if (!skipCache || !skipCache(output, requestConfig)) {
            setCache(_cacheKey, output);
          }
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

        if (
          // We check retries provided regardless of the shouldRetry being provided so to avoid infinite loops.
          // It is a fail-safe so to prevent excessive retry attempts even if custom retry logic suggests a retry.
          attempt === retries || // Stop if the maximum retries have been reached
          !retryOn?.includes(error.status) || // Check if the error status is retryable
          !(await shouldRetry?.(error, attempt)) // If shouldRetry is defined, evaluate it
        ) {
          await processError<
            ResponseData,
            QueryParams,
            PathParams,
            RequestBody
          >(error, fetcherConfig);

          removeRequest(fetcherConfig);

          return outputErrorResponse<
            ResponseData,
            QueryParams,
            PathParams,
            RequestBody
          >(error, response, fetcherConfig);
        }

        logger(
          mergedConfig,
          `Attempt ${attempt + 1} failed. Retry in ${waitTime}ms.`,
        );

        await delayInvocation(waitTime);

        waitTime *= backoff;
        waitTime = Math.min(waitTime, maxDelay);
        attempt++;
      }
    }

    return outputResponse<ResponseData, QueryParams, PathParams, RequestBody>(
      response,
      fetcherConfig,
    );
  };

  /**
   * Output response
   *
   * @param Response. It may be "null" in case of request being aborted.
   * @param {RequestConfig} requestConfig - Request config
   * @param error - whether the response is erroneous
   * @returns {FetchResponse<ResponseData>} Response data
   */
  const outputResponse = <
    ResponseData = DefaultResponse,
    QueryParams = DefaultParams,
    PathParams = DefaultUrlParams,
    RequestBody = DefaultPayload,
  >(
    response: FetchResponse<ResponseData, RequestBody> | null,
    requestConfig: RequestConfig<
      ResponseData,
      QueryParams,
      PathParams,
      RequestBody
    >,
    error: ResponseError<
      ResponseData,
      QueryParams,
      PathParams,
      RequestBody
    > | null = null,
  ): FetchResponse<ResponseData, RequestBody> => {
    const defaultResponse = getConfig<any>(requestConfig, 'defaultResponse');

    // This may happen when request is cancelled.
    if (!response) {
      return {
        ok: false,
        // Enhance the response with extra information
        error,
        data: defaultResponse,
        headers: null,
        config: requestConfig,
      } as unknown as FetchResponse<ResponseData>;
    }

    let data = response?.data;

    // Set the default response if the provided data is an empty object
    if (
      data === undefined ||
      data === null ||
      (typeof data === OBJECT && Object.keys(data).length === 0)
    ) {
      data = defaultResponse;
    }

    // Return flattened response immediately
    const flattenResponse = getConfig<boolean>(
      requestConfig,
      'flattenResponse',
    );

    if (flattenResponse) {
      response.data = flattenData(data);
    }

    // If it's a custom fetcher, and it does not return any Response instance, it may have its own internal handler
    if (!(response instanceof Response)) {
      return response;
    }

    // Native fetch Response extended by extra information
    return {
      body: response.body,
      bodyUsed: response.bodyUsed,
      ok: response.ok,
      redirected: response.redirected,
      type: response.type,
      url: response.url,
      status: response.status,
      statusText: response.statusText,

      // Convert methods to use arrow functions to preserve correct return types
      blob: () => response.blob(),
      json: () => response.json(),
      text: () => response.text(),
      clone: () => response.clone(),
      arrayBuffer: () => response.arrayBuffer(),
      formData: () => response.formData(),
      bytes: () => response.bytes(),

      // Enhance the response with extra information
      error,
      data,
      headers: processHeaders(response.headers),
      config: requestConfig,
    };
  };

  return {
    getInstance,
    buildConfig,
    config: handlerConfig,
    request,
  };
}
