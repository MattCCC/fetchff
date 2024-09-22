/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  BodyPayload,
  QueryParams,
  QueryParamsOrBody,
  UrlPathParams,
} from './api-handler';
import type {
  ErrorInterceptor,
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
    requestConfig: RequestConfig<ResponseData>,
  ): FetchResponse<ResponseData> | PromiseLike<FetchResponse<ResponseData>>;
}

export type ErrorHandlingStrategy =
  | 'reject'
  | 'silent'
  | 'defaultResponse'
  | 'softFail';

export interface HeadersObject {
  [key: string]: string;
}

export interface ExtendedResponse<D = any> extends Omit<Response, 'headers'> {
  data: D extends unknown ? any : D;
  error: ResponseError<D> | null;
  headers: HeadersObject & HeadersInit;
  config: ExtendedRequestConfig<D>;
}

export type FetchResponse<T = any> = ExtendedResponse<T>;

export interface ResponseError<D = any> extends Error {
  config: ExtendedRequestConfig<D>;
  code?: string;
  status?: number;
  statusText?: string;
  request?: ExtendedRequestConfig<D>;
  response?: FetchResponse<D>;
}

export type RetryFunction = <T = any>(
  error: ResponseError<T>,
  attempts: number,
) => Promise<boolean>;

export type PollingFunction<D = any> = (
  response: FetchResponse<D>,
  attempts: number,
  error?: ResponseError<D>,
) => boolean;

export type CacheKeyFunction = (config: FetcherConfig) => string;

export type CacheBusterFunction = (config: FetcherConfig) => boolean;

export type CacheSkipFunction = <ResponseData = any>(
  data: ResponseData,
  config: RequestConfig,
) => boolean;

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
  shouldRetry?: RetryFunction;
}

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
   * Method, URL, Query Params, Dynamic Path Params, mode, credentials, cache, redirect, referrer, integrity, headers and body
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
   * Alias for base URL.
   */
  apiUrl?: string;

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
  onRequest?: RequestInterceptor<D> | RequestInterceptor<D>[];

  /**
   * A function or array of functions to intercept the response before it is resolved.
   */
  onResponse?: ResponseInterceptor<D> | ResponseInterceptor<D>[];

  /**
   * A function to handle errors that occur during the request or response processing.
   */
  onError?: ErrorInterceptor | ErrorInterceptor[];

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
  shouldStopPolling?: PollingFunction<D>;
}

interface BaseRequestHandlerConfig<RequestData = any>
  extends RequestConfig<RequestData> {
  fetcher?: FetcherInstance | null;
  logger?: any;
}

export type RequestConfig<RequestData = any> =
  ExtendedRequestConfig<RequestData>;

export type FetcherConfig = Omit<ExtendedRequestConfig, 'url'> & {
  url: string;
};

export type RequestHandlerConfig<RequestData = any> =
  BaseRequestHandlerConfig<RequestData>;

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
    config?: RequestConfig<ResponseData> | null,
  ) => Promise<ResponseData & FetchResponse<ResponseData>>;
}
