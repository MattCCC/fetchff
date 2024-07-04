import { EndpointConfig } from './http-request';

export declare type APIQueryParams = Record<string, unknown>;
export declare type APIUrlParams = Record<string, unknown>;
export declare type APIRequestConfig = EndpointConfig;
export declare type APIResponse = unknown;

export declare type Endpoint<
  Response = APIResponse,
  QueryParamsOrData = APIQueryParams,
  DynamicUrlParams = APIUrlParams,
> = <
  ResponseData = Response,
  QueryParams = QueryParamsOrData,
  UrlParams = DynamicUrlParams,
>(
  queryParams?: QueryParams | null,
  urlParams?: UrlParams,
  requestConfig?: EndpointConfig,
) => Promise<ResponseData>;

export interface Endpoints {
  [x: string]: Endpoint;
}
