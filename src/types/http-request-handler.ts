import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

export type IRequestResponse<T = any> = Promise<AxiosResponse<T>>;

export type InterceptorCallback = (value: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>;

export type ErrorHandlingStrategy = 'throwError' | 'reject' | 'silent' | 'defaultResponse';

export type RequestError = AxiosError<any>;

export interface EndpointConfig extends AxiosRequestConfig {
    cancellable?: boolean;
    rejectCancelled?: boolean;
    strategy?: ErrorHandlingStrategy;
    onError?: (error: RequestError) => any;
}

export interface RequestHandlerConfig extends EndpointConfig {
    flattenResponse?: boolean;
    defaultResponse?: any;
    logger?: any;
    onError?: (error: RequestError) => any;
}

export interface APIHandlerConfig extends RequestHandlerConfig {
    apiUrl: string;
    apiEndpoints: Record<string, any>;
}

export interface IRequestData {
    type: string;
    url: string;
    data?: any;
    config: EndpointConfig;
}
