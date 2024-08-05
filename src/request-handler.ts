/* eslint-disable @typescript-eslint/no-explicit-any */
import { RequestErrorHandler } from './request-error-handler';
import type {
  ErrorHandlingStrategy,
  RequestHandlerConfig,
  RequestConfig,
  RequestError as RequestErrorResponse,
  FetcherInstance,
  Method,
  RequestConfigHeaders,
  RetryOptions,
  FetchResponse,
  ExtendedResponse,
} from './types/request-handler';
import type {
  APIResponse,
  QueryParams,
  QueryParamsOrBody,
  UrlPathParams,
} from './types/api-handler';
import { RequestError } from './request-error';
import { interceptRequest, interceptResponse } from './interceptor-manager';

/**
 * Generic Request Handler
 * It creates an Request Fetcher instance and handles requests within that instance
 * It handles errors depending on a chosen error handling strategy
 */
export class RequestHandler {
  /**
   * @var requestInstance Provider's instance
   */
  public requestInstance: FetcherInstance;

  /**
   * @var baseURL Base API url
   */
  public baseURL: string = '';

  /**
   * @var timeout Request timeout
   */
  public timeout: number = 30000;

  /**
   * @var cancellable Response cancellation
   */
  public cancellable: boolean = false;

  /**
   * @var rejectCancelled Whether to reject cancelled requests or not
   */
  public rejectCancelled: boolean = false;

  /**
   * @var strategy Request timeout
   */
  public strategy: ErrorHandlingStrategy = 'reject';

  /**
   * @var method Request method
   */
  public method: Method | string = 'get';

  /**
   * @var flattenResponse Response flattening
   */
  public flattenResponse: boolean = false;

  /**
   * @var defaultResponse Response flattening
   */
  public defaultResponse: any = null;

  /**
   * @var fetcher Request Fetcher instance
   */
  protected fetcher: FetcherInstance;

  /**
   * @var logger Logger
   */
  protected logger: any;

  /**
   * @var requestErrorService HTTP error service
   */
  protected onError: any;

  /**
   * @var requestsQueue    Queue of requests
   */
  protected requestsQueue: WeakMap<object, AbortController>;

