/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  FetchResponse,
  RequestHandlerConfig,
  ResponseError,
} from './request-handler';

export type RequestInterceptor<D = any> = (
  config: RequestHandlerConfig<D>,
) =>
  | RequestHandlerConfig<D>
  | void
  | Promise<RequestHandlerConfig<D>>
  | Promise<void>;

export type ResponseInterceptor<D = any> = (
  response: FetchResponse<D>,
) => FetchResponse<D> | void | Promise<FetchResponse<D>> | Promise<void>;

export type ErrorInterceptor = (error: ResponseError) => unknown;
