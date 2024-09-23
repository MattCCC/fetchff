/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  RequestConfig,
  RequestHandlerConfig,
  FetchResponse,
  RequestHandlerReturnType,
  CreatedCustomFetcherInstance,
  DefaultResponse,
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

/**
 * Represents an API endpoint handler with support for customizable query parameters, URL path parameters,
 * and request configuration.
 *
 * The overloads allow customization of the returned data type (`ReturnedData`), query parameters (`T`),
 * and URL path parameters (`T2`).
 *
 * @template ResponseData - The type of the response data (default: `DefaultResponse`).
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
  ResponseData = DefaultResponse,
  QueryParams = QueryParamsOrBody,
  PathParams = UrlPathParams,
> =
  /**
   * Endpoint with default `ResponseData`, `QueryParams`, and `PathParams`.
   *
   * @param {QueryParams} [queryParamsOrBody] - Optional query parameters for the request.
   * @param {PathParams} [urlPathParams] - Optional URL path parameters for the request.
   * @param {StructuredConfig<RequestConfig<ResponseData>>} [requestConfig] - Optional configuration for the request.
   * @returns {Promise<FetchResponse<ResponseData>>} - A promise resolving to the fetch response.
   */
  | {
      (
        queryParamsOrBody?: QueryParams,
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
   * @param {T} [queryParamsOrBody] - Optional query parameters for the request.
   * @param {T2} [urlPathParams] - Optional URL path parameters for the request.
   * @param {StructuredConfig<RequestConfig<ResponseData>>} [requestConfig] - Optional configuration for the request.
   * @returns {Promise<FetchResponse<ReturnedData>>} - A promise resolving to the customized fetch response.
   */
  | {
      <ReturnedData = ResponseData, T = QueryParams, T2 = PathParams>(
        queryParamsOrBody?: T,
        urlPathParams?: T2,
        requestConfig?: RequestConfig<ReturnedData>,
      ): Promise<FetchResponse<ReturnedData>>;
    };

type EndpointDefaults = Endpoint<DefaultResponse>;

/**
 * Maps the method names from `EndpointsMethods` to their corresponding `Endpoint` type definitions.
 *
 * @template EndpointsMethods - The object containing endpoint method definitions.
 */
type EndpointsRecord<EndpointsMethods> = {
  [K in keyof EndpointsMethods]: EndpointsMethods[K] extends Endpoint<
    infer ResponseData,
    infer QueryParams,
    infer UrlPathParams
  >
    ? Endpoint<ResponseData, QueryParams, UrlPathParams> // Method exists in a provided interface
    : Endpoint<DefaultResponse>; // Method is not defined. Provide defaults
};

/**
 * Defines default endpoints based on the provided `EndpointsSettings`.
 *
 * This type provides default implementations for endpoints in `EndpointsSettings`, using `EndpointDefaults`.
 *
 * @template EndpointsSettings - The configuration object for endpoints.
 */
type DefaultEndpoints<EndpointsSettings> = {
  [K in keyof EndpointsSettings]: EndpointDefaults;
};

type RequestConfigUrlRequired = Omit<RequestConfig, 'url'> & { url: string };

/**
 * Configuration for API endpoints, where each key is an endpoint name or string, and the value is the request configuration.
 *
 * @template EndpointsMethods - The object containing endpoint method definitions.
 */
export type EndpointsConfig<EndpointsMethods> = Record<
  keyof EndpointsMethods | string,
  RequestConfigUrlRequired
>;

/**
 * Part of the endpoints configuration, derived from `EndpointsSettings` based on the `EndpointsMethods`.
 *
 * This type handles defaulting to endpoints configuration when particular Endpoints Methods are not provided.
 *
 * @template EndpointsSettings - The configuration object for endpoints.
 * @template EndpointsMethods - The object containing endpoint method definitions.
 */
type EndpointsConfigPart<EndpointsSettings, EndpointsMethods extends object> = [
  EndpointsSettings,
] extends [never]
  ? unknown
  : DefaultEndpoints<Omit<EndpointsSettings, keyof EndpointsMethods>>;

/**
 * Provides the methods available from the API handler, combining endpoint record types, endpoints configuration,
 * and default methods.
 *
 * @template EndpointsMethods - The object containing endpoint method definitions.
 * @template EndpointsSettings - The configuration object for endpoints.
 */
export type ApiHandlerMethods<
  EndpointsMethods extends object,
  EndpointsSettings,
> = EndpointsRecord<EndpointsMethods> & // Provided interface
  EndpointsConfigPart<EndpointsSettings, EndpointsMethods> & // Derived defaults from 'endpoints'
  ApiHandlerDefaultMethods<EndpointsMethods>; // Returned API Handler methods

/**
 * Defines the default methods available within the API handler.
 *
 * This includes configuration, endpoint settings, request handler, instance retrieval, and a generic request method.
 *
 * @template EndpointsMethods - The object containing endpoint method definitions.
 */
export type ApiHandlerDefaultMethods<EndpointsMethods> = {
  config: ApiHandlerConfig<EndpointsMethods>;
  endpoints: EndpointsConfig<EndpointsMethods>;
  requestHandler: RequestHandlerReturnType;
  getInstance: () => CreatedCustomFetcherInstance | null;
  request: <ResponseData = DefaultResponse>(
    endpointName: keyof EndpointsMethods | string,
    queryParams?: QueryParams,
    urlPathParams?: UrlPathParams,
    requestConfig?: RequestConfig<ResponseData>,
  ) => Promise<FetchResponse<ResponseData>>;
};

/**
 * Configuration for the API handler, including API URL and endpoints.
 *
 * @template EndpointsMethods - The object containing endpoint method definitions.
 */
export interface ApiHandlerConfig<EndpointsMethods>
  extends RequestHandlerConfig {
  apiUrl: string;
  endpoints: EndpointsConfig<EndpointsMethods>;
}
