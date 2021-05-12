import { AxiosRequestConfig } from "axios";

export declare type APIQueryParams = Record<string, any>;
export declare type APIUrlParams = Record<string, any>;
export declare type APIRequestConfig = AxiosRequestConfig;
export declare type APIResponse = any;

export declare type Endpoint<T = APIQueryParams, T2 = APIUrlParams, T3 = APIResponse> = (queryParams?: T, urlParams?: T2, requestConfig?: APIRequestConfig) => Promise<T3>;

export interface Endpoints {
    [x: string]: Endpoint;
};
