/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BodyPayload, QueryParams, UrlPathParams } from './api-handler';
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

export type FetcherInstance = unknown | null;

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
  error: ResponseError<T>;
  headers: HeadersObject & HeadersInit;
  config: ExtendedRequestConfig;
  request?: ExtendedRequestConfig;
}

export type FetchResponse<T = any> = ExtendedResponse<T>;

export interface ResponseError<T = any> extends Error {
  code?: string;
  config: ExtendedRequestConfig;
  request?: ExtendedRequestConfig;
  response?: FetchResponse<T>;
  toJSON?: () => object;
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
  retryOn: number[];

  /**
   * A function to determine whether to retry based on the error and attempt number.
   */
  shouldRetry?: <T = any>(
    error: ResponseError<T>,
    attempt: number,
  ) => Promise<boolean>;
}

/**
 * ExtendedRequestConfig<D = any>
 *
 * This interface extends the standard `RequestInit` from the Fetch API, providing additional options
 * for handling requests, including custom error handling strategies, request interception, and more.
 */
interface ExtendedRequestConfig<D = any> extends Omit<RequestInit, 'body'> {
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
  defaultResponse?: unknown;

  /**
   * If `true`, flattens the response object, extracting the data directly instead of keeping it nested.
   */
  flattenResponse?: boolean;

  /**
   * If `true`, allows the request to be cancellable using an `AbortController`.
   */
  cancellable?: boolean;

  /**
   * If `true`, rejects the request promise when the request is cancelled.
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
   * The maximum time (in milliseconds) the request can take before automatically being aborted.
   */
  timeout?: number;

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
}

interface BaseRequestHandlerConfig extends RequestConfig {
  fetcher?: FetcherInstance;
  apiUrl?: string;
  logger?: unknown;
}

export type RequestConfig = ExtendedRequestConfig;

export type RequestHandlerConfig = BaseRequestHandlerConfig;

export type RequestsQueue = WeakMap<RequestConfig, QueueItem>;

export interface QueueItem {
  controller: AbortController;
  timeoutId?: NodeJS.Timeout;
}
