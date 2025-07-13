import type { DefaultRequestTypes } from './request-handler';
import type { Req } from './request-handler';
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  RequestConfig,
  FetchResponse,
  DefaultResponse,
} from './request-handler';

// Common type definitions
interface NameValuePair {
  name: string;
  value: string;
}

declare const emptyObjectSymbol: unique symbol;

export type EmptyObject = { [emptyObjectSymbol]?: never };

export type DefaultParams =
  | Record<string, any>
  | URLSearchParams
  | NameValuePair[]
  | EmptyObject
  | null;

export type DefaultUrlParams = Record<string, any>;
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

type EndpointDefaults = Endpoint<DefaultRequestTypes>;

/**
 * Represents an API endpoint definition with optional type parameters for various request and response components.
 *
 * @template T - An object that can specify the following optional properties:
 *   @property response - The expected response type returned by the endpoint (default: `DefaultResponse`).
 *   @property body - The type of the request body accepted by the endpoint (default: `BodyPayload`).
 *   @property params - The type of the query parameters accepted by the endpoint (default: `QueryParams`).
 *   @property urlPathParams - The type of the path parameters accepted by the endpoint (default: `UrlPathParams`).
 *
 * @example
 *  interface EndpointTypes {
 *    getUser: Endpoint<{ response: UserResponse }>;
 *    getPosts: Endpoint<{
 *      response: PostsResponse;
 *      params: PostsQueryParams;
 *      urlPathParams: PostsUrlPathParams;
 *      body: PostsRequestBody;
 *    }>;
 *  }
 */
export type Endpoint<T extends DefaultRequestTypes = DefaultRequestTypes> =
  EndpointFunction<T>;

// Helper to support 4 generics
export type EndpointReq<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  UrlPathParams = DefaultUrlParams,
> = Endpoint<Req<ResponseData, RequestBody, QueryParams, UrlPathParams>>;

type MergeEndpointShape<
  O extends Partial<DefaultRequestTypes>,
  T extends DefaultRequestTypes,
> = {
  response: O extends { response: infer R }
    ? R
    : T extends { response: infer R }
      ? R
      : DefaultResponse;
  body: O extends { body: infer B }
    ? B
    : T extends { body: infer B }
      ? B
      : BodyPayload;
  params: O extends { params: infer P }
    ? P
    : T extends { params: infer P }
      ? P
      : QueryParams;
  urlPathParams: O extends { urlPathParams: infer U }
    ? U
    : T extends { urlPathParams: infer U }
      ? U
      : UrlPathParams;
};

interface EndpointFunction<
  T extends Partial<DefaultRequestTypes> = DefaultRequestTypes,
> {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  <O extends Partial<DefaultRequestTypes> = {}>(
    requestConfig?: RequestConfig<
      MergeEndpointShape<O, T>['response'],
      MergeEndpointShape<O, T>['params'],
      MergeEndpointShape<O, T>['urlPathParams'],
      MergeEndpointShape<O, T>['body']
    >,
  ): Promise<
    FetchResponse<
      MergeEndpointShape<O, T>['response'],
      MergeEndpointShape<O, T>['body'],
      MergeEndpointShape<O, T>['params'],
      MergeEndpointShape<O, T>['urlPathParams']
    >
  >;
}

export interface RequestEndpointFunction<EndpointTypes> {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  <O extends Partial<DefaultRequestTypes> = {}>(
    endpointNameOrUrl: keyof EndpointTypes | string,
    requestConfig?: RequestConfig<
      MergeEndpointShape<O, DefaultRequestTypes>['response'],
      MergeEndpointShape<O, DefaultRequestTypes>['params'],
      MergeEndpointShape<O, DefaultRequestTypes>['urlPathParams'],
      MergeEndpointShape<O, DefaultRequestTypes>['body']
    >,
  ): Promise<
    FetchResponse<
      MergeEndpointShape<O, DefaultRequestTypes>['response'],
      MergeEndpointShape<O, DefaultRequestTypes>['body'],
      MergeEndpointShape<O, DefaultRequestTypes>['params'],
      MergeEndpointShape<O, DefaultRequestTypes>['urlPathParams']
    >
  >;
}

