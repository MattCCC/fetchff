import type { FetchResponse, RequestHandlerConfig } from './request-handler';

export type RequestInterceptor = (
  config: RequestHandlerConfig,
) => RequestHandlerConfig | Promise<RequestHandlerConfig>;

export type ResponseInterceptor = <ResponseData = unknown>(
  response: FetchResponse<ResponseData>,
) => Promise<FetchResponse<ResponseData>>;
