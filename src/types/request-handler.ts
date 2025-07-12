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
  RetryInterceptor,
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

export type CustomFetcher = <
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
>(
  url: string,
  config?: RequestConfig<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  > | null,
) =>
  | PromiseLike<
      FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>
    >
  | FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>
  | Response
  | PromiseLike<Response>
  | PromiseLike<unknown>;

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
  /**
   * Return response data as parsed JSON (default) or the raw response body.
   */
  data: ResponseData extends [unknown] ? any : ResponseData;

  /**
   * Error object if the request failed.
   * This will be `null` if the request was successful.
   */
  error: ResponseError<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  > | null;
  /**
   * Plain headers object containing the response headers.
   */
  headers: HeadersObject & HeadersInit;

  /**
   * Request configuration used to make the request.
   */
  config: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>;

  /**
   * Function to mutate the cached data.
   * It updates the cache with new data and optionally triggers revalidation.
   *
   * @param {ResponseData} data - The new data to set in the cache.
   * @param {MutationSettings} [mutationSettings] - Optional settings for the mutation.
   *   - `revalidate`: If true, it will trigger a revalidation after mutating the cache.
   * @returns {Promise<FetchResponse<ResponseData, RequestBody, QueryParams, PathParams> | null>} The updated response or null if no cache key is set.
   */
  mutate: (
    data: FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    >['data'],
    mutationSettings?: MutationSettings,
  ) => Promise<FetchResponse<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  > | null>;

  /**
   * Indicates whether the request is currently being fetched.
   */
  isFetching: boolean;
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
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> extends Error {
  status: number;
  statusText: string;
  isCancelled: boolean;
  request: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>;
  config: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>;
  response: FetchResponse<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  > | null;
}

export type RetryFunction<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> = (
  response: FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>,
  attempt: number,
) => Promise<boolean | null> | boolean | null;

export type PollingFunction<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> = (
  response: FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>,
  attempts: number,
) => boolean;

export type CacheKeyFunction<
  _ResponseData = DefaultResponse,
  _RequestBody = DefaultPayload,
  _QueryParams = DefaultParams,
  _PathParams = DefaultUrlParams,
> = <
  ResponseData = _ResponseData,
  RequestBody = _RequestBody,
  QueryParams = _QueryParams,
  PathParams = _PathParams,
>(
  config: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>,
) => string;

export type CacheBusterFunction<
  _ResponseData = DefaultResponse,
  _RequestBody = DefaultPayload,
  _QueryParams = DefaultParams,
  _PathParams = DefaultUrlParams,
> = <
  ResponseData = _ResponseData,
  RequestBody = _RequestBody,
  QueryParams = _QueryParams,
  PathParams = _PathParams,
>(
  config: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>,
) => boolean;

export type CacheSkipFunction<
  _ResponseData = DefaultResponse,
  _RequestBody = DefaultPayload,
  _QueryParams = DefaultParams,
  _PathParams = DefaultUrlParams,
> = <
  ResponseData = _ResponseData,
  RequestBody = _RequestBody,
  QueryParams = _QueryParams,
  PathParams = _PathParams,
>(
  response: FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>,
  config: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>,
) => boolean;

export interface MutationSettings {
  refetch?: boolean;
}

/**
 * Configuration object for retry related options
 */
export interface RetryConfig<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
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
   * A function that determines whether a failed or successful request should be retried, based on the response and the current attempt number.
   * Return `true` to retry, or `false` to stop retrying.
   * @param response - The response object from the failed request.
   * @param attempt - The current retry attempt number (starting from 1).
   * @returns `true` to retry, `false` to stop retrying, `null` to use default retry logic (retryOn headers check).
   */
  shouldRetry?: RetryFunction<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  >;
}

/**
 * Configuration object for cache related options
 */
export interface CacheOptions<
  ResponseData = DefaultResponse,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
  RequestBody = DefaultPayload,
