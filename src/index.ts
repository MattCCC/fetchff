import { RequestHandler } from './request-handler';
import type { APIResponse, FetchResponse, RequestHandlerConfig } from './types';

/**
 * Simple wrapper for request fetching.
 * It abstracts the creation of RequestHandler, making it easy to perform API requests.
 *
 * @param {string | URL | globalThis.Request} url - Request URL.
 * @param {RequestHandlerConfig} config - Configuration object for the request handler.
 * @returns {Promise<ResponseData & FetchResponse<ResponseData>>} Response Data.
 */
export async function fetchf<ResponseData = APIResponse>(
  url: string,
  config: RequestHandlerConfig = {},
): Promise<ResponseData & FetchResponse<ResponseData>> {
  return new RequestHandler(config).request<ResponseData>(url, null, config);
}

export * from './types';
export * from './api-handler';
