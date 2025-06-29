import type {
  RequestConfig,
  FetchResponse,
  DefaultResponse,
  CustomFetcher,
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
import { fetchf } from '.';
import { mergeConfig } from './config-handler';

/**
 * Creates an instance of API Handler.
 * It creates an API fetcher function using native fetch() or a custom fetcher if passed as "fetcher".
 * @see https://github.com/MattCCC/fetchff#configuration
 *
 * @param {Object} config - Configuration object for the API fetcher (see link above for full options).
 * @param {Object} config.endpoints - An object containing endpoint definitions.
 * @param {string} [config.baseURL] - The base URL for the API.
 * @param {Object} [config.headers] - Optional default headers to include in every request.
 * @param {Function} [config.onError] - Optional callback function for handling errors.
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
   * @returns {CustomFetcher  | null} Request Handler's Custom Fetcher Instance
   */
  function getInstance(): CustomFetcher | null {
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
      ({ url: String(endpointName) } as RequestConfigUrlRequired);
    const url = endpointConfig.url;

    // Block Protocol-relative URLs as they could lead to SSRF (Server-Side Request Forgery)
    if (url.startsWith('//')) {
      throw new Error('Protocol-relative URLs are not allowed.');
    }

    // Prevent potential Server-Side Request Forgery attack and leakage of credentials when same instance is used for external requests
    const isAbsoluteUrl = url.includes('://');

    if (isAbsoluteUrl) {
      // Retrigger fetch to ensure completely new instance of handler being triggered for external URLs
      return await fetchf(url, requestConfig);
    }

    const mergedConfig = {
      ...endpointConfig,
      ...requestConfig,
    };

    mergeConfig('retry', mergedConfig, endpointConfig, requestConfig);
    mergeConfig('headers', mergedConfig, endpointConfig, requestConfig);

    const responseData = await requestHandler.request<
      FinalResponse<ResponseData, DefaultResponse>,
      FinalParams<ResponseData, QueryParams_, QueryParams>,
      FinalParams<ResponseData, UrlParams, UrlParams>,
      FallbackValue<ResponseData, DefaultPayload, RequestBody>
    >(url, mergedConfig);

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
