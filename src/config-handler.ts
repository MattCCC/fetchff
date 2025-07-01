import {
  GET,
  APPLICATION_JSON,
  HEAD,
  STRING,
  CHARSET_UTF_8,
  CONTENT_TYPE,
  OBJECT,
  REJECT,
} from './constants';
import type {
  FetcherConfig,
  HeadersObject,
  Method,
  RequestConfig,
} from './types/request-handler';
import {
  replaceUrlPathParams,
  appendQueryParams,
  isSearchParams,
  isJSONSerializable,
  isSlowConnection,
} from './utils';

const defaultTimeoutMs = (isSlowConnection() ? 60 : 30) * 1000;

export const defaultConfig: RequestConfig = {
  method: GET,
  strategy: REJECT,
  timeout: defaultTimeoutMs, // 30 seconds (60 on slow connections)
  headers: {
    Accept: APPLICATION_JSON + ', text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
  },
  retry: {
    delay: defaultTimeoutMs / 30, // 1 second (2 on slow connections)
    maxDelay: defaultTimeoutMs, // 30 seconds (60 on slow connections)
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
 * Overwrites the default configuration with the provided custom configuration.
 *
 * @param {Partial<RequestConfig>} customConfig - The custom configuration to merge into the default config.
 * @returns {Partial<RequestConfig>} - The updated default configuration object.
 */
export const setDefaultConfig = (
  customConfig: Partial<RequestConfig>,
): Partial<RequestConfig> => {
  Object.assign(defaultConfig, customConfig);

  return defaultConfig;
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
  let method = requestConfig.method as Method;
  method = method ? (method.toUpperCase() as Method) : GET;

  let body: RequestConfig['data'] | undefined;

  // Only applicable for request methods 'PUT', 'POST', 'DELETE', and 'PATCH'
  if (method !== GET && method !== HEAD) {
    body = requestConfig.body ?? requestConfig.data;

    // Automatically stringify request body, if possible and when not dealing with strings
    if (
      body &&
      typeof body !== STRING &&
      !isSearchParams(body) &&
      isJSONSerializable(body)
    ) {
      body = JSON.stringify(body);
    }
  }

  setContentTypeIfNeeded(method, requestConfig.headers, body);

  // Native fetch compatible settings
  const credentials = requestConfig.withCredentials
    ? 'include'
    : requestConfig.credentials;

  // The explicitly passed query params
  const dynamicUrl = replaceUrlPathParams(url, requestConfig.urlPathParams);
  const urlPath = appendQueryParams(dynamicUrl, requestConfig.params);
  const isFullUrl = urlPath.includes('://');
  const baseURL = isFullUrl
    ? ''
    : requestConfig.baseURL || requestConfig.apiUrl || '';

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
 * @param {K} property - The property key to merge from the base and new configurations. Must be a key of RequestConfig.
 * @param {RequestConfig} targetConfig - The configuration object that will receive the merged properties.
 * @param {RequestConfig} baseConfig - The base configuration object that provides default values.
 * @param {RequestConfig} newConfig - The new configuration object that contains user-specific settings to merge.
 */
export const mergeConfig = <K extends keyof RequestConfig>(
  property: K,
  targetConfig: RequestConfig,
  baseConfig: RequestConfig,
  newConfig: RequestConfig,
) => {
  if (newConfig[property]) {
    targetConfig[property] = {
      ...baseConfig[property],
      ...newConfig[property],
    };
  }
};
