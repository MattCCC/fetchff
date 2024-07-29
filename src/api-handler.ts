import { RequestHandler } from './request-handler';
import type {
  RequestResponse,
  FetcherInstance,
  RequestConfig,
} from './types/request-handler';
import type {
  ApiHandlerConfig,
  ApiHandlerMethods,
  ApiHandlerReturnType,
  QueryParams,
  UrlPathParams,
} from './types/api-handler';

/**
 * Creates an instance of API Handler.
 * It creates an API fetcher function using native fetch() or Axios if it is passed as "fetcher".
 *
 * @param {Object} config - Configuration object for the API fetcher.
 * @param {string} config.apiUrl - The base URL for the API.
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
 * @param {Function} [config.onError] - Optional callback function for handling errors.
 * @param {Object} [config.headers] - Optional default headers to include in every request.
 * @param {Object} config.fetcher - The Axios (or any other) instance to use for making requests.
 * @param {*} config.logger - Instance of custom logger. Either class or an object similar to "console". Console is used by default.
 * @returns API handler functions and endpoints to call
 *
 * @example
 * // Import axios (optional)
 * import axios from 'axios';
 *
 * // Define endpoint paths
 * const endpoints = {
 *   getUser: '/user',
 *   createPost: '/post',
 * };
 *
 * // Create the API fetcher with configuration
 * const api = createApiFetcher({
 *   fetcher: axios, // Axios instance (optional)
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
function createApiFetcher<EndpointsMethods = never, EndpointsCfg = never>(
  config: ApiHandlerConfig<EndpointsMethods>,
) {
  const endpoints = config.endpoints;
  const requestHandler = new RequestHandler(config);

  /**
   * Get Fetcher Provider Instance
   *
   * @returns {FetcherInstance} Request Handler's Fetcher instance
   */
  function getInstance(): FetcherInstance {
    return requestHandler.getInstance();
  }

  /**
   * Triggered when trying to use non-existent endpoints
   *
   * @param endpointName Endpoint Name
   * @returns {Promise}
   */
  function handleNonImplemented(endpointName: string): Promise<null> {
    console.error(`${endpointName} endpoint must be added to 'endpoints'.`);

    return Promise.resolve(null);
  }

  /**
   * Handle Single API Request
   * It considers settings in following order: per-request settings, global per-endpoint settings, global settings.
   *
   * @param {string} endpointName - The name of the API endpoint to call.
   * @param {QueryParams} [queryParams={}] - Query parameters to include in the request.
   * @param {UrlPathParams} [urlPathParams={}] - URI parameters to include in the request.
   * @param {EndpointConfig} [requestConfig={}] - Additional configuration for the request.
   * @returns {Promise<RequestResponse>} - A promise that resolves with the response from the API provider.
   */
  async function request(
    endpointName: keyof EndpointsMethods & string,
    queryParams: QueryParams = {},
    urlPathParams: UrlPathParams = {},
    requestConfig: RequestConfig = {},
  ): Promise<RequestResponse> {
    // Use global per-endpoint settings
    const endpointConfig = endpoints[endpointName as string];
    const endpointSettings = { ...endpointConfig };

    const responseData = await requestHandler.request(
      endpointSettings.url,
      queryParams,
      {
        ...endpointSettings,
        ...requestConfig,
        urlPathParams,
      },
    );

    return responseData;
  }

  /**
   * Maps all API requests using native Proxy
   *
   * @param {*} prop          Caller
   */
  function get(prop: string | symbol) {
    if (prop in apiHandler) {
      return apiHandler[prop];
    }

    // Prevent handler from triggering non-existent endpoints
    if (!endpoints[prop as string]) {
      return handleNonImplemented.bind(null, prop);
    }

    return apiHandler.request.bind(null, prop);
  }

  const apiHandler: ApiHandlerMethods<EndpointsMethods> = {
    config,
    endpoints,
    requestHandler,
    getInstance,
    request,
  };

  return new Proxy(apiHandler, {
    get: (_target, prop) => get(prop),
  }) as ApiHandlerReturnType<EndpointsMethods, EndpointsCfg>;
}

export { createApiFetcher };
