/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  BodyPayload,
  QueryParams,
  QueryParamsOrBody,
  UrlPathParams,
} from './api-handler';
import type {
  RequestInterceptor,
  ResponseInterceptor,
} from './interceptor-manager';

export type Method =
  | 'get'
  | 'GET'
  | 'delete'
  | 'DELETE'
  | 'head'
  | 'HEAD'
  | 'options'
  | 'OPTIONS'
  | 'post'
  | 'POST'
  | 'put'
  | 'PUT'
  | 'patch'
  | 'PATCH'
  | 'purge'
  | 'PURGE'
  | 'link'
  | 'LINK'
  | 'unlink'
  | 'UNLINK';

export type NativeFetch = typeof fetch;

export interface FetcherInstance {
  create: <RequestInstance = CreatedCustomFetcherInstance>(
    config?: BaseRequestHandlerConfig,
  ) => RequestInstance;
}

export interface CreatedCustomFetcherInstance {
  request<ResponseData = any>(
    requestConfig: RequestConfig,
  ): FetchResponse<ResponseData> | PromiseLike<FetchResponse<ResponseData>>;
}

export type ErrorHandlingStrategy =
  | 'reject'
  | 'silent'
  | 'defaultResponse'
  | 'softFail';

type ErrorHandlerInterceptor = (error: ResponseError) => unknown;

export interface HeadersObject {
  [key: string]: string;
}

export interface ExtendedResponse<T = any> extends Omit<Response, 'headers'> {
  data: T;
  error: ResponseError<T> | null;
  headers: HeadersObject & HeadersInit;
  config: ExtendedRequestConfig;
  request?: ExtendedRequestConfig;
}

export type FetchResponse<T = any> = ExtendedResponse<T>;

export interface ResponseError<T = any> extends Error {
  config: ExtendedRequestConfig;
  code?: string;
  status?: number;
  statusText?: string;
  request?: ExtendedRequestConfig;
  response?: FetchResponse<T>;
}

export interface RetryOptions {
  /**
   * Maximum number of retry attempts.
   * @default 0
   */
  retries?: number;

  /**
   * Delay between retries in milliseconds.
   * @default 1000
   */
  delay?: number;

  /**
   * Exponential backoff.
   * @default 1.5
   */
  backoff?: number;

  /**
   * Maximum delay between retries in milliseconds.
   * @default 30000
   */
  maxDelay?: number;

  /**
   * Reset timeout when retrying requests
   * @default true
   */
  resetTimeout?: boolean;

  /**
   * Retry only on specific status codes.
   * @url https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
   * @default [
   *   408, // Request Timeout
   *   409, // Conflict
   *   425, // Too Early
   *   429, // Too Many Requests
   *   500, // Internal Server Error
   *   502, // Bad Gateway
   *   503, // Service Unavailable
   *   504, // Gateway Timeout
   * ]
   */
  retryOn?: number[];

  /**
   * A function to determine whether to retry based on the error and attempt number.
   */
  shouldRetry?: <T = any>(
    error: ResponseError<T>,
    attempt: number,
  ) => Promise<boolean>;
}

export type PollingFunction = <ResponseData = unknown>(
  response: FetchResponse<ResponseData>,
  attempt: number,
  error?: ResponseError,
) => boolean;

export type CacheKeyFunction = (config: FetcherConfig) => string;

export type CacheBusterFunction = (config: FetcherConfig) => boolean;

export type CacheSkipFunction = <ResponseData = any>(
  data: ResponseData,
  config: RequestConfig,
) => boolean;

/**
 * Configuration object for cache related options
 */
export interface CacheOptions {
  /**
   * Maximum time, in seconds, a cache entry is considered fresh (valid).
   * After this time, the entry may be considered stale (expired).
   *
   * @default 0 (no cache)
   */
  cacheTime?: number;

  /**
   * Cache key
   * It provides a way to customize caching behavior dynamically according to different criteria.
   * @param config - Request configuration.
   * @default null By default it generates a unique cache key for HTTP requests based on:
   * URL with Query Params, headers, body, mode, credentials, cache mode, redirection, referrer, integrity
   */
  cacheKey?: CacheKeyFunction;

  /**
   * Cache Buster Function
   * It is called when a cache entry exists and you want to invalidate or refresh the cache under certain conditions
   * @param config - Request configuration.
   * @default (config)=>false Busting cache is disabled by default. Return true to change that
   */
  cacheBuster?: CacheBusterFunction;

  /**
   * Skip Cache Function
   * Determines whether to set or skip setting caching for a request based on the response.
   * @param response - Parsed Response.
   * @param config - Request configuration.
   * @default (response,config)=>false Bypassing cache is disabled by default. Return true to skip cache
   */
  skipCache?: CacheSkipFunction;
}