> {
  /**
   * Time in seconds after which the cache entry is removed.
   * This is the time to live (TTL) for the cache entry.
   * - Set to `-1` to remove cache as soon as consumer is not using the data (e.g., a component unmounts), it is deleted from cache.
   * - Set to `0` to immediately discard of cache. The cache is immediately discarded, forces fetch every time.
   * - Set to `undefined` to disable cache (no cache).
   *
   * @default undefined (no cache)
   */
  cacheTime?: number;

  /**
   * Time in seconds for which the cache entry is considered valid (fresh).
   * After this time, the entry may be considered stale (expired) and background revalidation is triggered.
   * This is implementing the SWR (stale-while-revalidate) pattern.
   * - Set to a number greater than `0` to specify number of seconds during which cached data is considered "fresh".
   * - Set to `0` to set data as stale immediately (always eligible to refetch).
   * - Set to `undefined` to disable SWR pattern (data is never considered stale).
   *
   * @default undefined (disable SWR pattern) or 300 (5 minutes) in libraries like React.
   */
  staleTime?: number;

  /**
   * Cache key generator function or string.
   * Lets you customize how cache entries are identified for requests.
   * - You can provide a function that returns a cache key string based on the request config.
   * - You can provide a fixed string to use as the cache key.
   * - Set to null to use the default cache key generator.
   *
   * @param config - The request configuration.
   * @default null (uses the default cache key generator, which considers: method, URL, query params, path params, mode, credentials, cache, redirect, referrer, integrity, headers, and body)
   */
  cacheKey?:
    | CacheKeyFunction<ResponseData, RequestBody, QueryParams, PathParams>
    | string
    | null;

  /**
   * Cache Buster Function
   * It is called when a cache entry exists and you want to invalidate or refresh the cache under certain conditions
   * @param config - Request configuration.
   * @default (config)=>false Busting cache is disabled by default. Return true to change that
   */
  cacheBuster?: CacheBusterFunction<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  >;

  /**
   * Skip Cache Function
   * Determines whether to set or skip setting caching for a request based on the response.
   * @param response - Parsed Response.
   * @param config - Request configuration.
   * @default (response,config)=>false Bypassing cache is disabled by default. Return true to skip cache
   */
  skipCache?: CacheSkipFunction<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  >;

  /**
   * If true, error responses (non-2xx) will also be cached.
   * @default false
   */
  cacheErrors?: boolean;

  /**
   * INTERNAL, DO NOT USE.
   * This is used internally to mark requests that are automatically generated cache keys.
   */
  _isAutoKey?: boolean;

  /**
   * INTERNAL, DO NOT USE.
   * This is used internally to store the previous cache key.
   */
  _prevKey?: string | null;
}

/**
 * ExtendedRequestConfig<ResponseData, RequestBody, QueryParams, PathParams>
 *
 * This interface extends the standard `RequestInit` from the Fetch API, providing additional options
 * for handling requests, including custom error handling strategies, request interception, and more.
 */
export interface ExtendedRequestConfig<
  ResponseData = any,
  RequestBody = any,
  QueryParams_ = any,
  PathParams = any,