  /**
   * Request Handler Config
   */
  protected retry: RetryOptions = {
    retries: 0,
    delay: 1000,
    maxDelay: 30000,
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

  /**
   * Request Handler Config
   */
  public config: RequestHandlerConfig;

  /**
   * Creates an instance of RequestHandler.
   *
   * @param {Object} config - Configuration object for the request.
   * @param {string} config.baseURL - The base URL for the request.
   * @param {Object} config.endpoints - An object containing endpoint definitions.
   * @param {number} config.timeout - You can set the timeout for particular request in milliseconds.
   * @param {number} config.cancellable - If true, the previous requests will be automatically cancelled.
   * @param {number} config.rejectCancelled - If true and request is set to cancellable, a cancelled request promise will be rejected. By default, instead of rejecting the promise, defaultResponse is returned.
   * @param {number} config.timeout - Request timeout
   * @param {string} config.strategy - Error Handling Strategy
   * @param {string} config.flattenResponse - Whether to flatten response "data" object within "data" one
   * @param {*} config.defaultResponse - Default response when there is no data or when endpoint fails depending on the chosen strategy. It's "null" by default
   * @param {Object} [config.retry] - Options for retrying requests.
   * @param {number} [config.retry.retries=0] - Number of retry attempts. No retries by default.
   * @param {number} [config.retry.delay=1000] - Initial delay between retries in milliseconds.
   * @param {number} [config.retry.backoff=1.5] - Exponential backoff factor.
   * @param {number[]} [config.retry.retryOn=[502, 504, 408]] - HTTP status codes to retry on.
   * @param {RequestInterceptor|RequestInterceptor[]} [config.onRequest] - Optional request interceptor function or an array of functions.
   * These functions will be called with the request configuration object before the request is made. Can be used to modify or log the request configuration.
   * @param {ResponseInterceptor|ResponseInterceptor[]} [config.onResponse] - Optional response interceptor function or an array of functions.
   * These functions will be called with the response object after the response is received. an be used to modify or log the response data.
   * @param {Function} [config.onError] - Optional callback function for handling errors.
   * @param {Object} [config.headers] - Optional default headers to include in every request.
   * @param {Object} config.fetcher - The Axios (or any other) instance to use for making requests.
   * @param {*} config.logger - Instance of custom logger. Either class or an object similar to "console". Console is used by default.
   */
  public constructor({
    fetcher = null,
    timeout = null,
    rejectCancelled = false,
    strategy = null,
    flattenResponse = null,
    defaultResponse = {},
    logger = null,
    onError = null,
    ...config
  }: RequestHandlerConfig) {
    this.fetcher = fetcher;
    this.timeout =
      timeout !== null && timeout !== undefined ? timeout : this.timeout;
    this.strategy =
      strategy !== null && strategy !== undefined ? strategy : this.strategy;
    this.cancellable = config.cancellable || this.cancellable;
    this.rejectCancelled = rejectCancelled || this.rejectCancelled;
    this.flattenResponse =
      flattenResponse !== null && flattenResponse !== undefined
        ? flattenResponse
        : this.flattenResponse;
    this.defaultResponse = defaultResponse;
    this.logger = logger || (globalThis ? globalThis.console : null) || null;
    this.onError = onError;
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
   * Replaces dynamic URI parameters in a URL string with values from the provided `urlPathParams` object.
   * Parameters in the URL are denoted by `:<paramName>`, where `<paramName>` is a key in `urlPathParams`.
   *
   * @param {string} url - The URL string containing placeholders in the format `:<paramName>`.
   * @param {Object} urlPathParams - An object containing the parameter values to replace placeholders.
   * @param {string} urlPathParams.paramName - The value to replace the placeholder `:<paramName>` in the URL.
   * @returns {string} - The URL string with placeholders replaced by corresponding values from `urlPathParams`.
   */
  public replaceUrlPathParams(
    url: string,
    urlPathParams: UrlPathParams,
  ): string {
    if (!urlPathParams) {
      return url;
    }

    return url.replace(/:[a-zA-Z]+/gi, (str): string => {
      const word = str.substring(1);

      return String(urlPathParams[word] ? urlPathParams[word] : str);
    });
  }

  /**
   * Appends query parameters to the given URL
   *
   * @param {string} url - The base URL to which query parameters will be appended.
   * @param {QueryParams} params - An instance of URLSearchParams containing the query parameters to append.
   * @returns {string} - The URL with the appended query parameters.
   */
  public appendQueryParams(url: string, params: QueryParams): string {
    if (!params) {
      return url;
    }

    // We don't use URLSearchParams here as we want to ensure that arrays are properly converted similarily to Axios
    // So { foo: [1, 2] } would become: foo[]=1&foo[]=2
    const queryString = Object.entries(params)
      .flatMap(([key, value]) => {
        if (Array.isArray(value)) {
          return value.map(
            (val) => `${encodeURIComponent(key)}[]=${encodeURIComponent(val)}`,
          );
        }
        return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
      })
      .join('&');

    return url.includes('?')
      ? `${url}&${queryString}`
      : queryString
        ? `${url}?${queryString}`
        : url;
  }

  /**
   * Checks if a value is JSON serializable.
   *
   * JSON serializable values include:
   * - Primitive types: string, number, boolean, null
   * - Arrays
   * - Plain objects (i.e., objects without special methods)
   * - Values with a `toJSON` method
   *
   * @param {any} value - The value to check for JSON serializability.
   * @returns {boolean} - Returns `true` if the value is JSON serializable, otherwise `false`.
   */
  protected isJSONSerializable(value: any): boolean {
    if (value === undefined || value === null) {
      return false;
    }

    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') {
      return true;
    }

    if (t !== 'object') {
      return false; // bigint, function, symbol, undefined
    }

    if (Array.isArray(value)) {
      return true;
    }

    if (Buffer.isBuffer(value)) {
      return false;
    }

    if (value instanceof Date) {
      return false;
    }

    const proto = Object.getPrototypeOf(value);

    // Check if the prototype is `Object.prototype` or `null` (plain object)
    if (proto === Object.prototype || proto === null) {
      return true;
    }

    // Check if the object has a toJSON method
    if (typeof value.toJSON === 'function') {
      return true;
    }

    return false;
  }

  /**
   * Build request configuration
   *
   * @param {string} url                          Request url
   * @param {QueryParamsOrBody} data    Request data
   * @param {RequestConfig} config               Request config
   * @returns {RequestConfig}                    Provider's instance
   */
  protected buildConfig(
    url: string,
    data: QueryParamsOrBody,
    config: RequestConfig,
  ): RequestConfig {
    const method = config.method || this.method;
    const methodLowerCase = method.toLowerCase();
    const isGetAlikeMethod =
      methodLowerCase === 'get' || methodLowerCase === 'head';

    const dynamicUrl = this.replaceUrlPathParams(
      url,
      config.urlPathParams || this.config.urlPathParams,
    );

    // Bonus: Specifying it here brings support for "body" in Axios
    const configData =
      config.body || config.data || this.config.body || this.config.data;

    // Axios compatibility
    if (this.isCustomFetcher()) {
      return {
        ...config,
        url: dynamicUrl,
        method: methodLowerCase,

        ...(isGetAlikeMethod ? { params: data } : {}),

        // For POST requests body payload is the first param for convenience ("data")
        // In edge cases we want to split so to treat it as query params, and use "body" coming from the config instead
        ...(!isGetAlikeMethod && data && configData ? { params: data } : {}),

        // Only applicable for request methods 'PUT', 'POST', 'DELETE', and 'PATCH'
        ...(!isGetAlikeMethod && data && !configData ? { data } : {}),
        ...(!isGetAlikeMethod && configData ? { data: configData } : {}),
      };
    }

    // Native fetch
    const payload = configData || data;

    delete config.data;

    const urlPath =
      (!isGetAlikeMethod && data && !config.body) || !data
        ? dynamicUrl
        : this.appendQueryParams(dynamicUrl, data);
    const isFullUrl = urlPath.includes('://');
    const baseURL = isFullUrl
      ? ''
      : typeof config.baseURL !== 'undefined'
        ? config.baseURL
        : this.baseURL;

    return {
      ...config,

      // Native fetch generally requires query params to be appended in the URL
      // Do not append query params only if it's a POST-alike request with only "data" specified as it's treated as body payload
      url: baseURL + urlPath,

      // Uppercase method name
      method: method.toUpperCase(),

      // For convenience, add the same default headers as Axios does
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=utf-8',
        ...(config.headers || this.config.headers || {}),
      } as RequestConfigHeaders,

      // Automatically JSON stringify request bodies, if possible and when not dealing with strings
      ...(!isGetAlikeMethod
        ? {
            body: this.isJSONSerializable(payload)
              ? typeof payload === 'string'
                ? payload
                : JSON.stringify(payload)
              : payload,
          }
        : {}),
    };
  }

