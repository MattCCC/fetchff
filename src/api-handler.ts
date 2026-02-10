import type {
  ApiHandlerConfig,
  ApiHandlerDefaultMethods,
  ApiHandlerMethods,
  RequestConfigUrlRequired,
} from './types/api-handler';
import { fetchf } from '.';
import { mergeConfigs } from './config-handler';
import { isAbsoluteUrl } from './utils';

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
  EndpointTypes extends object,
  EndpointsSettings = never,
>(config: ApiHandlerConfig<EndpointTypes>) {
  const endpoints = config.endpoints;

  /**
   * Triggered when trying to use non-existent endpoints
   *
   * @param endpointName Endpoint Name
   * @returns {Promise}
   */
  function handleNonImplemented(endpointName: string): Promise<null> {
    console.error('Add ' + endpointName + " to 'endpoints'.");

    return Promise.resolve(null);
  }

  const apiHandler: ApiHandlerDefaultMethods<EndpointTypes> = {
    config,
    endpoints,
    /**
     * Handle Single API Request
     * It considers settings in following order: per-request settings, global per-endpoint settings, global settings.
     *
     * @param endpointName - The name of the API endpoint to call.
     * @param requestConfig - Additional configuration for the request.
     * @returns A promise that resolves with the response from the API provider.
     */
    async request(endpointName, requestConfig = {}) {
      // Use global and per-endpoint settings
      const endpointConfig = endpoints[endpointName];
      const _endpointConfig =
        endpointConfig ||
        ({ url: String(endpointName) } as RequestConfigUrlRequired);
      const url = _endpointConfig.url;

      // Block Protocol-relative URLs as they could lead to SSRF (Server-Side Request Forgery)
      if (url.startsWith('//')) {
        throw new Error('Protocol-relative URLs not allowed.');
      }

      // Prevent potential Server-Side Request Forgery attack and leakage of credentials when same instance is used for external requests
      const mergedConfig = isAbsoluteUrl(url)
        ? // Merge endpoints configs for absolute URLs only if urls match
          endpointConfig?.url === url
          ? mergeConfigs(_endpointConfig, requestConfig)
          : requestConfig
        : mergeConfigs(mergeConfigs(config, _endpointConfig), requestConfig);

      // We prevent potential Server-Side Request Forgery attack and leakage of credentials as the same instance is not used for external requests
      // Retrigger fetch to ensure completely new instance of handler being triggered for external URLs
      return fetchf(url, mergedConfig);
    },
  };

  /**
   * Maps all API requests using native Proxy
   *
   * @param {*} prop          Caller
   */
  return new Proxy<ApiHandlerMethods<EndpointTypes, EndpointsSettings>>(
    apiHandler as ApiHandlerMethods<EndpointTypes, EndpointsSettings>,
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
