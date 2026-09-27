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
  // Declared only, and set in the constructor, as class fields would need a helper in the ES2018 bundle
  declare status: number;
  declare statusText: string;
  declare config: RequestConfig<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  >;
  declare isCancelled: boolean;
  declare request: RequestConfig<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  >;
  declare response: FetchResponse<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  > | null;

  constructor(
    message: string,
    request: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>,
    response: FetchResponse<
      ResponseData,
      RequestBody,
      QueryParams,
      PathParams
    > | null,
  ) {
    super(message);

    this.request = request;
    this.response = response;
    this.status = response ? response.status : 0;
    this.statusText = response ? response.statusText : '';
    this.config = request;
    this.isCancelled = false;
    this.name = 'FetchError';
  }
}
