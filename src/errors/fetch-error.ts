import type {
  DefaultParams,
  DefaultPayload,
  DefaultResponse,
  DefaultUrlParams,
  FetchResponse,
  RequestConfig,
} from '../types';

/**
 * This is a base error class
 */
export class FetchError<
  ResponseData = DefaultResponse,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
  RequestBody = DefaultPayload,
> extends Error {
  status: number;
  statusText: string;
  request: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>;
  config: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>;
  response: FetchResponse<ResponseData, RequestBody> | null;

  constructor(
    message: string,
    request: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>,
    response: FetchResponse<ResponseData, RequestBody> | null,
  ) {
    super(message);

    this.name = 'FetchError';

    this.message = message;
    this.status = response?.status || 0;
    this.statusText = response?.statusText || '';
    this.request = request;
    this.config = request;
    this.response = response;
  }
}
