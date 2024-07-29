/* eslint-disable @typescript-eslint/no-explicit-any */
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

export type NativeFetch = typeof fetch;

export type FetcherInstance = unknown | null;

export type RequestResponse<T = unknown> = Promise<FetchResponse<T>>;

export type ErrorHandlingStrategy = 'reject' | 'silent' | 'defaultResponse';

export type RequestError = ResponseError<unknown>;

interface ErrorHandlerClass {
  process(error?: RequestError): unknown;
}

type ErrorHandlerFunction = (error: RequestError) => unknown;

export interface BaseRequestConfig<D = any> {
  url?: string;
  method?: Method | string;
  baseURL?: string;
  transformRequest?: Transformer | Transformer[];
  transformResponse?: Transformer | Transformer[];
  headers?: any;
  params?: any;
  paramsSerializer?: (params: any) => string;
  data?: D;
  timeout?: number;
  timeoutErrorMessage?: string;
  withCredentials?: boolean;
  adapter?: Adapter;
  auth?: BasicCredentials;
  responseType?: ResponseType;
  xsrfCookieName?: string;
  xsrfHeaderName?: string;
  onUploadProgress?: (progressEvent: any) => void;
  onDownloadProgress?: (progressEvent: any) => void;
  maxContentLength?: number;
  validateStatus?: ((status: number) => boolean) | null;
  maxBodyLength?: number;
  maxRedirects?: number;
  socketPath?: string | null;
  httpAgent?: any;
  httpsAgent?: any;
  proxy?: ProxyConfig | false;
  cancelToken?: CancelToken;
  decompress?: boolean;
  transitional?: TransitionalOptions;
  signal?: AbortSignal;
  insecureHTTPParser?: boolean;
}

export interface ExtendedResponse<T = any, D = any> extends Response {
  data: T;
  config: BaseRequestConfig<D>;
}

export type FetchResponse<T = any, D = any> = BaseFetchResponse<T, D> &
  ExtendedResponse<T, D>;

export interface BaseFetchResponse<T = any, D = any> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
  config: BaseRequestConfig<D>;
  request?: any;
}

export interface ResponseError<T = any, D = any> extends Error {
  config: BaseRequestConfig<D>;
  code?: string;
  request?: any;
  response?: FetchResponse<T, D>;
  isAxiosError: boolean;
  toJSON: () => object;
}

export interface Transformer {
  (data: any, headers?: any): any;
}

export interface Adapter {
  (config: BaseRequestConfig): ReturnedPromise;
}

export interface BasicCredentials {
  username: string;
  password: string;
}

export type ResponseType =
  | 'arraybuffer'
  | 'blob'
  | 'document'
  | 'json'
  | 'text'
  | 'stream';

export interface ProxyConfig {
  host: string;
  port: number;
  protocol?: string;
  auth?: {
    username: string;
    password: string;
  };
}

export interface CancelToken {
  promise: Promise<Cancel>;
  reason?: Cancel;
  throwIfRequested(): void;
}

export interface Cancel {
  message: string;
}

export interface TransitionalOptions {
  silentJSONParsing?: boolean;
  forcedJSONParsing?: boolean;
  clarifyTimeoutError?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ReturnedPromise<T = any> extends Promise<FetchResponse<T>> {}

export type RequestConfigHeaders = Record<string, string | number | boolean> &
  HeadersInit;

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
  shouldRetry?: (error: RequestError, attempt: number) => Promise<boolean>;
}

interface ExtendedRequestConfig extends BaseRequestConfig, RequestInit {
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

export interface BaseRequestHandlerConfig extends RequestConfig {
  fetcher?: FetcherInstance;
  apiUrl?: string;
  logger?: unknown;
}

export type RequestConfig<CustomConfig = object> = ExtendedRequestConfig &
  CustomConfig;

export type RequestHandlerConfig<CustomConfig = object> = BaseHandlerConfig &
  CustomConfig;
