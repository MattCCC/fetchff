import type {
  AxiosStatic,
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosInstance,
} from 'axios';
import type { UrlPathParams } from './api-handler';

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

export type FetcherStaticInstance = AxiosStatic;
export type NativeFetch = typeof fetch;
export type FetcherInstance = AxiosInstance | NativeFetch;

export type RequestResponse<T = unknown> = Promise<AxiosResponse<T>>;

export type ErrorHandlingStrategy = 'reject' | 'silent' | 'defaultResponse';

export type RequestError = AxiosError<unknown>;

interface ErrorHandlerClass {
  process(error?: RequestError): unknown;
}

type ErrorHandlerFunction = (error: RequestError) => unknown;

export type RequestConfigHeaders = AxiosRequestConfig['headers'] & HeadersInit;

/**
 * Interface for configuring retry options.
 */
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
  shouldRetry?: (error: RequestError, attempt: number) => boolean;
}

export interface RequestConfig extends AxiosRequestConfig, RequestInit {
  cancellable?: boolean;
  rejectCancelled?: boolean;
  defaultResponse?: unknown;
  flattenResponse?: boolean;
  retry?: RetryOptions;
  strategy?: ErrorHandlingStrategy;
  onError?: ErrorHandlerFunction | ErrorHandlerClass;
  headers?: RequestConfigHeaders;
  signal?: AbortSignal;
  urlPathParams?: UrlPathParams;
}

export interface RequestHandlerConfig extends RequestConfig {
  fetcher?: FetcherStaticInstance;
  apiUrl?: string;
  logger?: unknown;
}
