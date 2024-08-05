import { RequestHandler } from './request-handler';
import type { APIResponse, FetchResponse, RequestHandlerConfig } from './types';

/**
 * Simple wrapper for request fetching.
 * It abstracts the creation of RequestHandler, making it easy to perform API requests.
 *
 * @param {string | URL | globalThis.Request} url - Request URL.
 * @param {Object} config - Configuration object for the request handler.
 * @returns {Promise<Response | RequestResponse>} Response Data.
 */
export async function fetchf<Response = APIResponse>(
  url: string,
  config: RequestHandlerConfig = {},
): Promise<Response & FetchResponse<Response>> {
  return new RequestHandler(config).request<Response>(
    url,
    config.body || config.data || config.params,
    config,
  );
}

export * from './types';
export * from './api-handler';
