/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  RequestConfig,
  RequestHandlerConfig,
  FetchResponse,
  DefaultResponse,
  ExtendedRequestConfig,
} from './request-handler';

// Common type definitions
interface NameValuePair {
  name: string;
  value: string;
}

declare const emptyObjectSymbol: unique symbol;

export type EmptyObject = { [emptyObjectSymbol]?: never };

export type DefaultParams =
  | Record<string, unknown>
  | URLSearchParams
  | NameValuePair[]
  | EmptyObject
  | null;

export type DefaultUrlParams = Record<string, unknown>;
export type DefaultPayload = Record<string, any>;

export declare type QueryParams<ParamsType = DefaultParams> =
  | (ParamsType & EmptyObject)
  | URLSearchParams
  | NameValuePair[]
  | EmptyObject
  | null;

export declare type UrlPathParams<UrlParamsType = DefaultUrlParams> =
  | ([UrlParamsType] extends [DefaultUrlParams]
      ? UrlParamsType & EmptyObject
      : UrlParamsType)
  | EmptyObject
  | null;

export declare type BodyPayload<PayloadType = DefaultPayload> =
  | BodyInit
  | (PayloadType & EmptyObject)
  | PayloadType[]
  | null;

// Helper types declared outside the interface
export type FallbackValue<T, U, D = T> = [T] extends [never] ? U : D;

export type FinalResponse<Response, ResponseData> = FallbackValue<
  Response,
  ResponseData
>;

export type FinalParams<Response, ParamsType, DefaultParams> = [
  ParamsType,
] extends [never]
  ? DefaultParams
  : [Response] extends [never]
    ? DefaultParams
    : ParamsType | EmptyObject;

interface EndpointFunction<
  ResponseData,
  QueryParams_,
  PathParams,
  RequestBody_,
> {
  <Resp = never, QueryParams = never, UrlParams = never, RequestBody = never>(
    requestConfig?: ExtendedRequestConfig<
      FallbackValue<Resp, ResponseData>,
      FinalParams<Resp, QueryParams, QueryParams_>,
      FinalParams<Resp, UrlParams, PathParams>,
      FallbackValue<Resp, RequestBody_, RequestBody>
    >,
  ): Promise<FetchResponse<FallbackValue<Resp, ResponseData>>>;
}

export interface RequestEndpointFunction<EndpointsMethods> {
  <
    ResponseData = never,
    QueryParams_ = never,
    UrlParams = never,
    RequestBody = never,
  >(
    endpointName: keyof EndpointsMethods | string,
    requestConfig?: RequestConfig<
      FinalResponse<ResponseData, DefaultResponse>,
      FinalParams<ResponseData, QueryParams_, QueryParams>,
      FinalParams<ResponseData, UrlParams, UrlPathParams>,
      FallbackValue<ResponseData, DefaultPayload, RequestBody>
    >,
  ): Promise<FetchResponse<FinalResponse<ResponseData, DefaultResponse>>>;
}

/**
 * Represents an API endpoint handler with support for customizable query parameters, URL path parameters,
 * and request configuration.
 *
 * The overloads allow customization of the returned data type (`ReturnedData`), query parameters (`T`),
 * and URL path parameters (`T2`).
 *
 * @template ResponseData - The type of the response data (default: `DefaultResponse`).
 * @template QueryParams - The type of the query parameters (default: `QueryParams`).
 * @template PathParams - The type of the URL path parameters (default: `UrlPathParams`).
 * @template RequestBody - The type of the Requesty Body (default: `BodyPayload`).
 *
 * @example
 *  interface EndpointsMethods {
 *    getUser: Endpoint<UserResponse>;
 *    getPosts: Endpoint<PostsResponse, PostsQueryParams, PostsUrlPathParams, PostsRequestBody>;
 *  }
 */
export declare type Endpoint<
  ResponseData = DefaultResponse,
  QueryParams_ = QueryParams,
  PathParams = UrlPathParams,
  RequestBody = BodyPayload,
> = EndpointFunction<ResponseData, QueryParams_, PathParams, RequestBody>;

// Setting 'unknown here lets us infer typings for non-predefined endpoints with dynamically set generic response data
type EndpointDefaults = Endpoint<DefaultResponse>;

type AFunction = (...args: any[]) => any;

/**
 * Maps the method names from `EndpointsMethods` to their corresponding `Endpoint` type definitions.
 *
 * @template EndpointsMethods - The object containing endpoint method definitions.
 */
type EndpointsRecord<EndpointsMethods> = {
  [K in keyof EndpointsMethods]: EndpointsMethods[K] extends AFunction
    ? EndpointsMethods[K] // Map function signatures directly
    : EndpointsMethods[K] extends Endpoint<
          infer ResponseData,
          infer QueryParams,
          infer UrlPathParams
        >
      ? Endpoint<ResponseData, QueryParams, UrlPathParams> // Method is an Endpoint type
      : EndpointDefaults; // Fallback to default Endpoint type
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

export type RequestConfigUrlRequired = Omit<RequestConfig, 'url'> & {
  url: string;
};

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
  request: RequestEndpointFunction<EndpointsMethods>;
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
