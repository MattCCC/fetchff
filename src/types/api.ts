import type { RequestHandler } from '../request-handler';
import type {
  RequestConfig,
  FetcherInstance,
  RequestHandlerConfig,
  RequestResponse,
} from './request-handler';

// Utility type to check if a type is never
type IsNever<T> = [T] extends [never] ? true : false;

// Utility type to check if a type has keys
type HasKeys<T> = keyof T extends never ? false : true;

// Conditional Omit utility type
type ConditionalOmit<T, U> = HasKeys<U> extends true ? Omit<T, keyof U> : T;

// Common type definitions
export declare type APIQueryParams = Record<string, unknown>;
export declare type APIPayload = Record<string, unknown>;
export declare type QueryParamsOrBody = APIQueryParams | APIPayload;
export declare type APIUrlParams = Record<string, unknown>;
export declare type APIUriParams = Record<string, string | number>;
export declare type APIResponse = unknown;

// Endpoint function type
export declare type Endpoint<
  Response = APIResponse,
  QueryParams = QueryParamsOrBody,
  UrlParams = APIUrlParams,
> =
  | {
      (
        queryParams?: QueryParams | null,
        urlParams?: UrlParams,
        requestConfig?: RequestConfig,
      ): Promise<Response>;
    }
  | {
      <ResponseData = Response, T = QueryParams, T2 = UrlParams>(
        queryParams?: T | null,
        urlParams?: T2,
        requestConfig?: RequestConfig,
      ): Promise<ResponseData>;
    };

export type EndpointsRecord<EndpointsMethods> = {
  [K in keyof EndpointsMethods]: EndpointsMethods[K] extends Endpoint<
    infer Response,
    infer QueryParams,
    infer UrlParams
  >
    ? Endpoint<Response, QueryParams, UrlParams>
    : Endpoint;
};

export type DefaultEndpoints<EndpointsMethods> = {
  [K in keyof EndpointsMethods]: Endpoint;
};

export type EndpointsConfig<EndpointsMethods> =
  IsNever<EndpointsMethods> extends true
    ? Record<string, RequestConfig>
    : Record<keyof EndpointsMethods, RequestConfig>;

export type ApiHandlerReturnType<EndpointsMethods, EndpointsCfg> =
  EndpointsRecord<EndpointsMethods> &
    (IsNever<EndpointsCfg> extends true
      ? unknown
      : DefaultEndpoints<ConditionalOmit<EndpointsCfg, EndpointsMethods>>) &
    ApiHandlerMethods<EndpointsMethods>;

export type ApiHandlerMethods<EndpointsMethods> = {
  config: ApiHandlerConfig<EndpointsMethods>;
  endpoints: EndpointsConfig<EndpointsMethods>;
  requestHandler: RequestHandler;
  getInstance: () => FetcherInstance;
  request: (
    endpointName: keyof EndpointsMethods & string,
    queryParams?: APIQueryParams | null,
    uriParams?: APIUriParams,
    requestConfig?: RequestConfig,
  ) => Promise<RequestResponse>;
};

export interface ApiHandlerConfig<EndpointsMethods>
  extends RequestHandlerConfig {
  apiUrl: string;
  endpoints: EndpointsConfig<EndpointsMethods>;
}
