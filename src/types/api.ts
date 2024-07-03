import { EndpointConfig } from './http-request';

export declare type APIQueryParams = Record<string, any>;
export declare type APIUrlParams = Record<string, any>;
export declare type APIRequestConfig = EndpointConfig;
export declare type APIResponse = any;

export declare type Endpoint<
  T = APIQueryParams,
  T2 = APIUrlParams,
  T3 = APIResponse
> = <T4 = T, T5 = T2, T6 = T3>(
  queryParams?: T4 | null,
  urlParams?: T5,
  requestConfig?: EndpointConfig
) => Promise<T6>;

export interface Endpoints {
  [x: string]: Endpoint;
}
