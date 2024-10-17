import type {
  DefaultParams,
  DefaultPayload,
  DefaultResponse,
  DefaultUrlParams,
  FetchResponse,
  RequestConfig,
} from './types';

export class ResponseError<
  ResponseData = DefaultResponse,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
  RequestBody = DefaultPayload,
> extends Error {
  status: number;
  statusText: string;
  request: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>;
  config: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>;
  response: FetchResponse<ResponseData, RequestBody>;

  constructor(
    message: string,
    requestInfo: RequestConfig<
      ResponseData,
      QueryParams,
      PathParams,
      RequestBody
    >,
    response: FetchResponse<ResponseData, RequestBody>,
  ) {
    super(message);

    this.name = 'ResponseError';
    this.message = message;
    this.status = response.status;
    this.statusText = response.statusText;
    this.request = requestInfo;
    this.config = requestInfo;
    this.response = response;
  }
}
