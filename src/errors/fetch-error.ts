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
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> extends Error {
  status: number;
  statusText: string;
  config: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>;
  isCancelled: boolean;

  constructor(
    message: string,
    public request: RequestConfig<
      ResponseData,
      QueryParams,
      PathParams,
      RequestBody
    >,
    public response: FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    > | null,
  ) {
    super(message);

    this.name = 'FetchError';
    this.status = response ? response.status : 0;
    this.statusText = response ? response.statusText : '';
    this.config = request;
    this.isCancelled = false;
  }
}
