/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  RequestConfig,
  RequestHandlerConfig,
  FetchResponse,
  RequestHandlerReturnType,
  CreatedCustomFetcherInstance,
} from './request-handler';

// Common type definitions
type NameValuePair = { name: string; value: string };

declare const emptyObjectSymbol: unique symbol;

export type EmptyObject = { [emptyObjectSymbol]?: never };

export declare type QueryParams<T = unknown> =
  | (Record<string, T> & EmptyObject)
  | URLSearchParams
  | NameValuePair[]
  | null;

export declare type BodyPayload<T = any> =
  | BodyInit
  | (Record<string, T> & EmptyObject)
  | T[]
  | string
  | null;

export declare type QueryParamsOrBody<T = unknown> =
  | QueryParams<T>
  | BodyPayload<T>;

export declare type UrlPathParams<T = unknown> =
  | (Record<string, T> & EmptyObject)
  | null;

export type APIResponse = unknown;

/**
 * Represents an API endpoint handler with support for customizable query parameters, URL path parameters,
 * and request configuration. It supports handling both flattened and non-flattened responses.
 *
 * The overloads allow customization of the returned data type (`ReturnedData`), query parameters (`T`),
 * and URL path parameters (`T2`).
 *
 * @template ResponseData - The type of the response data (default: `APIResponse`).
 * @template QueryParams - The type of the query parameters (default: `QueryParamsOrBody`).
 * @template PathParams - The type of the URL path parameters (default: `UrlPathParams`).
 *
 * @example
 *  interface EndpointsMethods {
 *    getUser: Endpoint<UserResponse>;
 *    getPosts: Endpoint<PostsResponse, PostsQueryParams, PostsUrlPathParams>;
 *  }
 */
export declare type Endpoint<
  ResponseData = APIResponse,
  QueryParams = QueryParamsOrBody,
  PathParams = UrlPathParams,
> =
  /**
   * Endpoint with default `ResponseData`, `QueryParams`, and `PathParams`.
   *
   * @param {QueryParams} [queryParams] - Optional query parameters for the request.
   * @param {PathParams} [urlPathParams] - Optional URL path parameters for the request.
   * @param {StructuredConfig<RequestConfig<ResponseData>>} [requestConfig] - Optional configuration for the request.
   * @returns {Promise<FetchResponse<ResponseData>>} - A promise resolving to the fetch response.
   */
  | {
      (
        queryParams?: QueryParams,
        urlPathParams?: PathParams,
        requestConfig?: RequestConfig<ResponseData>,
      ): Promise<FetchResponse<ResponseData>>;
    }
  /**
   * Endpoint with customizable return data type.
   *
   * @template ReturnedData - The type of data returned in the response.
   * @template T - The type of query parameters.
   * @template T2 - The type of URL path parameters.
   * @param {T} [queryParams] - Optional query parameters for the request.
   * @param {T2} [urlPathParams] - Optional URL path parameters for the request.
   * @param {StructuredConfig<RequestConfig<ResponseData>>} [requestConfig] - Optional configuration for the request.
   * @returns {Promise<FetchResponse<ReturnedData>>} - A promise resolving to the customized fetch response.
   */
  | {
      <ReturnedData = ResponseData, T = QueryParams, T2 = PathParams>(
        queryParams?: T,
        urlPathParams?: T2,
        requestConfig?: RequestConfig<ReturnedData>,
      ): Promise<FetchResponse<ReturnedData>>;
    };

type EndpointDefaults = Endpoint<never>;

type EndpointsRecord<EndpointsMethods> = {
  [K in keyof EndpointsMethods]: EndpointsMethods[K] extends Endpoint<
    infer ResponseData,
    infer QueryParams,
    infer UrlPathParams
  >
    ? Endpoint<ResponseData, QueryParams, UrlPathParams>
    : Endpoint<never>;
};

type DefaultEndpoints<EndpointsCfg> = {
  [K in keyof EndpointsCfg]: EndpointDefaults;
};

type RequestConfigUrlRequired = Omit<RequestConfig, 'url'> & { url: string };

export type EndpointsConfig<EndpointsMethods> = Record<
  keyof EndpointsMethods | string,
  RequestConfigUrlRequired
>;

type EndpointsConfigPart<EndpointsCfg, EndpointsMethods extends object> = [
  EndpointsCfg,
] extends [never]
  ? unknown
  : DefaultEndpoints<Omit<EndpointsCfg, keyof EndpointsMethods>>;

export type ApiHandlerMethods<
  EndpointsMethods extends object,
  EndpointsCfg,
> = EndpointsRecord<EndpointsMethods> &
  EndpointsConfigPart<EndpointsCfg, EndpointsMethods> &
  ApiHandlerDefaultMethods<EndpointsMethods>;

export type ApiHandlerDefaultMethods<EndpointsMethods> = {
  config: ApiHandlerConfig<EndpointsMethods>;
  endpoints: EndpointsConfig<EndpointsMethods>;
  requestHandler: RequestHandlerReturnType;
  getInstance: () => CreatedCustomFetcherInstance | null;
  request: <ResponseData = APIResponse>(
    endpointName: keyof EndpointsMethods | string,
    queryParams?: QueryParams,
    urlPathParams?: UrlPathParams,
    requestConfig?: RequestConfig<ResponseData>,
  ) => Promise<FetchResponse<ResponseData>>;
};

export interface ApiHandlerConfig<EndpointsMethods>
  extends RequestHandlerConfig {
  apiUrl: string;
  endpoints: EndpointsConfig<EndpointsMethods>;
}
