import { createApiHandler } from './api-handler';
import { RequestHandler } from './request-handler';
import type { RequestHandlerConfig, RequestResponse } from './types';

/**
 * Simple wrapper for API Handler instance creation.
 * Creates an API fetcher function using native fetch() or Axios if it is passed as "fetcher".
 *
 * @param {Object} config - Configuration object for the API fetcher.
 * @param {Object} config.fetcher - The Axios (or any other) instance to use for making requests.
 * @param {Object} config.endpoints - An object containing endpoint definitions.
 * @param {string} config.apiUrl - The base URL for the API.
 * @param {Function} [config.onError] - Optional callback function for handling errors.
 * @param {Object} [config.headers] - Optional default headers to include in every request.
 * @returns {Function} - A function that makes API requests using the provided Axios instance.
 *
 * @example
 * // Import axios
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
export const createApiFetcher = createApiHandler;

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