type MergeWithEndpointDef<
  EndpointTypes,
  K extends keyof EndpointTypes,
  O extends Partial<DefaultRequestTypes>,
> = MergeEndpointShape<
  O,
  EndpointTypes[K] extends Endpoint<infer S> ? S : DefaultRequestTypes
>;

type EndpointMethod<EndpointTypes, K extends keyof EndpointTypes> = <
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  O extends Partial<DefaultRequestTypes> = {},
>(
  requestConfig?: RequestConfig<
    MergeWithEndpointDef<EndpointTypes, K, O>['response'],
    MergeWithEndpointDef<EndpointTypes, K, O>['params'],
    MergeWithEndpointDef<EndpointTypes, K, O>['urlPathParams'],
    MergeWithEndpointDef<EndpointTypes, K, O>['body']
  >,
) => Promise<
  FetchResponse<
    MergeWithEndpointDef<EndpointTypes, K, O>['response'],
    MergeWithEndpointDef<EndpointTypes, K, O>['body'],
    MergeWithEndpointDef<EndpointTypes, K, O>['params'],
    MergeWithEndpointDef<EndpointTypes, K, O>['urlPathParams']
  >
>;

/**
 * Maps the method names from `EndpointTypes` to their corresponding `Endpoint` type definitions.
 *
 * @template EndpointTypes - The object containing endpoint method definitions.
 */
type EndpointsRecord<EndpointTypes> = {
  [K in keyof EndpointTypes]: EndpointMethod<EndpointTypes, K>;
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
 * @template EndpointTypes - The object containing endpoint method definitions.
 */
export type EndpointsConfig<EndpointTypes> = Record<
  keyof EndpointTypes | string,
  RequestConfigUrlRequired
>;

/**
 * Part of the endpoints configuration, derived from `EndpointsSettings` based on the `EndpointTypes`.
 *
 * This type handles defaulting to endpoints configuration when particular Endpoints Methods are not provided.
 *
 * @template EndpointsSettings - The configuration object for endpoints.
 * @template EndpointTypes - The object containing endpoint method definitions.
 */
type EndpointsConfigPart<EndpointsSettings, EndpointTypes extends object> = [
  EndpointsSettings,
] extends [never]
  ? unknown
  : DefaultEndpoints<Omit<EndpointsSettings, keyof EndpointTypes>>;

/**
 * Provides the methods available from the API handler, combining endpoint record types, endpoints configuration,
 * and default methods.
 *
 * @template EndpointTypes - The object containing endpoint method definitions.
 * @template EndpointsSettings - The configuration object for endpoints.
 */
export type ApiHandlerMethods<
  EndpointTypes extends object,
  EndpointsSettings,
> = EndpointsRecord<EndpointTypes> & // Provided interface
  EndpointsConfigPart<EndpointsSettings, EndpointTypes> & // Derived defaults from 'endpoints'
  ApiHandlerDefaultMethods<EndpointTypes>; // Returned API Handler methods

/**
 * Defines the default methods available within the API handler.
 *
 * This includes configuration, endpoint settings, request handler, instance retrieval, and a generic request method.
 *
 * @template EndpointTypes - The object containing endpoint method definitions.
 */
export type ApiHandlerDefaultMethods<EndpointTypes> = {
  config: ApiHandlerConfig<EndpointTypes>;
  endpoints: EndpointsConfig<EndpointTypes>;
  request: RequestEndpointFunction<EndpointTypes>;
};

type RequireApiUrlOrBaseURL =
  | { apiUrl: string; baseURL?: never }
  | { apiUrl?: never; baseURL: string };

/**
 * Configuration for the API handler, including API URL and endpoints.
 *
 * @template EndpointTypes - The object containing endpoint method definitions.
 */
export type ApiHandlerConfig<EndpointTypes> = RequestConfig &
  RequireApiUrlOrBaseURL & {
    endpoints: EndpointsConfig<EndpointTypes>;
  };
