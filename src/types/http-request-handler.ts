import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export type IRequestResponse<T = any> = Promise<AxiosResponse<T>>;

export type InterceptorCallback = (value: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>;

export type ErrorHandlingStrategy = 'throwError' | 'reject' | 'silent' | 'defaultResponse';

export interface EndpointConfig extends AxiosRequestConfig {
    cancellable?: boolean;
    rejectCancelled?: boolean;
}

export interface RequestHandlerConfig extends EndpointConfig {
    strategy?: ErrorHandlingStrategy;
    flattenResponse?: boolean;
    defaultResponse?: any;
    logger?: any;
    onError?: any;
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

export interface IHttpRequestHandler {
    requestInstance: AxiosInstance;
    timeout: NonNullable<number>;
    strategy: ErrorHandlingStrategy;
    flattenResponse: boolean;

    getInstance(): AxiosInstance;

    interceptRequest(callback: InterceptorCallback): void;

    post(url: string, data?: any, config?: EndpointConfig): Promise<IRequestResponse>;

    get(url: string, data?: any, config?: EndpointConfig): Promise<IRequestResponse>;

    put(url: string, data?: any, config?: EndpointConfig): Promise<IRequestResponse>;

    delete(url: string, data?: any, config?: EndpointConfig): Promise<IRequestResponse>;

    head(url: string, data?: any, config?: EndpointConfig): Promise<IRequestResponse>;

    patch(url: string, data?: any, config?: EndpointConfig): Promise<IRequestResponse>;
}
