/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  DefaultResponse,
  RequestHandlerConfig,
  RequestConfig,
  Method,
  RetryOptions,
  FetchResponse,
  ResponseError,
  RequestHandlerReturnType,
  CreatedCustomFetcherInstance,
  FetcherConfig,
} from './types/request-handler';
import type {
  BodyPayload,
  DefaultParams,
  DefaultPayload,
  DefaultUrlParams,
  QueryParams,
  QueryParamsOrBody,
} from './types/api-handler';
import { applyInterceptor } from './interceptor-manager';
import { ResponseErr } from './response-error';
import {
  appendQueryParams,
  isJSONSerializable,
  replaceUrlPathParams,
  delayInvocation,
  flattenData,
  processHeaders,
  deleteProperty,
  isSearchParams,
} from './utils';
import { addRequest, removeRequest } from './queue-manager';
import {
  ABORT_ERROR,
  APPLICATION_JSON,
  CANCELLED_ERROR,
  CONTENT_TYPE,
  GET,
  HEAD,
  OBJECT,
  STRING,
  UNDEFINED,
} from './const';
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
    [CONTENT_TYPE]: APPLICATION_JSON + ';charset=utf-8',
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
  const handlerConfig: RequestHandlerConfig = {
    ...defaultConfig,
    ...config,
  };

  /**
   * Immediately create instance of custom fetcher if it is defined
   */
  const customFetcher = handlerConfig.fetcher;
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
   * Logs messages or errors using the configured logger's `warn` method.
   *
   * @param {...(string | ResponseError<any>)} args - Messages or errors to log.
   */
  const logger = (...args: (string | ResponseError<any>)[]): void => {
    if (handlerConfig.logger?.warn) {
      handlerConfig.logger.warn(...args);
    }
  };

  /**
   * Build request configuration
   *
   * @param {string} url - Request url
   * @param {QueryParamsOrBody} data - Query Params in case of GET and HEAD requests, body payload otherwise
   * @param {RequestConfig} reqConfig - Request config passed when making the request
   * @returns {RequestConfig} - Provider's instance
   */
  const buildConfig = (
    url: string,
    data: QueryParamsOrBody,
    reqConfig: RequestConfig,
  ): FetcherConfig => {
    const method = getConfig<string>(
      reqConfig,
      'method',
    ).toUpperCase() as Method;
    const isGetAlikeMethod = method === GET || method === HEAD;

    const dynamicUrl = replaceUrlPathParams(
      url,
      getConfig(reqConfig, 'urlPathParams'),
    );

    // The explicitly passed "params"
    const explicitParams = getConfig<QueryParams>(reqConfig, 'params');

    // The explicitly passed "body" or "data"
    const explicitBodyData: BodyPayload =
      getConfig(reqConfig, 'body') || getConfig(reqConfig, 'data');

    // For convenience, in POST requests the body payload is the "data"
    // In edge cases we want to use Query Params in the POST requests
    // and use explicitly passed "body" or "data" from request config
    const shouldTreatDataAsParams =
      data && (isGetAlikeMethod || explicitBodyData) ? true : false;

    // Final body data
    let body: RequestConfig['data'];

    // Only applicable for request methods 'PUT', 'POST', 'DELETE', and 'PATCH'
    if (!isGetAlikeMethod) {
      body = explicitBodyData || (data as BodyPayload);
    }

    // Native fetch compatible settings
    const isWithCredentials = getConfig<boolean>(reqConfig, 'withCredentials');

    const credentials = isWithCredentials
      ? 'include'
      : getConfig<RequestCredentials>(reqConfig, 'credentials');

    deleteProperty(reqConfig, 'data');
    deleteProperty(reqConfig, 'withCredentials');

    const urlPath =
      explicitParams || shouldTreatDataAsParams
        ? appendQueryParams(dynamicUrl, explicitParams || (data as QueryParams))
        : dynamicUrl;
    const isFullUrl = urlPath.includes('://');
    const baseURL = isFullUrl
      ? ''
      : getConfig<string>(reqConfig, 'baseURL') ||
        getConfig<string>(reqConfig, 'apiUrl');

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
      ...reqConfig,
      credentials,
      body,
      method,

      url: baseURL + urlPath,
    };
  };

  /**
   * Process global Request Error
   *
   * @param {ResponseError<ResponseData>} error      Error instance
   * @param {RequestConfig<ResponseData>} requestConfig   Per endpoint request config
   * @returns {Promise<void>}
   */
  const processError = async <ResponseData = DefaultResponse>(
    error: ResponseError<ResponseData>,
    requestConfig: RequestConfig<ResponseData>,
  ): Promise<void> => {
    if (!isRequestCancelled(error)) {
      logger('API ERROR', error);
    }

    // Local interceptors
    await applyInterceptor(error, requestConfig?.onError);

    // Global interceptors
    await applyInterceptor(error, handlerConfig?.onError);
  };

  /**
   * Output default response in case of an error, depending on chosen strategy
   *
   * @param {ResponseError<ResponseData>} error - Error instance
   * @param {FetchResponse<ResponseData> | null} response - Response. It may be "null" in case of request being aborted.
   * @param {RequestConfig<ResponseData>} requestConfig - Per endpoint request config
   * @returns {FetchResponse<ResponseData>} Response together with the error object
   */
  const outputErrorResponse = async <ResponseData = DefaultResponse>(
    error: ResponseError,
    response: FetchResponse<ResponseData> | null,
    requestConfig: RequestConfig<ResponseData>,
  ): Promise<any> => {
    const _isRequestCancelled = isRequestCancelled(error);
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

    return outputResponse<ResponseData>(response, requestConfig, error);
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
   * @param {QueryParamsOrBody} queryParamsOrBody - Query Params in case of GET and HEAD requests, body payload otherwise
   * @param {RequestConfig} reqConfig - Request config
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
    queryParamsOrBody: QueryParamsOrBody<QueryParams, RequestBody> = null,
    reqConfig: RequestConfig<
      ResponseData,
      QueryParams,
      PathParams,
      RequestBody
    > | null = null,
  ): Promise<FetchResponse<ResponseData>> => {
    const _reqConfig = reqConfig || {};
    const mergedConfig = {
      ...handlerConfig,
      ..._reqConfig,
    } as RequestConfig;

    let response: FetchResponse<ResponseData> | null = null;
    const fetcherConfig = buildConfig(url, queryParamsOrBody, mergedConfig);

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
    let _cacheKey: string;

    if (cacheKey) {
      _cacheKey = cacheKey(fetcherConfig);
    } else {
      _cacheKey = generateCacheKey(fetcherConfig);
    }

    if (cacheTime && _cacheKey) {
      const cacheBuster = mergedConfig.cacheBuster;

      if (!cacheBuster || !cacheBuster(fetcherConfig)) {
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

    const {
      retries = 0,
      delay,
      backoff,
      retryOn,
      shouldRetry,
      maxDelay,
      resetTimeout,
    } = mergedConfig.retry as Required<RetryOptions>;

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
        const requestConfig: RequestConfig = {
          signal: controller.signal,
          ...fetcherConfig,
        };

        // Local interceptors
        await applyInterceptor(requestConfig, _reqConfig?.onRequest);

        // Global interceptors
        await applyInterceptor(requestConfig, handlerConfig?.onRequest);

        if (customFetcher !== null && requestInstance !== null) {
          response = await requestInstance.request(requestConfig);
        } else {
          response = (await fetch(
            requestConfig.url as string,
            requestConfig as RequestInit,
          )) as FetchResponse<ResponseData>;
        }

        // Add more information to response object
        if (response instanceof Response) {
          response.config = requestConfig;
          response.data = await parseResponseData(response);

          // Check if the response status is not outside the range 200-299 and if so, output error
          if (!response.ok) {
            throw new ResponseErr(
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

        // Polling logic
        if (
          pollingInterval &&
          (!shouldStopPolling || !shouldStopPolling(response, pollingAttempt))
        ) {
          // Restart the main retry loop
          pollingAttempt++;

          logger(`Polling attempt ${pollingAttempt}...`);

          await delayInvocation(pollingInterval);

          continue;
        }

        // If polling is not required, or polling attempts are exhausted
        const output = outputResponse<ResponseData>(response, requestConfig);

        if (cacheTime && _cacheKey) {
          const skipCache = requestConfig.skipCache;

          if (!skipCache || !skipCache(output, requestConfig)) {
            setCache(_cacheKey, output);
          }
        }

        return output;
      } catch (err) {
        const error = err as ResponseErr;
        const status = error?.response?.status || error?.status || 0;

        if (
          attempt === retries ||
          !(!shouldRetry || (await shouldRetry(error, attempt))) ||
          !retryOn?.includes(status)
        ) {
          await processError<ResponseData>(error, fetcherConfig);

          removeRequest(fetcherConfig);

          return outputErrorResponse<ResponseData>(
            error,
            response,
            fetcherConfig,
          );
        }

        logger(`Attempt ${attempt + 1} failed. Retry in ${waitTime}ms.`);

        await delayInvocation(waitTime);

        waitTime *= backoff;
        waitTime = Math.min(waitTime, maxDelay);
        attempt++;
      }
    }

    return outputResponse<ResponseData>(response, fetcherConfig);
  };

  /**
   * Output response
   *
   * @param Response. It may be "null" in case of request being aborted.
   * @param {RequestConfig} requestConfig - Request config
   * @param error - whether the response is erroneous
   * @returns {FetchResponse<ResponseData>} Response data
   */
  const outputResponse = <ResponseData = DefaultResponse>(
    response: FetchResponse<ResponseData> | null,
    requestConfig: RequestConfig,
    error: ResponseError<ResponseData> | null = null,
  ): FetchResponse<ResponseData> => {
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

    // Clean up the error object
    deleteProperty(error, 'response');
    deleteProperty(error, 'request');
    deleteProperty(error, 'config');

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
      formData: response.formData,
      ok: response.ok,
      redirected: response.redirected,
      type: response.type,
      url: response.url,
      status: response.status,
      statusText: response.statusText,

      blob: response.blob.bind(response),
      json: response.json.bind(response),
      text: response.text.bind(response),
      clone: response.clone.bind(response),
      arrayBuffer: response.arrayBuffer.bind(response),

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
    config,
    request,
  };
}
