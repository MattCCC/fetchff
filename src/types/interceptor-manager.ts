import type {
  BaseRequestHandlerConfig,
  FetchResponse,
  RequestResponse,
} from './request-handler';

export type RequestInterceptor = (
  config: BaseRequestHandlerConfig,
) => BaseRequestHandlerConfig | Promise<BaseRequestHandlerConfig>;

export type ResponseInterceptor = <ResponseData = unknown>(
  response: FetchResponse<ResponseData>,
) => RequestResponse<ResponseData>;
