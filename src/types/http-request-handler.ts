import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export type IRequestResponse<T = any> = Promise<AxiosResponse<T>>;

export interface IRequestData {
    type: string;
    url: string;
    data?: any;
    config: AxiosRequestConfig;
}

export type InterceptorCallback = (value: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>;

export type ErrorHandlingStrategy = 'throwError' | 'reject' | 'silent';

export interface IHttpRequestHandler {
    requestInstance: AxiosInstance;
    timeout: NonNullable<number>;
    strategy: ErrorHandlingStrategy;
    getInstance(): AxiosInstance;
    interceptRequest(callback: InterceptorCallback): void;
    post(url: string, data?: any, config?: AxiosRequestConfig): Promise<IRequestResponse>;
    get(url: string, data?: any, config?: AxiosRequestConfig): Promise<IRequestResponse>;
    put(url: string, data?: any, config?: AxiosRequestConfig): Promise<IRequestResponse>;
    delete(url: string, data?: any, config?: AxiosRequestConfig): Promise<IRequestResponse>;
}