import { RequestHandler } from './request-handler';
import type { RequestHandlerConfig, RequestResponse } from './types';

/**
 * Simple wrapper for request fetching.
 * It abstracts the creation of RequestHandler, making it easy to perform API requests.
 *
 * @param {string | URL | globalThis.Request} url - Request URL.
 * @param {Object} config - Configuration object for the request handler.
 * @returns {Promise<RequestResponse>} Response Data.
 */
export async function fetchf(
  url: string,
  config: RequestHandlerConfig = {},
): Promise<RequestResponse> {
  return new RequestHandler(config).handleRequest(
    url,
    config.body || config.data || config.params,
    config,
  );
}

export * from './types';
export * from './api-handler';
export * from './request-handler';
