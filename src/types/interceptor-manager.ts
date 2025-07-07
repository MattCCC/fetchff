/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  DefaultParams,
  DefaultPayload,
  DefaultUrlParams,
} from './api-handler';
import type {
  DefaultResponse,
  FetchResponse,
  RequestHandlerConfig,
  ResponseError,
} from './request-handler';

export type InterceptorFunction<T, Args extends any[] = any[]> = (
  object: T,
  ...args: Args
) => Promise<T>;

export type RequestInterceptor<RequestBody = any, ResponseData = any> = (
  config: RequestHandlerConfig<ResponseData, RequestBody>,
) =>
  | RequestHandlerConfig<ResponseData, RequestBody>
  | void
  | Promise<RequestHandlerConfig<ResponseData, RequestBody>>
  | Promise<void>;

export type ResponseInterceptor<ResponseData = any> = (
  response: FetchResponse<ResponseData>,
) =>
  | FetchResponse<ResponseData>
  | Promise<FetchResponse<ResponseData>>
  | void
  | Promise<void>;

export type ErrorInterceptor<
  ResponseData = DefaultResponse,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
  RequestBody = DefaultPayload,
> = (
  error: ResponseError<ResponseData, QueryParams, PathParams, RequestBody>,
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
