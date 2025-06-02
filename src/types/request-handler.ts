/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  BodyPayload,
  DefaultParams,
  DefaultPayload,
  DefaultUrlParams,
  QueryParams,
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

export type DefaultResponse = any;

export type NativeFetch = typeof fetch;

export interface FetcherInstance {
  create: <RequestInstance = CreatedCustomFetcherInstance>(
    config?: RequestHandlerConfig,
  ) => RequestInstance;
}

export interface CreatedCustomFetcherInstance {
  request<
    ResponseData = DefaultResponse,
    QueryParams = DefaultParams,
    PathParams = DefaultUrlParams,
    RequestBody = DefaultPayload,
  >(
    requestConfig: RequestConfig<
      ResponseData,
      QueryParams,
      PathParams,
      RequestBody
    >,
  ): PromiseLike<FetchResponse<ResponseData>>;
}

export type ErrorHandlingStrategy =
  | 'reject'
  | 'silent'
  | 'defaultResponse'
  | 'softFail';

export interface HeadersObject {
  [key: string]: string;
}

export interface ExtendedResponse<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> extends Omit<Response, 'headers'> {
  data: ResponseData extends [unknown] ? any : ResponseData;
  error: ResponseError<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  > | null;
  headers: HeadersObject & HeadersInit;
  config: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>;
}

/**
 * Represents the response from a `fetchf()` request.
 *
 * @template ResponseData - The type of the data returned in the response.
 */
export type FetchResponse<
  ResponseData = any,
  RequestBody = any,
  QueryParams = any,
  PathParams = any,
> = ExtendedResponse<ResponseData, RequestBody, QueryParams, PathParams>;

export interface ResponseError<
  ResponseData = DefaultResponse,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
  RequestBody = DefaultPayload,
> extends Error {
  status: number;
  statusText: string;
  request: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>;
  config: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>;
  response: FetchResponse<ResponseData, RequestBody> | null;
}

export type RetryFunction<
  ResponseData = DefaultResponse,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
  RequestBody = DefaultPayload,
> = (
  response: ExtendedResponse<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  >,
  attempt: number,
) => Promise<boolean> | boolean;

export type PollingFunction<
  ResponseData = DefaultResponse,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
  RequestBody = DefaultPayload,
> = (
  response: FetchResponse<ResponseData, RequestBody>,
  attempts: number,
  error?: ResponseError<ResponseData, QueryParams, PathParams, RequestBody>,
) => boolean;

export type CacheKeyFunction = (config: FetcherConfig) => string;

export type CacheBusterFunction = (config: FetcherConfig) => boolean;

export type CacheSkipFunction = <ResponseData = any, RequestBody = any>(
  data: ResponseData,
  config: RequestConfig<ResponseData, any, any, RequestBody>,
) => boolean;

/**
 * Configuration object for retry related options
 */
export interface RetryOptions<
  ResponseData,
  QueryParams,
  PathParams,
  RequestBody,
> {
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
  shouldRetry?: RetryFunction<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  >;
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
 * ExtendedRequestConfig<ResponseData = any, RequestBody = any>
 *
 * This interface extends the standard `RequestInit` from the Fetch API, providing additional options
 * for handling requests, including custom error handling strategies, request interception, and more.
 */
export interface ExtendedRequestConfig<
  ResponseData = any,
  QueryParams_ = any,
  PathParams = any,
  RequestBody = any,
> extends Omit<RequestInit, 'body'>,
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
  urlPathParams?: UrlPathParams<PathParams>;

  /**
   * Configuration options for retrying failed requests.
   */
  retry?: RetryOptions<ResponseData, QueryParams_, PathParams, RequestBody>;

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
  params?: QueryParams<QueryParams_>;

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
  body?: BodyPayload<RequestBody>;

  /**
   * Alias for "body"
   */
  data?: BodyPayload<RequestBody>;

  /**
   * A function or array of functions to intercept the request before it is sent.
   */
  onRequest?:
    | RequestInterceptor<RequestBody, ResponseData>
    | RequestInterceptor<RequestBody, ResponseData>[];

  /**
   * A function or array of functions to intercept the response before it is resolved.
   */
  onResponse?:
    | ResponseInterceptor<ResponseData>
    | ResponseInterceptor<ResponseData>[];

  /**
   * A function to handle errors that occur during the request or response processing.
   */
  onError?:
    | ErrorInterceptor<ResponseData, QueryParams_, PathParams, RequestBody>
    | ErrorInterceptor<ResponseData, QueryParams_, PathParams, RequestBody>[];

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
   * The time (in milliseconds) between the end of one polling attempt and the start of the next.
   * Set 0 to disable polling.
   * @default 0 (polling disabled)
   */
  pollingInterval?: number;

  /**
   * The time (in milliseconds) to wait before each polling attempt begins. Adds a delay before each poll is started (including the first one).
   * @default 0 (no delay)
   */
  pollingDelay?: number;

  /**
   * Maximum number of polling attempts before stopping.
   * Set to < 1 for unlimited attempts.
   * @default 0 (unlimited)
   */
  maxPollingAttempts?: number;

  /**
   * Function to determine if polling should stop based on the response.
   * @param response - The response data.
   * @returns `true` to stop polling, `false` to continue.
   */
  shouldStopPolling?: PollingFunction<
    ResponseData,
    QueryParams_,
    PathParams,
    RequestBody
  >;

  /**
   * A custom fetcher instance to handle requests instead of the default implementation.
   * When `null`, the default fetch behavior is used.
   *
   * @example:
   * const customFetcher: FetcherInstance = { create: () => ({ request: (config) => fetch(config.url) }) };
   * fetchf('/endpoint', { fetcher: customFetcher });
   *
   * @default null
   */
  fetcher?: FetcherInstance | null;

  /**
   * A custom logger instance to handle warnings and errors.
   * When `null`, logging is disabled.
   *
   * @example:
   * const customLogger: Logger = { warn: console.warn, error: console.error };
   * fetchf('/endpoint', { logger: customLogger });
   *
   * @default null (Logging is disabled)
   */
  logger?: Logger | null;
}

export interface Logger {
  warn(message?: any, ...optionalParams: any[]): void;
  error?(message?: any, ...optionalParams: any[]): void;
}

export type RequestHandlerConfig<
  ResponseData = any,
  RequestBody = any,
> = RequestConfig<ResponseData, any, any, RequestBody>;

export type RequestConfig<
  ResponseData = any,
  QueryParams = any,
  PathParams = any,
  RequestBody = any,
> = ExtendedRequestConfig<ResponseData, QueryParams, PathParams, RequestBody>;

export type FetcherConfig<
  ResponseData = any,
  QueryParams = any,
  PathParams = any,
  RequestBody = any,
> = Omit<
  ExtendedRequestConfig<ResponseData, QueryParams, PathParams, RequestBody>,
  'url'
> & {
  url: string;
};

export interface RequestHandlerReturnType {
  config: RequestHandlerConfig;
  getInstance: () => CreatedCustomFetcherInstance | null;
  request: <
    ResponseData = DefaultResponse,
    QueryParams = DefaultParams,
    PathParams = DefaultUrlParams,
    RequestBody = DefaultPayload,
  >(
    url: string,
    config?: RequestConfig<
      ResponseData,
      QueryParams,
      PathParams,
      RequestBody
    > | null,
    shouldMerge?: boolean,
  ) => Promise<FetchResponse<ResponseData, RequestBody>>;
}