  /**
   * Process global Request Error
   *
   * @param {RequestErrorResponse} error      Error instance
   * @param {RequestConfig} requestConfig   Per endpoint request config
   * @returns {void}
   */
  protected processError(
    error: RequestErrorResponse,
    requestConfig: RequestConfig,
  ): void {
    if (this.isRequestCancelled(error)) {
      return;
    }

    // Invoke per request "onError" call
    if (requestConfig.onError && typeof requestConfig.onError === 'function') {
      requestConfig.onError(error);
    }

    const errorHandler = new RequestErrorHandler(this.logger, this.onError);

    errorHandler.process(error);
  }

  /**
   * Output default response in case of an error, depending on chosen strategy
   *
   * @param {RequestErrorResponse} error      Error instance
   * @param {RequestConfig} requestConfig   Per endpoint request config
   * @returns {*} Error response
   */
  protected async outputErrorResponse(
    error: RequestErrorResponse,
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

    // By default cancelled requests aren't rejected
    if (isRequestCancelled && !rejectCancelled) {
      return defaultResponse;
    }

    if (errorHandlingStrategy === 'silent') {
      // Hang the promise
      await new Promise(() => null);

      return defaultResponse;
    }

    // Simply rejects a request promise
    if (errorHandlingStrategy === 'reject') {
      return Promise.reject(error);
    }

    return defaultResponse;
  }

