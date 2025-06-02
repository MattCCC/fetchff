import {
  GET,
  APPLICATION_JSON,
  HEAD,
  STRING,
  CHARSET_UTF_8,
  CONTENT_TYPE,
  OBJECT,
} from './constants';
import type {
  FetcherConfig,
  HeadersObject,
  Method,
  RequestConfig,
  RequestHandlerConfig,
} from './types/request-handler';
import {
  replaceUrlPathParams,
  appendQueryParams,
  isSearchParams,
  isJSONSerializable,
} from './utils';

export const defaultConfig: RequestHandlerConfig = {
  method: GET,
  strategy: 'reject',
  timeout: 30000,
  dedupeTime: 0,
  defaultResponse: null,
  headers: {
    Accept: APPLICATION_JSON + ', text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
  },
  retry: {
    delay: 1000,
    maxDelay: 30000,
    resetTimeout: true,
    backoff: 1.5,

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
    retryOn: [
      408, // Request Timeout
      409, // Conflict
      425, // Too Early
      429, // Too Many Requests
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
    ],
  },
};

/**
 * Build request configuration
 *
 * @param {string} url - Request url
 * @param {RequestConfig} requestConfig - Request config passed when making the request
 * @returns {FetcherConfig} - Provider's instance
 */
export const buildConfig = (
  url: string,
  requestConfig: RequestConfig,
): FetcherConfig => {
  const method = (requestConfig.method ?? GET).toUpperCase() as Method;
  const isGetAlikeMethod = method === GET || method === HEAD;
  const dynamicUrl = replaceUrlPathParams(url, requestConfig.urlPathParams);

  let body: RequestConfig['data'] | undefined;

  // Only applicable for request methods 'PUT', 'POST', 'DELETE', and 'PATCH'
  if (!isGetAlikeMethod) {
    body = requestConfig.body ?? requestConfig.data;
  }

  setContentTypeIfNeeded(method, requestConfig.headers, body);

  // Native fetch compatible settings
  const credentials = requestConfig.withCredentials
    ? 'include'
    : requestConfig.credentials;

  // The explicitly passed query params
  const explicitParams = requestConfig.params;

  const urlPath = explicitParams
    ? appendQueryParams(dynamicUrl, explicitParams)
    : dynamicUrl;
  const isFullUrl = urlPath.includes('://');
  const baseURL = isFullUrl
    ? ''
    : (requestConfig.baseURL ?? requestConfig.apiUrl);

  // Automatically stringify request body, if possible and when not dealing with strings
  if (
    body &&
    typeof body !== STRING &&
    !isSearchParams(body) &&
    isJSONSerializable(body)
  ) {
    body = JSON.stringify(body);
  }

  return {
    ...requestConfig,
    url: baseURL + urlPath,
    method,
    credentials,
    body,
  };
};

/**
 * Ensures the `Content-Type` header is set to `application/json; charset=utf-8`
 * if it is not already present and the request method and body meet specific conditions.
 *
 * @param headers - The headers object to modify. Can be an instance of `Headers`
 *                  or a plain object conforming to `HeadersInit`.
 * @param method - The HTTP method of the request (e.g., 'PUT', 'DELETE', etc.).
 * @param body - The optional body of the request. If no body is provided and the
 *               method is 'PUT' or 'DELETE', the function exits without modifying headers.
 */
const setContentTypeIfNeeded = (
  method: string,
  headers?: HeadersInit | HeadersObject,
  body?: unknown,
): void => {
  if (!headers || (!body && ['PUT', 'DELETE'].includes(method))) {
    return;
  }

  const contentTypeValue = APPLICATION_JSON + ';' + CHARSET_UTF_8;

  if (headers instanceof Headers) {
    if (!headers.has(CONTENT_TYPE)) {
      headers.set(CONTENT_TYPE, contentTypeValue);
    }
  } else if (
    typeof headers === OBJECT &&
    !Array.isArray(headers) &&
    !headers[CONTENT_TYPE]
  ) {
    headers[CONTENT_TYPE] = contentTypeValue;
  }
};

/**
 * Merges the specified property from the base configuration and the new configuration into the target configuration.
 *
 * @param {K} property - The property key to merge from the base and new configurations. Must be a key of RequestHandlerConfig.
 * @param {RequestHandlerConfig} targetConfig - The configuration object that will receive the merged properties.
 * @param {RequestHandlerConfig} baseConfig - The base configuration object that provides default values.
 * @param {RequestHandlerConfig} newConfig - The new configuration object that contains user-specific settings to merge.
 */
export const mergeConfig = <K extends keyof RequestHandlerConfig>(
  property: K,
  targetConfig: RequestHandlerConfig,
  baseConfig: RequestHandlerConfig,
  newConfig: RequestHandlerConfig,
) => {
  if (newConfig[property]) {
    targetConfig[property] = {
      ...baseConfig[property],
      ...newConfig[property],
    };
  }
};
