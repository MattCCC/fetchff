/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  DefaultParams,
  DefaultPayload,
  DefaultUrlParams,
} from './api-handler';
import type {
  DefaultResponse,
  FetchResponse,
  RequestConfig,
  ResponseError,
} from './request-handler';

export type InterceptorFunction<T, Args extends any[] = any[]> = (
  object: T,
  ...args: Args
) => Promise<T>;

export type RequestInterceptor<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> = (
  config: RequestConfig<ResponseData, RequestBody, QueryParams, PathParams>,
) =>
  | RequestConfig<ResponseData, RequestBody, QueryParams, PathParams>
  | void
  | Promise<RequestConfig<ResponseData, RequestBody, QueryParams, PathParams>>
  | Promise<void>;

export type ResponseInterceptor<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> = (
  response: FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>,
) =>
  | FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>
  | Promise<FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>>
  | void
  | Promise<void>;

export type ErrorInterceptor<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> = (
  error: ResponseError<ResponseData, RequestBody, QueryParams, PathParams>,
) => void | Promise<void>;

export type RetryInterceptor<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> = (
  response: FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>,
  retryAttempt: number,
) => void | Promise<void>;
