/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ErrorHandlingStrategy,
  RequestHandlerConfig,
  RequestConfig,
  FetcherInstance,
  Method,
  RetryOptions,
  FetchResponse,
  ResponseError,
  HeadersObject,
  RequestsQueue,
  QueueItem,
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
} from './utils';

const APPLICATION_JSON = 'application/json';

/**
 * Generic Request Handler
 * It creates an Request Fetcher instance and handles requests within that instance
 * It handles errors depending on a chosen error handling strategy
 */
export class RequestHandler {
  public requestInstance: FetcherInstance;
  public baseURL: string = '';
  public timeout: number = 30000;
  public rejectCancelled: boolean = false;
  public strategy: ErrorHandlingStrategy = 'reject';
  public method: Method | string = 'get';
  public flattenResponse: boolean = false;
  public defaultResponse: any = null;
  protected fetcher: FetcherInstance;
  protected logger: any;
  protected requestsQueue: RequestsQueue;
  protected retry: RetryOptions = {
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
  };
  public config: RequestHandlerConfig = {};

  public constructor({
    fetcher = null,
    timeout = null,
    rejectCancelled = false,
    strategy = null,
    flattenResponse = null,
    defaultResponse = {},
    logger = null,
    ...config
  }: RequestHandlerConfig) {
    this.fetcher = fetcher;
    this.timeout =
      timeout !== null && timeout !== undefined ? timeout : this.timeout;
    this.strategy = strategy || this.strategy;
    this.rejectCancelled = rejectCancelled || this.rejectCancelled;
    this.flattenResponse = flattenResponse || this.flattenResponse;
    this.defaultResponse = defaultResponse;
    this.logger = logger || null;
    this.requestsQueue = new WeakMap();
    this.baseURL = config.baseURL || config.apiUrl || '';
    this.method = config.method || this.method;
    this.config = config;
    this.retry = {
      ...this.retry,
      ...(config.retry || {}),
    };

    this.requestInstance = this.isCustomFetcher()
      ? (fetcher as any).create({
          ...config,
          baseURL: this.baseURL,
          timeout: this.timeout,
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
    const method = (config.method || this.method).toUpperCase() as Method;
    const isGetAlikeMethod = method === 'GET' || method === 'HEAD';

    const dynamicUrl = replaceUrlPathParams(
      url,
      config.urlPathParams || this.config.urlPathParams,
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
    const credentials =
      config.withCredentials || this.config.withCredentials
        ? 'include'
        : config.credentials;

    delete config.data;
    delete config.withCredentials;

    const urlPath =
      explicitParams || shouldTreatDataAsParams
        ? appendQueryParams(dynamicUrl, explicitParams || (data as QueryParams))
        : dynamicUrl;
    const isFullUrl = urlPath.includes('://');
    const baseURL = isFullUrl ? '' : config.baseURL || this.baseURL;

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
        'Content-Type': APPLICATION_JSON + ';charset=utf-8',
        ...(config.headers || this.config.headers || {}),
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

    if (this.logger?.warn) {
      this.logger.warn('API ERROR', error);
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
   * @param {RequestConfig} requestConfig   Per endpoint request config
   * @returns {*} Error response
   */
  protected async outputErrorResponse(
    error: ResponseError,
    requestConfig: RequestConfig,
  ): Promise<any> {
    const isRequestCancelled = this.isRequestCancelled(error);
    const errorHandlingStrategy = requestConfig.strategy || this.strategy;
    const rejectCancelled =
      typeof requestConfig.rejectCancelled !== 'undefined'
        ? requestConfig.rejectCancelled
        : this.rejectCancelled;
    const defaultResponse =
      typeof requestConfig.defaultResponse !== 'undefined'
        ? requestConfig.defaultResponse
        : this.defaultResponse;
    const flattenResponse =
      typeof requestConfig.flattenResponse !== 'undefined'
        ? requestConfig.flattenResponse
        : this.flattenResponse;

    // Output full response with the error object
    if (errorHandlingStrategy === 'softFail') {
      return this.outputResponse(error.response, requestConfig, error);
    }

    // By default cancelled requests aren't rejected
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

    return flattenResponse
      ? defaultResponse
      : {
          error,
          headers: null,
          data: defaultResponse,
          config: requestConfig,
        };
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
    return this.fetcher !== null;
  }

  /**
   * Automatically Cancel Previous Requests using AbortController when "cancellable" is defined
   *
   * @param {RequestConfig} requestConfig   Per endpoint request config
   * @returns {Object} Controller Signal to abort
   */
  protected addCancelToken(
    requestConfig: RequestConfig,
  ): Partial<Record<'signal', AbortSignal>> {
    if (typeof AbortController === 'undefined') {
      console.error('AbortController unavailable.');

      return {};
    }

    const isCancellable =
      typeof requestConfig.cancellable !== 'undefined'
        ? requestConfig.cancellable
        : this.config.cancellable;

    if (isCancellable) {
      const previousRequest = this.requestsQueue.get(requestConfig);

      if (previousRequest) {
        previousRequest.controller.abort();
      }
    }

    const controller = new AbortController();

    this.requestsQueue.set(requestConfig, { controller });

    return {
      signal: controller.signal,
    };
  }

  /**
   * Sets up a timeout to automatically abort the request if it exceeds the specified time.
   *
   * @param {RequestConfig} requestConfig - The configuration object for the request.
   * @param {boolean} resetTimeout - Whether to reset the timeout.
   */
  protected setupTimeout(
    requestConfig: RequestConfig,
    resetTimeout: boolean,
  ): void {
    const timeout =
      typeof requestConfig.timeout !== 'undefined'
        ? requestConfig.timeout
        : this.timeout;

    if (timeout > 0) {
      const reqFromQueue =
        this.requestsQueue.get(requestConfig) || ({} as QueueItem);

      if (reqFromQueue?.timeoutId) {
        // Timeout is already set and we don't want to reset it, so exit
        if (!resetTimeout) {
          return;
        }

        clearTimeout(reqFromQueue.timeoutId);
      }

      const timeoutId = setTimeout(() => {
        const _reqFromQueue = this.requestsQueue.get(requestConfig);

        if (!_reqFromQueue) {
          return;
        }

        const error = new Error(`${requestConfig.url} aborted due to timeout`);

        error.name = 'TimeoutError';

        (error as any).code = 23; // DOMException.TIMEOUT_ERR

        _reqFromQueue?.controller?.abort(error);
      }, timeout);

      // Register timeout
      this.requestsQueue.set(requestConfig, {
        ...reqFromQueue,
        timeoutId,
      });
    }
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
    config: RequestConfig = null,
  ): Promise<ResponseData & FetchResponse<ResponseData>> {
    let response: FetchResponse<ResponseData> = null;
    const _config = config || {};
    const _requestConfig = this.buildConfig(url, data, _config);

    let requestConfig: RequestConfig = {
      ...this.addCancelToken(_requestConfig),
      ..._requestConfig,
    };

    const {
      retries,
      delay,
      backoff,
      retryOn,
      shouldRetry,
      maxDelay,
      resetTimeout,
    } = {
      ...this.retry,
      ...(requestConfig?.retry || {}),
    };

    let attempt = 0;
    let waitTime = delay;

    while (attempt <= retries) {
      try {
        this.setupTimeout(_requestConfig, resetTimeout);

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
          response = (await globalThis.fetch(
            requestConfig.url,
            requestConfig as RequestInit,
          )) as FetchResponse<ResponseData>;

          // Add more information to response object
          response.config = requestConfig;
          response.data = await this.parseData(response);

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
      } catch (error) {
        if (
          attempt === retries ||
          !(await shouldRetry(error, attempt)) ||
          !retryOn?.includes(error?.response?.status || error?.status)
        ) {
          this.processError(error, requestConfig);

          return this.outputErrorResponse(error, requestConfig);
        }

        if (this.logger?.warn) {
          this.logger.warn(
            `Attempt ${attempt + 1} failed. Retrying in ${waitTime}ms...`,
          );
        }

        await delayInvocation(waitTime);

        waitTime *= backoff;
        waitTime = Math.min(waitTime, maxDelay);
        attempt++;
      }
    }

    return this.outputResponse(response, requestConfig) as ResponseData &
      FetchResponse<ResponseData>;
  }

  /**
   * Parses the response data based on the Content-Type header.
   *
   * @param response - The Response object to parse.
   * @returns A Promise that resolves to the parsed data.
   */
  public async parseData<ResponseData = APIResponse>(
    response: FetchResponse<ResponseData>,
  ): Promise<any> {
    // Bail early when body is empty
    if (!response.body) {
      return null;
    }

    const contentType = String(
      (response as Response).headers?.get('Content-Type') || '',
    ).split(';')[0]; // Correctly handle charset

    let data;

    try {
      if (
        contentType.includes(APPLICATION_JSON) ||
        contentType.includes('+json')
      ) {
        data = await response.json(); // Parse JSON response
      } else if (contentType.includes('multipart/form-data')) {
        data = await response.formData(); // Parse as FormData
      } else if (contentType.includes('application/octet-stream')) {
        data = await response.blob(); // Parse as blob
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        data = await response.formData(); // Handle URL-encoded forms
      } else if (contentType.includes('text/')) {
        data = await response.text(); // Parse as text
      } else {
        try {
          const responseClone = response.clone();

          // Handle edge case of no content type being provided... We assume JSON here.
          data = await responseClone.json();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_e) {
          // Handle streams
          data = await response.text();
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      // Parsing failed, fallback to null
      data = null;
    }

    return data;
  }

  public processHeaders<ResponseData>(
    response: FetchResponse<ResponseData>,
  ): HeadersObject {
    const headers = response.headers;

    if (!headers) {
      return {};
    }

    const headersObject: HeadersObject = {};

    // Handle Headers object with entries() method
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        headersObject[key] = value;
      });
    } else if (typeof headers === 'object' && headers !== null) {
      // Handle plain object
      for (const [key, value] of Object.entries(headers)) {
        // Normalize keys to lowercase as per RFC 2616 4.2
        // https://datatracker.ietf.org/doc/html/rfc2616#section-4.2
        headersObject[key.toLowerCase()] = value;
      }
    }

    return headersObject;
  }

  /**
   * Recursively flattens the data object if it meets specific criteria.
   *
   * The method checks if the provided `data` is an object with exactly one property named `data`.
   * If so, it recursively flattens the `data` property. Otherwise, it returns the `data` as-is.
   *
   * @param {any} data - The data to be flattened. Can be of any type, including objects, arrays, or primitives.
   * @returns {any} - The flattened data if the criteria are met; otherwise, the original `data`.
   */
  protected flattenData(data: any): any {
    if (
      data &&
      typeof data === 'object' &&
      typeof data.data !== 'undefined' &&
      Object.keys(data).length === 1
    ) {
      return this.flattenData(data.data);
    }

    return data;
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
    response: FetchResponse<ResponseData>,
    requestConfig: RequestConfig,
    error = null,
  ): ResponseData | FetchResponse<ResponseData> {
    const defaultResponse =
      typeof requestConfig.defaultResponse !== 'undefined'
        ? requestConfig.defaultResponse
        : this.defaultResponse;
    const flattenResponse =
      typeof requestConfig.flattenResponse !== 'undefined'
        ? requestConfig.flattenResponse
        : this.flattenResponse;

    // Clean up the error object
    if (error !== null) {
      delete error?.response;
      delete error?.request;
      delete error?.config;
    }

    let data = response?.data;

    // Return flattened response immediately
    if (flattenResponse) {
      return this.flattenData(data);
    }

    // Set the default response if the provided data is an empty object
    if (data && typeof data === 'object' && Object.keys(data).length === 0) {
      data = defaultResponse;
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
      headers: this.processHeaders(response),
      config: requestConfig,
    };
  }
}
