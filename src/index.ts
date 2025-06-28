import { createRequestHandler } from './request-handler';
import type {
  DefaultResponse,
  FetchResponse,
  RequestHandlerConfig,
} from './types';

/**
 * Simple wrapper for request fetching.
 * It abstracts the creation of RequestHandler, making it easy to perform API requests.
 *
 * @param {string | URL | globalThis.Request} url - Request URL.
 * @param {RequestHandlerConfig} config - Configuration object for the request handler.
 * @returns {Promise<FetchResponse<ResponseData>>} Response Data.
 */
export async function fetchf<ResponseData = DefaultResponse>(
  url: string,
  config: RequestHandlerConfig<ResponseData> = {},
): Promise<FetchResponse<ResponseData>> {
  return createRequestHandler(config).request<ResponseData>(url);
}

export { createApiFetcher } from './api-handler';

export { subscribe } from './pubsub-manager';

export { abortRequest, getInFlightPromise } from './inflight-manager';

export {
  generateCacheKey,
  getCachedResponse,
  mutate,
  setCache,
  deleteCache,
} from './cache-manager';

export { buildConfig } from './config-handler';

export * from './types';
