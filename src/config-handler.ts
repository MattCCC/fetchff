import { processHeaders } from './utils';
import {
  GET,
  APPLICATION_JSON,
  HEAD,
  STRING,
  CHARSET_UTF_8,
  CONTENT_TYPE,
  REJECT,
  UNDEFINED,
  APPLICATION_CONTENT_TYPE,
} from './constants';
import type {
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
  isAbsoluteUrl,
  sanitizeObject,
  isObject,
} from './utils';

const defaultTimeoutMs = (isSlowConnection() ? 60 : 30) * 1000;

export const defaultConfig: RequestConfig = {
  strategy: REJECT,
  timeout: defaultTimeoutMs, // 30 seconds (60 on slow connections)
  loadingTimeout: defaultTimeoutMs / 10, // 3 seconds (6 on slow connections)
  focusThrottleInterval: 5000, // 5 seconds
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

    // Idempotent methods, which can be repeated safely, unlike e.g. POST requests that create resources
    methods: [GET, HEAD, 'PUT', 'DELETE', 'OPTIONS', 'TRACE'],
  },
};

/**
 * Overwrites the default configuration with the provided custom configuration.
 *
 * @param {Partial<RequestConfig>} customConfig - The custom configuration to merge into the default config.
 * @returns {Partial<RequestConfig>} - The updated default configuration object.
 */
export function setDefaultConfig(
  customConfig: Partial<RequestConfig>,
): Partial<RequestConfig> {
  const sanitized = sanitizeObject(customConfig);

  // Merge nested retry and headers settings into the current defaults instead of replacing them
  return mergeConfigs(
    { retry: defaultConfig.retry, headers: defaultConfig.headers },
    sanitized,
    defaultConfig,
  );
}

/**
 * Returns a shallow copy of the current default configuration.
 *
 * @returns {RequestConfig} - The current default configuration.
 */
export function getDefaultConfig(): RequestConfig {
  return { ...defaultConfig };
}

/**
 * Build request configuration from defaults and overrides.
 * This function merges the default configuration with the provided request configuration,
 * @param {string} url - Request url
 * @param {RequestConfig<ResponseData, QueryParams, PathParams, RequestBody> | null | undefined} reqConfig - Request configuration
 * @return {RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>} - Merged request configuration
 */
export function buildConfig<ResponseData, RequestBody, QueryParams, PathParams>(
  url: string,
  reqConfig?: RequestConfig<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  > | null,
): RequestConfig<ResponseData, QueryParams, PathParams, RequestBody> {
  // Merging gives the request its own copies of nested objects like headers, so that
  // mutations (e.g. by interceptors) never leak into the global defaults
  const merged = mergeConfigs(
    defaultConfig,
    reqConfig ? sanitizeObject(reqConfig) : {},
  );

  return buildFetcherConfig(url, merged);
}

/**
 * Builds the fetcher configuration by setting the method, body, headers, and URL.
 * It also handles query parameters and path parameters. This fn mutates the passed `requestConfig` object.
 * @param {string} url - The endpoint URL to which the request will be sent.
 * @param {RequestConfig} requestConfig - The request configuration object containing method, body, headers, and other options.
 * @return {RequestConfig} - The modified request configuration object with the URL, method, body, and headers set appropriately.
 **/
