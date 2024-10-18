import { FetchError } from './fetch-error';
import type {
  DefaultParams,
  DefaultPayload,
  DefaultResponse,
  DefaultUrlParams,
  RequestConfig,
} from '../types';

export class NetworkError<
  ResponseData = DefaultResponse,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
  RequestBody = DefaultPayload,
> extends FetchError<ResponseData, QueryParams, PathParams, RequestBody> {
  constructor(
    message: string,
    request: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>,
  ) {
    super(message, request, null);

    this.name = 'NetworkError';
  }
}
