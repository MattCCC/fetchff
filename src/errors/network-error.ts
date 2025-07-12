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
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
> extends FetchError<ResponseData, RequestBody, QueryParams, PathParams> {
  constructor(
    message: string,
    request: RequestConfig<ResponseData, QueryParams, PathParams, RequestBody>,
  ) {
    super(message, request, null);

    this.name = 'NetworkError';
  }
}