/**
 * ExtendedRequestConfig<D = any>
 *
 * This interface extends the standard `RequestInit` from the Fetch API, providing additional options
 * for handling requests, including custom error handling strategies, request interception, and more.
 */
interface ExtendedRequestConfig<D = any>
  extends Omit<RequestInit, 'body'>,
    CacheOptions {
  /**
   * Custom error handling strategy for the request.
   * - `'reject'`: Rejects the promise with an error.
   * - `'silent'`: Silently handles errors without rejecting.
   * - `'defaultResponse'`: Returns a default response in case of an error.
   * - `'softFail'`: Returns a partial response with error details.
   */
  strategy?: ErrorHandlingStrategy;

  /**
   * A default response to return if the request fails and the strategy is set to `'defaultResponse'`.
   */
  defaultResponse?: any;

  /**
   * If `true`, flattens the response object, extracting the data directly instead of keeping it nested.
   */
  flattenResponse?: boolean;

  /**
   * If true, the ongoing previous requests will be automatically cancelled.
   * @default false
   */
  cancellable?: boolean;

  /**
   * If `true`, rejects the request promise when the request is cancelled.
   * @default false
   */
  rejectCancelled?: boolean;

  /**
   * An object representing dynamic URL path parameters.
   * For example, `{ userId: 1 }` would replace `:userId` in the URL with `1`.
   */
  urlPathParams?: UrlPathParams;

  /**
   * Configuration options for retrying failed requests.
   */
  retry?: RetryOptions;

  /**
   * The URL of the request. This can be a full URL or a relative path combined with `baseURL`.
   */
  url?: string;

  /**
   * The HTTP method to use for the request (e.g., 'GET', 'POST', etc.).
   * @default GET
   */
  method?: Method | string;

  /**
   * The base URL to prepend to the `url` when making the request.
   */
  baseURL?: string;

  /**
   * An object representing the headers to include with the request.
   */
  headers?: HeadersInit;

  /**
   * Query parameters to include in the request URL.
   */
  params?: QueryParams;

  /**
   * Indicates whether credentials (such as cookies) should be included with the request.
   */
  withCredentials?: boolean;

  /**
   * An `AbortSignal` object that can be used to cancel the request.
   */
  signal?: AbortSignal;

  /**
   * Data to be sent as the request body, extending the native Fetch API's `body` option.
   * Supports `BodyInit`, objects, arrays, and strings, with automatic serialization.
   */
  body?: BodyPayload<D>;

  /**
   * Alias for "body"
   */
  data?: BodyPayload<D>;

  /**
   * A function or array of functions to intercept the request before it is sent.
   */
  onRequest?: RequestInterceptor | RequestInterceptor[];

  /**
   * A function or array of functions to intercept the response before it is resolved.
   */
  onResponse?: ResponseInterceptor | ResponseInterceptor[];

  /**
   * A function to handle errors that occur during the request or response processing.
   */
  onError?: ErrorHandlerInterceptor;

  /**
   * The maximum time (in milliseconds) the request can take before automatically being aborted.
   */
  timeout?: number;

  /**
   * Time window, in miliseconds, during which identical requests are deduplicated (treated as single request).
   * @default 1000 (1 second)
   */
  dedupeTime?: number;

  /**
   * Interval in milliseconds between polling attempts.
   * Set to < 1 to disable polling.
   * @default 0 (disabled)
   */
  pollingInterval?: number;

  /**
   * Function to determine if polling should stop based on the response.
   * @param response - The response data.
   * @returns `true` to stop polling, `false` to continue.
   */
  shouldStopPolling?: PollingFunction;
}

interface BaseRequestHandlerConfig extends RequestConfig {
  fetcher?: FetcherInstance | null;
  apiUrl?: string;
  logger?: any;
}

export type RequestConfig = ExtendedRequestConfig;

export type FetcherConfig = Omit<ExtendedRequestConfig, 'url'> & {
  url: string;
};

export type RequestHandlerConfig = BaseRequestHandlerConfig;

export interface RequestHandlerReturnType {
  config: RequestHandlerConfig;
  getInstance: () => CreatedCustomFetcherInstance | null;
  buildConfig: (
    url: string,
    data: QueryParamsOrBody,
    config: RequestConfig,
  ) => RequestConfig;
  request: <ResponseData = unknown>(
    url: string,
    data?: QueryParamsOrBody,
    config?: RequestConfig | null,
  ) => Promise<ResponseData & FetchResponse<ResponseData>>;
}