export function buildFetcherConfig(
  url: string,
  requestConfig: RequestConfig,
): RequestConfig {
  let method = requestConfig.method as Method;
  method = method ? (method.toUpperCase() as Method) : GET;

  let body: RequestConfig['data'] | undefined;

  // Only applicable for request methods 'PUT', 'POST', 'DELETE', and 'PATCH'
  if (method !== GET && method !== HEAD) {
    body = requestConfig.body ?? requestConfig.data;

    // Automatically stringify request body, if possible and when not dealing with strings
    if (body && typeof body !== STRING && isJSONSerializable(body)) {
      body = JSON.stringify(body);
    }
  }

  setContentTypeIfNeeded(requestConfig.headers, body);

  // Native fetch compatible settings
  const credentials = requestConfig.withCredentials
    ? 'include'
    : requestConfig.credentials;

  // The explicitly passed query params
  const dynamicUrl = replaceUrlPathParams(url, requestConfig.urlPathParams);
  const urlPath = appendQueryParams(dynamicUrl, requestConfig.params);
  const isFullUrl = isAbsoluteUrl(url);
  const baseURL = isFullUrl
    ? ''
    : requestConfig.baseURL || requestConfig.apiUrl || '';

  // Join as a path, as plain concatenation could extend the host of the baseURL,
  // e.g. "https://api.example.com" + ".evil.com" would point to another host
  const separator =
    baseURL && urlPath && !baseURL.endsWith('/') && !/^[/?#]/.test(urlPath)
      ? '/'
      : '';

  requestConfig.url = baseURL + separator + urlPath;
  requestConfig.method = method;
  requestConfig.credentials = credentials;
  requestConfig.body = body;

  return requestConfig;
}

/**
 * Ensures the `Content-Type` header is set to `application/json; charset=utf-8`
 * if it is not already present and the request method and body meet specific conditions.
 *
 * @param headers - The headers object to modify. Can be an instance of `Headers`
 *                  or a plain object conforming to `HeadersInit`.
 * @param body - The optional body of the request. If no body is provided and the
 *               method is 'GET' or 'HEAD', the function exits without modifying headers.
 */
function setContentTypeIfNeeded(
  headers?: HeadersInit | HeadersObject,
  body?: unknown,
): void {
  // If no headers are provided, or if the body is not set and the method is PUT or DELETE, do nothing
  if (!headers || !body) {
    return;
  }

  // Types that should not have Content-Type set (browser handles these)
  if (
    body instanceof FormData || // Browser automatically sets multipart/form-data with boundary
    (typeof Blob !== UNDEFINED && body instanceof Blob) || // Blob/File (a File is a Blob) already have their own MIME types, don't override
    (typeof ReadableStream !== UNDEFINED && body instanceof ReadableStream) // Stream type should be determined by the stream source
  ) {
    return;
  }

  let contentTypeValue: string;

  if (isSearchParams(body)) {
    contentTypeValue = APPLICATION_CONTENT_TYPE + 'x-www-form-urlencoded';
  } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    contentTypeValue = APPLICATION_CONTENT_TYPE + 'octet-stream';
  } else if (isJSONSerializable(body)) {
    contentTypeValue = APPLICATION_JSON + ';' + CHARSET_UTF_8;
  } else {
    // Do not set Content-Type if content is not recognizable
    return;
  }

  if (headers instanceof Headers) {
    if (!headers.has(CONTENT_TYPE)) {
      headers.set(CONTENT_TYPE, contentTypeValue);
    }
  } else if (
    isObject(headers) &&
    !Array.isArray(headers) &&
    // Header names are case-insensitive, so check the normalized (lowercase) headers
    !processHeaders(headers as HeadersObject)[CONTENT_TYPE.toLowerCase()]
  ) {
    headers[CONTENT_TYPE] = contentTypeValue;
  }
}

// The interceptors that are merged instead of replaced
const INTERCEPTORS = [
  'onRequest',
  'onResponse',
  'onError',
  'onLoadingSlow',
] as const;

/**
 * Merges two request configurations, applying overrides from the second config to the first.
 * Handles special merging for nested properties like 'retry' and 'headers' (deep merge),
 * and concatenates interceptor arrays for 'onRequest', 'onResponse', 'onError' and 'onLoadingSlow'.
 * If a target config is provided, it mutates that object; otherwise, creates a new one.
 *
 * @param {RequestConfig} baseConfig - The base configuration object to merge from.
 * @param {RequestConfig} overrideConfig - The override configuration object to apply on top of the base.
 * @param {RequestConfig} [targetConfig={}] - Optional target configuration object to merge into (mutated in place).
 * @returns {RequestConfig} The merged configuration object.
 *
 * @example
 * const base = { timeout: 5000, headers: { 'Accept': 'application/json' } };
 * const override = { timeout: 10000, headers: { 'Authorization': 'Bearer token' } };
 * const merged = mergeConfigs(base, override);
 * // Result: { timeout: 10000, headers: { Accept: 'application/json', Authorization: 'Bearer token' } }
 */