> extends Omit<RequestInit, 'body'>,
    CacheOptions {
  /**
   * Custom error handling strategy for the request.
   * - `'reject'`: Rejects the promise with an error (default).
   * - `'silent'`: Silently handles errors without rejecting.
   * - `'defaultResponse'`: Returns a default response in case of an error.
   * - `'softFail'`: Returns a partial response with error details.
   */
  strategy?: ErrorHandlingStrategy;

  /**
   * A default response to return if the request fails
   * @default undefined
   */
  defaultResponse?: any;

  /**
   * If `true`, flattens the response object, extracting the data directly instead of keeping it nested.
   */
  flattenResponse?: boolean;

  /**
   * Function to transform or select a subset of the response data before it is returned.
   * This is called with the raw response data and should return the transformed data.
   * @param data - The raw response data.
   * @returns The transformed or selected data.
   */
  select?: <T = ResponseData, R = any>(data: T) => R;

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
   * If true, automatically revalidates the request when the window regains focus.
   * @default false
   */
  refetchOnFocus?: boolean;

  /**
   * If true, automatically revalidates the request when the browser regains network connectivity.
   * @default false
   */
  refetchOnReconnect?: boolean;

  /**
   * Whether to automatically run the request as soon as the handler is created.
   * - If `true`, the request is sent immediately (useful for React/Vue hooks).
   * - If `false`, you must call a function to trigger the request manually.
   * Primarily used in UI frameworks (e.g., React/Vue hooks); has no effect for direct fetchf() usage.
   * @default true
   */
  immediate?: boolean;

  /**
   * If true, keeps the previous data while fetching new data.
   * Useful for UI frameworks to avoid showing empty/loading states between requests.
   * Primarily used in UI frameworks (e.g., React/Vue hooks); has no effect for direct fetchf() usage.
   * @default false
   */
  keepPreviousData?: boolean;

  /**
   * An object representing dynamic URL path parameters.
   * For example, `{ userId: 1 }` would replace `:userId` in the URL with `1`.
   */
  urlPathParams?: UrlPathParams<PathParams>;

  /**
   * Configuration options for retrying failed requests.
   */
  retry?: RetryConfig<ResponseData, RequestBody, QueryParams_, PathParams>;

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
    | RequestInterceptor<ResponseData, RequestBody, QueryParams_, PathParams>
    | RequestInterceptor<ResponseData, RequestBody, QueryParams_, PathParams>[];

  /**
   * A function or array of functions to intercept the response before it is resolved.
   */
  onResponse?:
    | ResponseInterceptor<ResponseData, RequestBody, QueryParams_, PathParams>
    | ResponseInterceptor<
        ResponseData,
        RequestBody,
        QueryParams_,
        PathParams
      >[];

  /**
   * A function to handle errors that occur during the request or response processing.
   */
  onError?:
    | ErrorInterceptor<ResponseData, RequestBody, QueryParams_, PathParams>
    | ErrorInterceptor<ResponseData, RequestBody, QueryParams_, PathParams>[];

  /**
   * A function that is called after each failed request attempt, before the retry delay.
   * Can be used for logging, side effects, or modifying the response/config before retrying.
   * @param response - The response object from the failed request.
   * @param attempt - The current retry attempt number (starting from 0).
   */
  onRetry?:
    | RetryInterceptor<ResponseData, RequestBody, QueryParams_, PathParams>
    | RetryInterceptor<ResponseData, RequestBody, QueryParams_, PathParams>[];

  /**
   * The maximum time (in milliseconds) the request can take before automatically being aborted. 0 seconds disables the timeout.
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Time window, in miliseconds, during which identical requests are deduplicated (treated as single request).
   * @default 0 (0 milliseconds means no deduplication)
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
    RequestBody,
    QueryParams_,
    PathParams
  >;

  /**
   * A custom fetcher instance to handle requests instead of the default implementation.
   * When `null`, the default fetch behavior is used.
   *
   * @example:
   * const customFetcher: CustomFetcher = (url, config) => fetch(url, config);
   * const data = await fetchf('/endpoint', { fetcher: customFetcher });
   *
   * @default null
   */
  fetcher?: CustomFetcher | null;

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
  logger?: FetcherLogger | null;

  // ==============================================================================
  // Properties for compatibility with React Query, SWR and other popular libraries
  // They are marked as deprecated so to ease migration to the new API of fetchff.
  // ==============================================================================

  /**
   * @deprecated Use the "immediate" property instead for controlling request execution.
   * This property is provided for compatibility with React Query.
   */
  enabled?: boolean;

  /**
   * @deprecated Use the "refetchOnFocus" property instead for controlling refetch on window focus.
   * This property is provided for compatibility with React Query.
   */
  refetchOnWindowFocus?: boolean;

  /**
   * @deprecated Use "onSuccess" instead for transforming response data.
   * This property is provided for compatibility with React Query.
   */
  onSuccess?: any;

  /**
   * @deprecated Use "onResponse" or "onError" instead for handling settled requests.
   * This property is provided for compatibility with React Query.
   */
  onSettled?: any;

  /**
   * @deprecated Use the "strategy: 'reject'" property instead for enabling Suspense mode.
   * If true, enables Suspense mode for UI frameworks like React.
   * Suspense mode will throw a promise while loading, allowing components to suspend rendering.
   * This property is provided for compatibility with React Query.
   * @default false
   */
  suspense?: boolean;

  /**
   * @deprecated Use "immediate" instead for controlling request execution on component mount.
   * If true, automatically retries the request when the handler/component mounts.
   * This property is provided for compatibility with React Query.
   * @default false
   */
  retryOnMount?: boolean;

  /**
   * @deprecated Use the "pollingInterval" property instead for controlling periodic refetching.
   * This property is provided for compatibility with React Query.
   */
  refetchInterval?: number;

  /**
   * @deprecated Use "defaultResponse" instead.
   * If set, provides fallback data to use when the request fails or is loading.
   * This property is provided for compatibility with React Query.
   */
  fallbackData?: any;

  // refetchIntervalInBackground?: boolean;
  // initialData?: unknown;
  // isPaused?: boolean;
  // onLoading?: (data: any) => void;
  // broadcastChannel?: string;
  // revalidateOnBlur?: boolean;
  // revalidateOnVisibilityChange?: boolean;
  // isLoadingSlow

  // SWR:

  /**
   * @deprecated Use "dedupeTime" instead for controlling request deduplication.
   * If set, requests made within this interval (in milliseconds) will be deduplicated.
   * This property is provided for compatibility with SWR.
   */
  dedupingInterval?: number;

  /**
   * @deprecated Use "pollingInterval" instead for periodic refresh of the request.
   * If set, enables periodic refresh of the request at the specified interval (in milliseconds).
   * Useful for polling or auto-refresh scenarios.
   * This property is provided for compatibility with SWR.
   */
  refreshInterval?: number;

  /**
   * @deprecated Use "pollingInterval" instead for enabling periodic refresh.
   * If true, enables periodic refresh of the request.
   * This property is provided for compatibility with SWR.
   */
  refreshIntervalEnabled?: boolean;

  /**
   * @deprecated Use the "refetchOnReconnect" property instead for controlling refetch on reconnect.
   * This property is provided for compatibility with SWR.
   */
  revalidateOnReconnect?: boolean;

  /**
   * @deprecated Use the "refetchOnFocus" property instead for controlling refetch on window focus.
   * This property is provided for compatibility with with SWR.
   */
  revalidateOnFocus?: boolean;

  /**
   * @deprecated Use the "fetcher" property instead for providing a custom fetch function.
   * This property is provided for compatibility with React Query.
   */
  queryFn?: CustomFetcher | null;

  /**
   * @deprecated Use the "cacheKey" property instead for customizing cache identification.
   * This property is provided for compatibility with React Query and SWR.
   */
  queryKey?: string | null;

  // pollingWhenHidden?: boolean;
  // loadingTimeout?: number;
  // refreshWhenHidden?: boolean;
}

export interface FetcherLogger extends Partial<Console> {
  warn(message?: any, ...optionalParams: any[]): void;
  error?(message?: any, ...optionalParams: any[]): void;
}

export type RequestConfig<
  ResponseData = any,
  QueryParams = any,
  PathParams = any,
  RequestBody = any,
> = ExtendedRequestConfig<ResponseData, RequestBody, QueryParams, PathParams>;

export type FetcherConfig<
  ResponseData = any,
  RequestBody = any,
  QueryParams = any,
  PathParams = any,
> = Omit<
  ExtendedRequestConfig<ResponseData, RequestBody, QueryParams, PathParams>,
  'url'
> & {
  url: string;
  cacheKey?: string | null;
};

export type RequestHandlerReturnType = <
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
) => Promise<FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>>;
