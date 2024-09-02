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

export interface BaseRequestConfig<D = any> {
  url?: string;
  method?: Method | string;
  baseURL?: string;
  headers?: HeadersInit;
  params?: QueryParams;
  data?: BodyPayload<D>;
  timeout?: number;
  withCredentials?: boolean;
  signal?: AbortSignal;
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

interface ExtendedRequestConfig extends BaseRequestConfig, RequestInit {
  strategy?: ErrorHandlingStrategy;
  defaultResponse?: unknown;
  flattenResponse?: boolean;
  cancellable?: boolean;
  rejectCancelled?: boolean;
  headers?: HeadersInit;
  urlPathParams?: UrlPathParams;
  retry?: RetryOptions;
  body?: BaseRequestConfig['data'];
  onRequest?: RequestInterceptor | RequestInterceptor[];
  onResponse?: ResponseInterceptor | ResponseInterceptor[];
  onError?: ErrorHandlerInterceptor;
}

interface BaseRequestHandlerConfig extends RequestConfig {
  fetcher?: FetcherInstance;
  apiUrl?: string;
  logger?: unknown;
}

export type RequestConfig<CustomConfig = object> = ExtendedRequestConfig &
  CustomConfig;

export type RequestHandlerConfig<CustomConfig = object> =
  BaseRequestHandlerConfig & CustomConfig;
