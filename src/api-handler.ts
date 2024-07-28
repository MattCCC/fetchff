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
  APIQueryParams,
  APIUriParams,
  // Endpoints,
  // Endpoints,
} from './types/api';

/**
 * Creates an instance of API Handler.
 * It initializes the Request Handler and allows to make calls to the list of specified endpoints.
 *
 * @param config API Handler Configuration
 * @returns API handler functions and endpoints to call
 */
function createApiHandler<EndpointsMethods = never, EndpointsCfg = never>(
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
   * @param {APIQueryParams} [queryParams={}] - Query parameters to include in the request.
   * @param {APIUriParams} [uriParams={}] - URI parameters to include in the request.
   * @param {EndpointConfig} [requestConfig={}] - Additional configuration for the request.
   * @returns {Promise<RequestResponse>} - A promise that resolves with the response from the API provider.
   */
  async function handleRequest(
    endpointName: keyof EndpointsMethods & string,
    queryParams: APIQueryParams = {},
    uriParams: APIUriParams = {},
    requestConfig: RequestConfig = {},
  ): Promise<RequestResponse> {
    // Use global per-endpoint settings
    const endpoint = endpoints[endpointName as string];
    const endpointSettings = { ...endpoint };

    const responseData = await requestHandler.handleRequest(
      endpointSettings.url,
      queryParams,
      {
        ...endpointSettings,
        ...requestConfig,
        uriParams,
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

    return apiHandler.handleRequest.bind(null, prop);
  }

  const apiHandler: ApiHandlerMethods<EndpointsMethods> = {
    config,
    endpoints,
    requestHandler,
    getInstance,
    handleRequest,
  };

  return new Proxy(apiHandler, {
    get: (_target, prop) => get(prop),
  }) as ApiHandlerReturnType<EndpointsMethods, EndpointsCfg>;
}

export { createApiHandler };
