/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  RequestHandlerConfig,
  RequestConfig,
  FetcherInstance,
  Method,
  RetryOptions,
  FetchResponse,
  ResponseError,
  RequestHandlerReturnType,
} from './types/request-handler';
import type {
  APIResponse,
  BodyPayload,
  QueryParams,
  QueryParamsOrBody,
} from './types/api-handler';
import { interceptRequest, interceptResponse } from './interceptor-manager';
import { ResponseErr } from './response-error';
import {
  appendQueryParams,
  isJSONSerializable,
  replaceUrlPathParams,
  delayInvocation,
  flattenData,
  processHeaders,
  deleteProperty,
} from './utils';
import { addRequest, removeRequest } from './queue-manager';
import { APPLICATION_JSON, CONTENT_TYPE } from './const';
import { parseResponseData } from './response-parser';

const defaultConfig: RequestHandlerConfig = {
  method: 'GET',
  strategy: 'reject',
  timeout: 30000,
  rejectCancelled: false,
  dedupeTime: 1000,
  withCredentials: false,
  flattenResponse: false,
  defaultResponse: null,
  logger: null,
  fetcher: null,
  baseURL: '',
  retry: {
    retries: 0,
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

    shouldRetry: async () => true,
  },
};

/**
 * Create a Request Handler
 *
 * @param {RequestHandlerConfig} config - Configuration object for the request handler
 * @returns {Object} An object with methods for handling requests
 */
