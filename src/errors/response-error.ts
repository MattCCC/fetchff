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
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
  RequestBody = DefaultPayload,
> extends FetchError<ResponseData, QueryParams, PathParams, RequestBody> {
  constructor(
    message: string,
    request: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>,
    response: FetchResponse<ResponseData, RequestBody> | null,
  ) {
    super(message, request, response);

    this.name = 'ResponseError';
  }
}