export function mergeConfigs(
  baseConfig: RequestConfig,
  overrideConfig: RequestConfig,
  targetConfig: RequestConfig = {},
): RequestConfig {
  Object.assign(targetConfig, baseConfig, overrideConfig);

  // Ensure that retry and headers are merged correctly
  mergeConfig('retry', baseConfig, overrideConfig, targetConfig);
  mergeConfig('headers', baseConfig, overrideConfig, targetConfig);

  // Merge interceptors efficiently
  for (const property of INTERCEPTORS) {
    mergeInterceptors(property, baseConfig, overrideConfig, targetConfig);
  }

  return targetConfig;
}

/**
 * Efficiently merges interceptor functions from base and new configs
 */
function mergeInterceptors<
  K extends
    'onRequest' | 'onResponse' | 'onError' | 'onRetry' | 'onLoadingSlow',
>(
  property: K,
  baseConfig: RequestConfig,
  overrideConfig: RequestConfig,
  targetConfig: RequestConfig,
): void {
  const baseInterceptor = baseConfig[property];
  const newInterceptor = overrideConfig[property];

  if (baseInterceptor && newInterceptor) {
    // This is the only LIFO interceptor, so we apply it after the response is prepared
    targetConfig[property] = (
      property === 'onResponse'
        ? [].concat(newInterceptor as never, baseInterceptor as never)
        : [].concat(baseInterceptor as never, newInterceptor as never)
    ) as RequestConfig[K];
  } else if (baseInterceptor || newInterceptor) {
    targetConfig[property] = baseInterceptor || newInterceptor;
  }
}

/**
 * Merges the specified property from the base configuration and the override configuration into the target configuration.
 *
 * @param {K} property - The property key to merge from the base and override configurations. Must be a key of RequestConfig.
 * @param {RequestConfig} baseConfig - The base configuration object that provides default values.
 * @param {RequestConfig} overrideConfig - The override configuration object that contains user-specific settings to merge.
 * @param {RequestConfig} targetConfig - The configuration object that will receive the merged properties.
 */
export function mergeConfig<K extends keyof RequestConfig>(
  property: K,
  baseConfig: RequestConfig,
  overrideConfig: RequestConfig,
  targetConfig: RequestConfig,
): void {
  const base = baseConfig[property];
  const override = overrideConfig[property];

  if (override) {
    if (property === 'headers') {
      // Handle Headers instances which don't expose entries as own enumerable properties
      const isInstance =
        (base as Headers | (HeadersObject & HeadersInit)) instanceof Headers ||
        (override as Headers | (HeadersObject & HeadersInit)) instanceof
          Headers;
      const merged: HeadersObject = isInstance
        ? processHeaders(base)
        : { ...(base as HeadersObject) };
      const overrides: HeadersObject = isInstance
        ? processHeaders(override)
        : sanitizeObject(override as HeadersObject);

      // Header names are case-insensitive, so replace existing entries instead of duplicating them
      for (const key of Object.keys(overrides)) {
        const lowerKey = key.toLowerCase();

        for (const existingKey in merged) {
          if (existingKey.toLowerCase() === lowerKey) {
            delete merged[existingKey];
          }
        }

        merged[key] = overrides[key];
      }

      targetConfig[property] = merged as RequestConfig[K];
    } else {
      targetConfig[property] = {
        ...base,
        ...sanitizeObject(override as Record<string, unknown>),
      } as RequestConfig[K];
    }
  } else if (
    override === undefined &&
    isObject(base) &&
    !((base as Headers | HeadersObject) instanceof Headers)
  ) {
    // Copy so that mutating the merged config never changes the base config
    targetConfig[property] = { ...base } as RequestConfig[K];
  }
}
