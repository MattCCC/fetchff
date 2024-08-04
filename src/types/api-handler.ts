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
export declare type QueryParams<T = unknown> = Record<string, T> | null;
export declare type BodyPayload<T = unknown> = Record<string, T> | null;
export declare type QueryParamsOrBody<T = unknown> =
  | QueryParams<T>
  | BodyPayload<T>;
export declare type UrlPathParams<T = unknown> = Record<string, T> | null;
export declare type APIResponse = unknown;

// Endpoint function type
export declare type Endpoint<
  Response = APIResponse,
  QueryParams = QueryParamsOrBody,
  PathParams = UrlPathParams,
> =
  | {
      (
        queryParams?: QueryParams,
        urlPathParams?: PathParams,
        requestConfig?: RequestConfig,
      ): Promise<Response>;
    }
  | {
      <ResponseData = Response, T = QueryParams, T2 = PathParams>(
        queryParams?: T | null,
        urlPathParams?: T2,
        requestConfig?: RequestConfig,
      ): Promise<ResponseData>;
    };

export type EndpointsRecord<EndpointsMethods> = {
  [K in keyof EndpointsMethods]: EndpointsMethods[K] extends Endpoint<
    infer Response,
    infer QueryParams,
    infer UrlPathParams
  >
    ? Endpoint<Response, QueryParams, UrlPathParams>
    : Endpoint<never>;
};

export type DefaultEndpoints<EndpointsMethods> = {
  [K in keyof EndpointsMethods]: Endpoint<never>;
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
    queryParams?: QueryParams,
    urlPathParams?: UrlPathParams,
    requestConfig?: RequestConfig,
  ) => RequestResponse;
};

export interface ApiHandlerConfig<EndpointsMethods>
  extends RequestHandlerConfig {
  apiUrl: string;
  endpoints: EndpointsConfig<EndpointsMethods>;
}
