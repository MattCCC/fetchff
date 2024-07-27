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

export type EndpointsConfig<T extends string | number | symbol> = {
  [K in T]: EndpointConfig;
};

export type EndpointConfigHeaders = AxiosRequestConfig['headers'] & HeadersInit;

export interface EndpointConfig extends AxiosRequestConfig, RequestInit {
  cancellable?: boolean;
  rejectCancelled?: boolean;
  strategy?: ErrorHandlingStrategy;
  onError?: ErrorHandlerFunction | ErrorHandlerClass;
  headers?: EndpointConfigHeaders;
  signal?: AbortSignal;
  uriParams?: APIUriParams;
}

export interface RequestHandlerConfig extends EndpointConfig {
  fetcher?: FetcherStaticInstance;
  flattenResponse?: boolean;
  defaultResponse?: unknown;
  apiUrl?: string;
  logger?: unknown;
  onError?: ErrorHandlerFunction | ErrorHandlerClass;
}

export interface APIHandlerConfig<EndpointsList = { [x: string]: unknown }>
  extends RequestHandlerConfig {
  apiUrl: string;
  endpoints: EndpointsConfig<keyof EndpointsList>;
}