function createRequestHandler(
  config: RequestHandlerConfig,
): RequestHandlerReturnType {
  const handlerConfig: RequestHandlerConfig = {
    ...defaultConfig,
    baseURL: config.apiUrl || '',
    ...config,
  };

  /**
   * Detects if a custom fetcher is utilized
   *
   * @returns {boolean}                        True if it's a custom fetcher
   */
  const isCustomFetcher = (): boolean => {
    return handlerConfig.fetcher !== null;
  };

  const requestInstance = isCustomFetcher()
    ? (handlerConfig.fetcher as any).create({
        ...config,
        baseURL: handlerConfig.baseURL,
        timeout: handlerConfig.timeout,
      })
    : null;

  /**
   * Get Provider Instance
   *
   * @returns {FetcherInstance} Provider's instance
   */
  const getInstance = (): FetcherInstance => {
    return requestInstance;
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
  ): RequestConfig => {
    const method = (
      reqConfig.method || (handlerConfig.method as string)
    ).toUpperCase() as Method;
    const isGetAlikeMethod = method === 'GET' || method === 'HEAD';

    const dynamicUrl = replaceUrlPathParams(
      url,
      reqConfig.urlPathParams || handlerConfig.urlPathParams || null,
    );

    // The explicitly passed "params"
    const explicitParams = reqConfig.params || handlerConfig.params;

    // The explicitly passed "body" or "data"
    const explicitBodyData =
      reqConfig.body ||
      reqConfig.data ||
      handlerConfig.body ||
      handlerConfig.data;

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

    if (isCustomFetcher()) {
      return {
        ...reqConfig,
        method,
        url: dynamicUrl,
        params: shouldTreatDataAsParams
          ? (data as QueryParams)
          : explicitParams,
        data: body,
      };
    }

    // Native fetch
    const isWithCredentials =
      typeof reqConfig.withCredentials !== 'undefined'
        ? reqConfig.withCredentials
        : handlerConfig.withCredentials;

    const credentials = isWithCredentials
      ? 'include'
      : reqConfig.credentials || handlerConfig.credentials || undefined;

    deleteProperty(reqConfig, 'data');
    deleteProperty(reqConfig, 'withCredentials');

    const urlPath =
      explicitParams || shouldTreatDataAsParams
        ? appendQueryParams(dynamicUrl, explicitParams || (data as QueryParams))
        : dynamicUrl;
    const isFullUrl = urlPath.includes('://');
    const baseURL = isFullUrl ? '' : reqConfig.baseURL || handlerConfig.baseURL;

    // Automatically stringify request body, if possible and when not dealing with strings
    if (
      body &&
      typeof body !== 'string' &&
      !(body instanceof URLSearchParams) &&
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

      // Add sensible defaults
      headers: {
        Accept: APPLICATION_JSON + ', text/plain, */*',
        [CONTENT_TYPE]: APPLICATION_JSON + ';charset=utf-8',
        ...(handlerConfig.headers || {}),
        ...(reqConfig.headers || {}),
      },
    };
  };

  /**
   * Process global Request Error
   *
   * @param {ResponseError} error      Error instance
   * @param {RequestConfig} requestConfig   Per endpoint request config
   * @returns {void}
   */
  const processError = (
    error: ResponseError,
    requestConfig: RequestConfig,
  ): void => {
    if (isRequestCancelled(error)) {
      return;
    }

    if (handlerConfig.logger?.warn) {
      handlerConfig.logger.warn('API ERROR', error);
    }

    // Invoke per request "onError" interceptor
    if (requestConfig.onError) {
      requestConfig.onError(error);
    }

    // Invoke global "onError" interceptor
    if (handlerConfig.onError) {
      handlerConfig.onError(error);
    }
  };

  /**
   * Output default response in case of an error, depending on chosen strategy
   *
   * @param {ResponseError} error      Error instance
   * @param {FetchResponse} response      Response
   * @param {RequestConfig} requestConfig   Per endpoint request config
   * @returns {*} Error response
   */
  const outputErrorResponse = async (
    error: ResponseError,
    response: FetchResponse | null,
    requestConfig: RequestConfig,
  ): Promise<any> => {
    const _isRequestCancelled = isRequestCancelled(error);
    const errorHandlingStrategy =
      requestConfig.strategy || handlerConfig.strategy;
    const rejectCancelled =
      typeof requestConfig.rejectCancelled !== 'undefined'
        ? requestConfig.rejectCancelled
        : handlerConfig.rejectCancelled;

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

    return outputResponse(response, requestConfig, error);
  };

  /**
   * Output error response depending on chosen strategy
   *
   * @param {ResponseError} error               Error instance
   * @returns {boolean}                        True if request is aborted
   */
  const isRequestCancelled = (error: ResponseError): boolean => {
    return error.name === 'AbortError' || error.name === 'CanceledError';
  };

  /**
   * Handle Request depending on used strategy
   *
   * @param {string} url - Request url
   * @param {QueryParamsOrBody} data - Query Params in case of GET and HEAD requests, body payload otherwise
   * @param {RequestConfig} reqConfig - Request config
   * @throws {ResponseError}
   * @returns {Promise<ResponseData & FetchResponse<ResponseData>>} Response Data
   */
  const request = async <ResponseData = APIResponse>(
    url: string,
    data: QueryParamsOrBody = null,
    reqConfig: RequestConfig | null = null,
  ): Promise<ResponseData & FetchResponse<ResponseData>> => {
    let response: FetchResponse<ResponseData> | null = null;
    const _reqConfig = reqConfig || {};
    const fetcherConfig = buildConfig(url, data, _reqConfig);

    const timeout =
      typeof fetcherConfig.timeout !== 'undefined'
        ? fetcherConfig.timeout
        : (handlerConfig.timeout as number);
    const isCancellable =
      typeof fetcherConfig.cancellable !== 'undefined'
        ? fetcherConfig.cancellable
        : handlerConfig.cancellable;
    const dedupeTime =
      typeof fetcherConfig.dedupeTime !== 'undefined'
        ? fetcherConfig.dedupeTime
        : handlerConfig.dedupeTime;

    const {
      retries,
      delay,
      backoff,
      retryOn,
      shouldRetry,
      maxDelay,
      resetTimeout,
    } = {
      ...handlerConfig.retry,
      ...(fetcherConfig?.retry || {}),
    } as Required<RetryOptions>;

    let attempt = 0;
    let waitTime: number = delay;

    while (attempt <= retries) {
      try {
        // Add the request to the queue. Make sure to handle deduplication, cancellation, timeouts in accordance to retry settings
        const controller = await addRequest(
          fetcherConfig,
          timeout,
          dedupeTime,
          isCancellable,
          // Reset timeouts by default or when retries are ON
          timeout > 0 && (!retries || resetTimeout),
        );
        const signal = controller.signal;

        let requestConfig: RequestConfig = {
          signal,
          ...fetcherConfig,
        };

        // Local interceptors
        requestConfig = await interceptRequest(
          requestConfig,
          requestConfig?.onRequest,
        );

        // Global interceptors
        requestConfig = await interceptRequest(
          requestConfig,
          handlerConfig?.onRequest,
        );

        if (isCustomFetcher()) {
          response = (await (requestInstance as any).request(
            requestConfig,
          )) as FetchResponse<ResponseData>;
        } else {
          response = (await fetch(
            requestConfig.url as string,
            requestConfig as RequestInit,
          )) as FetchResponse<ResponseData>;

          // Add more information to response object
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
        response = await interceptResponse(response, requestConfig?.onResponse);

        // Global interceptors
        response = await interceptResponse(response, handlerConfig?.onResponse);

        removeRequest(fetcherConfig);

        return outputResponse(response, requestConfig) as ResponseData &
          FetchResponse<ResponseData>;
      } catch (err) {
        const error = err as ResponseError;
        const status = error?.response?.status || (error as any)?.status || 0;

        if (
          attempt === retries ||
          !(await shouldRetry(error, attempt)) ||
          !retryOn?.includes(status)
        ) {
          processError(error, fetcherConfig);

          removeRequest(fetcherConfig);

          return outputErrorResponse(error, response, fetcherConfig);
        }

        if (handlerConfig.logger?.warn) {
          handlerConfig.logger.warn(
            `Attempt ${attempt + 1} failed. Retrying in ${waitTime}ms...`,
          );
        }

        await delayInvocation(waitTime);

        waitTime *= backoff;
        waitTime = Math.min(waitTime, maxDelay);
        attempt++;
      }
    }

    return outputResponse(response, fetcherConfig) as ResponseData &
      FetchResponse<ResponseData>;
  };

  /**
   * Output response
   *
   * @param response - Response payload
   * @param {RequestConfig} requestConfig - Request config
   * @param error - whether the response is erroneous
   * @returns {ResponseData | FetchResponse<ResponseData>} Response data
   */
  const outputResponse = <ResponseData = APIResponse>(
    response: FetchResponse<ResponseData> | null,
    requestConfig: RequestConfig,
    error: ResponseError<ResponseData> | null = null,
  ): ResponseData | FetchResponse<ResponseData> => {
    const defaultResponse =
      typeof requestConfig.defaultResponse !== 'undefined'
        ? requestConfig.defaultResponse
        : handlerConfig.defaultResponse;
    const flattenResponse =
      typeof requestConfig.flattenResponse !== 'undefined'
        ? requestConfig.flattenResponse
        : handlerConfig.flattenResponse;

    if (!response) {
      return flattenResponse
        ? defaultResponse
        : {
            error,
            headers: null,
            data: defaultResponse,
            config: requestConfig,
          };
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
      (typeof data === 'object' && Object.keys(data).length === 0)
    ) {
      data = defaultResponse;
    }

    // Return flattened response immediately
    if (flattenResponse) {
      return flattenData(data);
    }

    if (isCustomFetcher()) {
      return response;
    }

    return {
      // Native fetch()
      body: response.body,
      blob: response.blob,
      json: response.json,
      text: response.text,
      clone: response.clone,
      bodyUsed: response.bodyUsed,
      arrayBuffer: response.arrayBuffer,
      formData: response.formData,
      ok: response.ok,
      redirected: response.redirected,
      type: response.type,
      url: response.url,
      status: response.status,
      statusText: response.statusText,

      // Extend with extra information
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

export { createRequestHandler };