  /**
   * Output error response depending on chosen strategy
   *
   * @param {RequestErrorResponse} error               Error instance
   * @returns {boolean}                        True if request is aborted
   */
  public isRequestCancelled(error: RequestErrorResponse): boolean {
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
  protected addCancellationToken(
    requestConfig: RequestConfig,
  ): Partial<Record<'signal', AbortSignal>> {
    // Both disabled
    if (!this.cancellable && !requestConfig.cancellable) {
      return {};
    }

    // Explicitly disabled per request
    if (
      typeof requestConfig.cancellable !== 'undefined' &&
      !requestConfig.cancellable
    ) {
      return {};
    }

    // Check if AbortController is available
    if (typeof AbortController === 'undefined') {
      console.error('AbortController is unavailable.');

      return {};
    }

    // Generate unique key as a cancellation token
    const previousRequest = this.requestsQueue.get(requestConfig);

    if (previousRequest) {
      previousRequest.abort();
    }

    const controller = new AbortController();

    // Introduce timeout for native fetch
    if (!this.isCustomFetcher()) {
      const abortTimeout = setTimeout(() => {
        const error = new Error(
          `[TimeoutError]: The ${requestConfig.url} request was aborted due to timeout`,
        );

        error.name = 'TimeoutError';
        (error as any).code = 23; // DOMException.TIMEOUT_ERR
        controller.abort(error);
        clearTimeout(abortTimeout);
        throw error;
      }, requestConfig.timeout || this.timeout);
    }

    this.requestsQueue.set(requestConfig, controller);

    return {
      signal: controller.signal,
    };
  }

  /**
   * Handle Request depending on used strategy
   *
   * @param {object} payload                              Payload
   * @param {string} payload.url                          Request url
   * @param {QueryParamsOrBody} payload.data    Request data
   * @param {RequestConfig} payload.config               Request config
   * @throws {RequestErrorResponse}
   * @returns {Promise<Response & FetchResponse<Response>>} Response Data
   */
  public async request<Response = APIResponse>(
    url: string,
    data: QueryParamsOrBody = null,
    config: RequestConfig = null,
  ): Promise<Response & FetchResponse<Response>> {
    let response: Response | FetchResponse<Response> = null;
    const _config = config || {};
    const _requestConfig = this.buildConfig(url, data, _config);

    let requestConfig: RequestConfig = {
      ...this.addCancellationToken(_requestConfig),
      ..._requestConfig,
    };

    const { retries, delay, backoff, retryOn, shouldRetry, maxDelay } = {
      ...this.retry,
      ...(requestConfig?.retry || {}),
    };

    let attempt = 0;
    let waitTime = delay;

    while (attempt <= retries) {
      try {
        // Local interceptors
        requestConfig = await interceptRequest(
          requestConfig,
          requestConfig.onRequest,
        );

        // Global interceptors
        requestConfig = await interceptRequest(
          requestConfig,
          this.config.onRequest,
        );

        // Axios compatibility
        if (this.isCustomFetcher()) {
          response = (await (this.requestInstance as any).request(
            requestConfig,
          )) as FetchResponse<Response>;
        } else {
          response = (await globalThis.fetch(
            requestConfig.url,
            requestConfig,
          )) as ExtendedResponse;

          // Add more information to response object
          response.config = requestConfig;

          // Check if the response status is not outside the range 200-299
          if (response.ok) {
            const contentType = String(
              response?.headers?.get('Content-Type') || '',
            );
            let data = null;

            // Handle edge case of no content type being provided... We assume json here.
            if (!contentType) {
              try {
                data = await response.json();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
              } catch (_error) {
                //
              }
            }

            if (!data) {
              if (contentType && contentType.includes('application/json')) {
                // Parse JSON response
                data = await response.json();
              } else if (typeof response.text !== 'undefined') {
                data = await response.text();
              } else if (typeof response.blob !== 'undefined') {
                data = await response.blob();
              } else {
                // Handle streams
                data = response.body || response.data || null;
              }
            }

            response.data = data;
          } else {
            response.data = null;

            // Output error in similar format to what Axios does
            throw new RequestError(
              `fetchf() Request Failed! Status: ${response.status || null}`,
              requestConfig,
              response,
            );
          }
        }

        // Local interceptors
        response = await interceptResponse(response, requestConfig.onResponse);

        // Global interceptors
        response = await interceptResponse(response, this.config.onResponse);

        return this.processResponseData(response, requestConfig);
      } catch (error) {
        if (
          attempt === retries ||
          !(await shouldRetry(error, attempt)) ||
          !retryOn?.includes(
            (response as FetchResponse<Response>)?.status ||
              error?.response?.status ||
              error?.status,
          )
        ) {
          this.processError(error, requestConfig);

          return this.outputErrorResponse(error, requestConfig);
        }

        if (this.logger?.warn) {
          this.logger.warn(
            `Attempt ${attempt + 1} failed. Retrying in ${waitTime}ms...`,
          );
        }

        await this.delay(waitTime);

        waitTime *= backoff;
        waitTime = Math.min(waitTime, maxDelay);
        attempt++;
      }
    }

    return this.processResponseData(response, requestConfig);
  }

  public async delay(ms: number): Promise<boolean> {
    return new Promise((resolve) =>
      setTimeout(() => {
        return resolve(true);
      }, ms),
    );
  }

  /**
   * Process response
   *
   * @param response - Response payload
   * @param {RequestConfig} requestConfig - Request config
   * @returns {*} Response data
   */
  protected processResponseData(response, requestConfig: RequestConfig) {
    const defaultResponse =
      typeof requestConfig.defaultResponse !== 'undefined'
        ? requestConfig.defaultResponse
        : this.defaultResponse;

    if (!response) {
      return defaultResponse;
    }

    if (
      (requestConfig.flattenResponse || this.flattenResponse) &&
      typeof response.data !== 'undefined'
    ) {
      // Special case of only data property within response data object (happens in Axios)
      // This is in fact a proper response but we may want to flatten it
      // To ease developers' lives when obtaining the response
      if (
        typeof response.data === 'object' &&
        typeof response.data.data !== 'undefined' &&
        Object.keys(response.data).length === 1
      ) {
        return response.data.data;
      }

      return response.data;
    }

    // If empty object is returned, ensure that the default response is used instead
    if (
      typeof response === 'object' &&
      response.constructor === Object &&
      Object.keys(response).length === 0
    ) {
      return defaultResponse;
    }

    // For fetch()
    const isCustomFetcher = this.isCustomFetcher();

    if (!isCustomFetcher) {
      return {
        ...response,
        headers: Array.from(response?.headers?.entries() || {}).reduce(
          (acc, [key, value]) => {
            acc[key] = value;
            return acc;
          },
          {},
        ),
        config: requestConfig,
      };
    }

    return response;
  }
}
