import type {
  AxiosStatic,
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosInstance,
} from 'axios';
import type { APIUriParams } from './api';

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

export interface RequestConfig extends AxiosRequestConfig, RequestInit {
  cancellable?: boolean;
  rejectCancelled?: boolean;
  defaultResponse?: unknown;
  flattenResponse?: boolean;
  strategy?: ErrorHandlingStrategy;
  onError?: ErrorHandlerFunction | ErrorHandlerClass;
  headers?: RequestConfigHeaders;
  signal?: AbortSignal;
  uriParams?: APIUriParams;
}

export interface RequestHandlerConfig extends RequestConfig {
  fetcher?: FetcherStaticInstance;
  apiUrl?: string;
  logger?: unknown;
}
