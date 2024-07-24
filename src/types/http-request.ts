import type {
  AxiosStatic,
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';

export type RequestResponse<T = unknown> = Promise<AxiosResponse<T>>;

export type ErrorHandlingStrategy =
  | 'throwError'
  | 'reject'
  | 'silent'
  | 'defaultResponse';

export type RequestError = AxiosError<unknown>;

interface ErrorHandlerClass {
  process(error?: RequestError): unknown;
}

type ErrorHandlerFunction = (error: RequestError) => unknown;

export type EndpointsConfig<T extends string | number | symbol> = {
  [K in T]: EndpointConfig;
};

export interface EndpointConfig extends AxiosRequestConfig {
  cancellable?: boolean;
  rejectCancelled?: boolean;
  strategy?: ErrorHandlingStrategy;
  onError?: ErrorHandlerFunction | ErrorHandlerClass;
}

export interface RequestHandlerConfig extends EndpointConfig {
  axios: AxiosStatic;
  flattenResponse?: boolean;
  defaultResponse?: unknown;
  logger?: unknown;
  onError?: ErrorHandlerFunction | ErrorHandlerClass;
}

export interface APIHandlerConfig<EndpointsList = { [x: string]: unknown }>
  extends RequestHandlerConfig {
  apiUrl: string;
  endpoints: EndpointsConfig<keyof EndpointsList>;
}

export interface RequestData {
  type: string;
  url: string;
  data?: unknown;
  config: EndpointConfig;
}
