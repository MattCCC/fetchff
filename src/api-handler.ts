import type {
  RequestConfig,
  FetchResponse,
  DefaultResponse,
  CreatedCustomFetcherInstance,
} from './types/request-handler';
import type {
  ApiHandlerConfig,
  ApiHandlerDefaultMethods,
  ApiHandlerMethods,
  DefaultPayload,
  FallbackValue,
  FinalParams,
  FinalResponse,
  QueryParams,
  RequestConfigUrlRequired,
  UrlPathParams,
} from './types/api-handler';
import { createRequestHandler } from './request-handler';

/**
 * Creates an instance of API Handler.
 * It creates an API fetcher function using native fetch() or a custom fetcher if it is passed as "fetcher".
 * @url https://github.com/MattCCC/fetchff
 *
 * @param {Object} config - Configuration object for the API fetcher.
 * @param {string} config.apiUrl - The base URL for the API.
 * @param {Object} config.endpoints - An object containing endpoint definitions.
 * @param {number} config.timeout - You can set the timeout for particular request in milliseconds.
 * @param {number} config.cancellable - If true, the ongoing previous requests will be automatically cancelled.
 * @param {number} config.rejectCancelled - If true and request is set to cancellable, a cancelled request promise will be rejected. By default, instead of rejecting the promise, defaultResponse is returned.
 * @param {number} config.timeout - Request timeout
 * @param {number} config.dedupeTime - Time window, in milliseconds, during which identical requests are deduplicated (treated as single request).
 * @param {string} config.strategy - Error Handling Strategy
 * @param {string} config.flattenResponse - Whether to flatten response "data" object within "data". It works only if the response structure includes a single data property.
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
 * @param {Object} config.fetcher - The Custom Fetcher instance to use for making requests. It should expose create() and request() functions.
 * @param {*} config.logger - Instance of custom logger. Either class or an object similar to "console". Console is used by default.
 * @returns API handler functions and endpoints to call
 *
 * @example
 * // Define endpoint paths
 * const endpoints = {
 *   getUser: '/user',
 *   createPost: '/post',
 * };
 *
 * // Create the API fetcher with configuration
 * const api = createApiFetcher({
 *   endpoints,
 *   apiUrl: 'https://example.com/api',
 *   onError(error) {
 *     console.log('Request failed', error);
 *   },
 *   headers: {
 *     'my-auth-key': 'example-auth-key-32rjjfa',
 *   },
 * });
 *
 * // Fetch user data
 * const response = await api.getUser({ userId: 1, ratings: [1, 2] })
 */
function createApiFetcher<
  EndpointsMethods extends object,
  EndpointsSettings = never,
>(config: ApiHandlerConfig<EndpointsMethods>) {
  const endpoints = config.endpoints;
  const requestHandler = createRequestHandler(config);

  /**
   * Get Custom Fetcher Provider Instance
   *
   * @returns {CreatedCustomFetcherInstance | null} Request Handler's Custom Fetcher Instance
   */
  function getInstance(): CreatedCustomFetcherInstance | null {
    return requestHandler.getInstance();
  }

  /**
   * Triggered when trying to use non-existent endpoints
   *
   * @param endpointName Endpoint Name
   * @returns {Promise}
   */
  function handleNonImplemented(endpointName: string): Promise<null> {
    console.error(`Add ${endpointName} to 'endpoints'.`);

    return Promise.resolve(null);
  }

  /**
   * Handle Single API Request
   * It considers settings in following order: per-request settings, global per-endpoint settings, global settings.
   *
   * @param {keyof EndpointsMethods | string} endpointName - The name of the API endpoint to call.
   * @param {EndpointConfig} [requestConfig={}] - Additional configuration for the request.
   * @returns {Promise<FetchResponse<ResponseData>>} - A promise that resolves with the response from the API provider.
   */
  async function request<
    ResponseData = never,
    QueryParams_ = never,
    UrlParams = never,
    RequestBody = never,
  >(
    endpointName: keyof EndpointsMethods | string,
    requestConfig: RequestConfig<
      FinalResponse<ResponseData, DefaultResponse>,
      FinalParams<ResponseData, QueryParams_, QueryParams>,
      FinalParams<ResponseData, UrlParams, UrlPathParams>,
      FallbackValue<ResponseData, DefaultPayload, RequestBody>
    > = {},
  ): Promise<FetchResponse<FinalResponse<ResponseData, DefaultResponse>>> {
    // Use global per-endpoint settings
    const endpointConfig =
      endpoints[endpointName] ||
      ({ url: endpointName as string } as RequestConfigUrlRequired);

    const responseData = await requestHandler.request<
      FinalResponse<ResponseData, DefaultResponse>,
      FinalParams<ResponseData, QueryParams_, QueryParams>,
      FinalParams<ResponseData, UrlParams, UrlParams>,
      FallbackValue<ResponseData, DefaultPayload, RequestBody>
    >(endpointConfig.url, {
      ...endpointConfig,
      ...requestConfig,
    });

    return responseData;
  }

  const apiHandler: ApiHandlerDefaultMethods<EndpointsMethods> = {
    config,
    endpoints,
    requestHandler,
    getInstance,
    request,
  };

  /**
   * Maps all API requests using native Proxy
   *
   * @param {*} prop          Caller
   */
  return new Proxy<ApiHandlerMethods<EndpointsMethods, EndpointsSettings>>(
    apiHandler as ApiHandlerMethods<EndpointsMethods, EndpointsSettings>,
    {
      get(_target, prop: string) {
        if (prop in apiHandler) {
          return apiHandler[prop as unknown as keyof typeof apiHandler];
        }

        // Prevent handler from triggering non-existent endpoints
        if (endpoints[prop]) {
          return apiHandler.request.bind(null, prop);
        }

        return handleNonImplemented.bind(null, prop);
      },
    },
  );
}

export { createApiFetcher };
