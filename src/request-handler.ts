/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  RequestHandlerConfig,
  RequestConfig,
  FetcherInstance,
  Method,
  RetryOptions,
  FetchResponse,
  ResponseError,
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

/**
 * Generic Request Handler
 * It creates an Request Fetcher instance and handles requests within that instance
 * It handles errors depending on a chosen error handling strategy
 */
export class RequestHandler {
  public requestInstance: FetcherInstance;
  public config: RequestHandlerConfig = {};

  public constructor(config: RequestHandlerConfig) {
    this.config = {
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
      baseURL: config.apiUrl || '',
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
      ...config,
    };

    this.requestInstance = this.isCustomFetcher()
      ? (this.config.fetcher as any).create({
          ...config,
          baseURL: this.config.baseURL,
          timeout: this.config.timeout,
        })
      : null;
  }

  /**
   * Get Provider Instance
   *
   * @returns {FetcherInstance} Provider's instance
   */
  public getInstance(): FetcherInstance {
    return this.requestInstance;
  }

  /**
   * Build request configuration
   *
   * @param {string} url - Request url
   * @param {QueryParamsOrBody} data - Query Params in case of GET and HEAD requests, body payload otherwise
   * @param {RequestConfig} config - Request config passed when making the request
   * @returns {RequestConfig} - Provider's instance
   */
  protected buildConfig(
    url: string,
    data: QueryParamsOrBody,
    config: RequestConfig,
  ): RequestConfig {
    const method = (
      config.method || (this.config.method as string)
    ).toUpperCase() as Method;
    const isGetAlikeMethod = method === 'GET' || method === 'HEAD';

    const dynamicUrl = replaceUrlPathParams(
      url,
      config.urlPathParams || this.config.urlPathParams || null,
    );

    // The explicitly passed "params"
    const explicitParams = config.params || this.config.params;

    // The explicitly passed "body" or "data"
    const explicitBodyData =
      config.body || config.data || this.config.body || this.config.data;

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

    if (this.isCustomFetcher()) {
      return {
        ...config,
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
      typeof config.withCredentials !== 'undefined'
        ? config.withCredentials
        : this.config.withCredentials;

    const credentials = isWithCredentials
      ? 'include'
      : config.credentials || undefined;

    deleteProperty(config, 'data');
    deleteProperty(config, 'withCredentials');

    const urlPath =
      explicitParams || shouldTreatDataAsParams
        ? appendQueryParams(dynamicUrl, explicitParams || (data as QueryParams))
        : dynamicUrl;
    const isFullUrl = urlPath.includes('://');
    const baseURL = isFullUrl ? '' : config.baseURL || this.config.baseURL;

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
      ...config,
      credentials,
      body,
      method,

      url: baseURL + urlPath,

      // Add sensible defaults
      headers: {
        Accept: APPLICATION_JSON + ', text/plain, */*',
        [CONTENT_TYPE]: APPLICATION_JSON + ';charset=utf-8',
        ...(this.config.headers || {}),
        ...(config.headers || {}),
      },
    };
  }

  /**
   * Process global Request Error
   *
   * @param {ResponseError} error      Error instance
   * @param {RequestConfig} requestConfig   Per endpoint request config
   * @returns {void}
   */
  protected processError(
    error: ResponseError,
    requestConfig: RequestConfig,
  ): void {
    if (this.isRequestCancelled(error)) {
      return;
    }

    if (this.config.logger?.warn) {
      this.config.logger.warn('API ERROR', error);
    }

    // Invoke per request "onError" interceptor
    if (requestConfig.onError) {
      requestConfig.onError(error);
    }

    // Invoke global "onError" interceptor
    if (this.config.onError) {
      this.config.onError(error);
    }
  }

  /**
   * Output default response in case of an error, depending on chosen strategy
   *
   * @param {ResponseError} error      Error instance
   * @param {FetchResponse} response      Response
   * @param {RequestConfig} requestConfig   Per endpoint request config
   * @returns {*} Error response
   */
  protected async outputErrorResponse(
    error: ResponseError,
    response: FetchResponse | null,
    requestConfig: RequestConfig,
  ): Promise<any> {
    const isRequestCancelled = this.isRequestCancelled(error);
    const errorHandlingStrategy =
      requestConfig.strategy || this.config.strategy;
    const rejectCancelled =
      typeof requestConfig.rejectCancelled !== 'undefined'
        ? requestConfig.rejectCancelled
        : this.config.rejectCancelled;

    // By default cancelled requests aren't rejected (softFail strategy)
    if (!(isRequestCancelled && !rejectCancelled)) {
      // Hang the promise
      if (errorHandlingStrategy === 'silent') {
        await new Promise(() => null);
      }
      // Reject the promise
      else if (errorHandlingStrategy === 'reject') {
        return Promise.reject(error);
      }
    }

    return this.outputResponse(response, requestConfig, error);
  }

  /**
   * Output error response depending on chosen strategy
   *
   * @param {ResponseError} error               Error instance
   * @returns {boolean}                        True if request is aborted
   */
  public isRequestCancelled(error: ResponseError): boolean {
    return error.name === 'AbortError' || error.name === 'CanceledError';
  }

  /**
   * Detects if a custom fetcher is utilized
   *
   * @returns {boolean}                        True if it's a custom fetcher
   */
  protected isCustomFetcher(): boolean {
    return this.config.fetcher !== null;
  }

  /**
   * Handle Request depending on used strategy
   *
   * @param {string} url - Request url
   * @param {QueryParamsOrBody} data - Query Params in case of GET and HEAD requests, body payload otherwise
   * @param {RequestConfig} config - Request config
   * @throws {ResponseError}
   * @returns {Promise<ResponseData & FetchResponse<ResponseData>>} Response Data
   */
  public async request<ResponseData = APIResponse>(
    url: string,
    data: QueryParamsOrBody = null,
    config: RequestConfig | null = null,
  ): Promise<ResponseData & FetchResponse<ResponseData>> {
    let response: FetchResponse<ResponseData> | null = null;
    const _config = config || {};
    const _requestConfig = this.buildConfig(url, data, _config);

    const timeout =
      typeof _requestConfig.timeout !== 'undefined'
        ? _requestConfig.timeout
        : (this.config.timeout as number);
    const isCancellable =
      typeof _requestConfig.cancellable !== 'undefined'
        ? _requestConfig.cancellable
        : this.config.cancellable;
    const dedupeTime =
      typeof _requestConfig.dedupeTime !== 'undefined'
        ? _requestConfig.dedupeTime
        : this.config.dedupeTime;

    const {
      retries,
      delay,
      backoff,
      retryOn,
      shouldRetry,
      maxDelay,
      resetTimeout,
    } = {
      ...this.config.retry,
      ...(_requestConfig?.retry || {}),
    } as Required<RetryOptions>;

    let attempt = 0;
    let waitTime: number = delay;

    while (attempt <= retries) {
      try {
        // Add the request to the queue. Make sure to handle deduplication, cancellation, timeouts in accordance to retry settings
        const controller = await addRequest(
          _requestConfig,
          timeout,
          dedupeTime,
          isCancellable,
          resetTimeout,
        );
        const signal = controller.signal;

        let requestConfig: RequestConfig = {
          signal,
          ..._requestConfig,
        };

        // Local interceptors
        requestConfig = await interceptRequest(
          requestConfig,
          requestConfig?.onRequest,
        );

        // Global interceptors
        requestConfig = await interceptRequest(
          requestConfig,
          this.config?.onRequest,
        );

        if (this.isCustomFetcher()) {
          response = (await (this.requestInstance as any).request(
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
        response = await interceptResponse(response, this.config?.onResponse);

        return this.outputResponse(response, requestConfig) as ResponseData &
          FetchResponse<ResponseData>;
      } catch (err) {
        const error = err as ResponseError;
        const status = error?.response?.status || (error as any)?.status || 0;

        if (
          attempt === retries ||
          !(await shouldRetry(error, attempt)) ||
          !retryOn?.includes(status)
        ) {
          this.processError(error, _requestConfig);

          removeRequest(_requestConfig);

          return this.outputErrorResponse(error, response, _requestConfig);
        }

        if (this.config.logger?.warn) {
          this.config.logger.warn(
            `Attempt ${attempt + 1} failed. Retrying in ${waitTime}ms...`,
          );
        }

        await delayInvocation(waitTime);

        waitTime *= backoff;
        waitTime = Math.min(waitTime, maxDelay);
        attempt++;
      }
    }

    return this.outputResponse(response, _requestConfig) as ResponseData &
      FetchResponse<ResponseData>;
  }

  /**
   * Output response
   *
   * @param response - Response payload
   * @param {RequestConfig} requestConfig - Request config
   * @param error - whether the response is erroneous
   * @returns {ResponseData | FetchResponse<ResponseData>} Response data
   */
  protected outputResponse<ResponseData = APIResponse>(
    response: FetchResponse<ResponseData> | null,
    requestConfig: RequestConfig,
    error: ResponseError<ResponseData> | null = null,
  ): ResponseData | FetchResponse<ResponseData> {
    const defaultResponse =
      typeof requestConfig.defaultResponse !== 'undefined'
        ? requestConfig.defaultResponse
        : this.config.defaultResponse;
    const flattenResponse =
      typeof requestConfig.flattenResponse !== 'undefined'
        ? requestConfig.flattenResponse
        : this.config.flattenResponse;

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

    const isCustomFetcher = this.isCustomFetcher();

    if (isCustomFetcher) {
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
  }
}
