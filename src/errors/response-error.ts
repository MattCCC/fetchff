import { FetchError } from './fetch-error';
import type {
  DefaultParams,
  DefaultPayload,
  DefaultResponse,
  DefaultUrlParams,
  FetchResponse,
  RequestConfig,
} from '../types';

export class ResponseError<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> extends FetchError<ResponseData, RequestBody, QueryParams, PathParams> {
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
    super(message, request, response);

    this.name = 'ResponseError';
  }
}
