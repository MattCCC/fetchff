import type { RequestHandlerConfig, FetchResponse } from './types';
import type {
  RequestInterceptor,
  ResponseInterceptor,
} from './types/interceptor-manager';

/**
 * Applies a series of request interceptors to the provided configuration.
 * @param {RequestHandlerConfig} config - The initial request configuration.
 * @param {RequestInterceptor | RequestInterceptor[]} interceptors - The request interceptor function(s) to apply.
 * @returns {Promise<RequestHandlerConfig>} - The modified request configuration.
 */
export async function interceptRequest(
  config: RequestHandlerConfig,
  interceptors: RequestInterceptor | RequestInterceptor[],
): Promise<RequestHandlerConfig> {
  if (!interceptors) {
    return config;
  }

  const interceptorList = Array.isArray(interceptors)
    ? interceptors
    : [interceptors];

  let interceptedConfig = { ...config };

  for (const interceptor of interceptorList) {
    interceptedConfig = await interceptor(interceptedConfig);
  }

  return interceptedConfig;
}

/**
 * Applies a series of response interceptors to the provided response.
 * @param {FetchResponse<ResponseData>} response - The initial response object.
 * @param {ResponseInterceptor | ResponseInterceptor[]} interceptors - The response interceptor function(s) to apply.
 * @returns {Promise<FetchResponse<ResponseData>>} - The modified response object.
 */
export async function interceptResponse<ResponseData = unknown>(
  response: FetchResponse<ResponseData>,
  interceptors: ResponseInterceptor | ResponseInterceptor[],
): Promise<FetchResponse<ResponseData>> {
  if (!interceptors) {
    return response;
  }

  const interceptorList = Array.isArray(interceptors)
    ? interceptors
    : [interceptors];

  let interceptedResponse = response;

  for (const interceptor of interceptorList) {
    interceptedResponse = await interceptor(interceptedResponse);
  }

  return interceptedResponse;
}
