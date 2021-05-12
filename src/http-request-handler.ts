// 3rd party libs
import axios, {
    AxiosInstance,
    AxiosRequestConfig,
    Method,
} from 'axios';

import {
    CatchAll,
} from '@magna_shogun/catch-decorator';

// Shared Modules
import {
    HttpRequestErrorHandler,
} from './http-request-error-handler';

// Types
import {
    IHttpRequestHandler,
    IRequestData,
    IRequestResponse,
    InterceptorCallback,
    ErrorHandlingStrategy,
    RequestHandlerConfig,
} from './types/http-request-handler';

/**
 * Generic Request Handler
 * It creates an Axios instance and handles requests within that instance
 * It handles errors depending on a chosen error handling strategy
 */
@CatchAll((err, ctx: HttpRequestHandler) => ctx.processRequestError(err))
export class HttpRequestHandler implements IHttpRequestHandler {
    /**
     * @var requestInstance Provider's instance
     *
     * @memberof HttpRequestHandler
     */
    public requestInstance: AxiosInstance;

    /**
     * @var timeout Request timeout
     *
     * @memberof HttpRequestHandler
     */
    public timeout: number = 30000;

    /**
     * @var strategy Request timeout
     *
     * @memberof HttpRequestHandler
     */
    public strategy: ErrorHandlingStrategy = 'silent';

    /**
     * @var flattenResponse Response flattening
     *
     * @memberof HttpRequestHandler
     */
    public flattenResponse: boolean = true;

    /**
     * @var logger Logger
     *
     * @memberof HttpRequestHandler
     */
    protected logger: any;

    /**
     * @var httpRequestErrorService HTTP error service
     *
     * @memberof HttpRequestHandler
     */
    protected httpRequestErrorService: any;

    /**
     * Creates an instance of HttpRequestHandler
     *
     * @param {string} baseURL      Base URL for all API calls
     * @param {number} timeout      Request timeout
     * @param {string} strategy     Error Handling Strategy
     * @param {string} flattenResponse     Whether to flatten response "data" object within "data" one
     * @param {*} logger            Instance of Logger Class
     * @param {*} httpRequestErrorService  Instance of Error Service Class
     *
     * @memberof HttpRequestHandler
     */
    public constructor({
        baseURL = '',
        timeout = null,
        strategy = null,
        flattenResponse = null,
        logger = null,
        httpRequestErrorService = null,
        ...config
    }: RequestHandlerConfig) {
        this.timeout = timeout !== null ? timeout : this.timeout;
        this.strategy = strategy !== null ? strategy : this.strategy;
        this.flattenResponse = flattenResponse !== null ? flattenResponse : this.flattenResponse;
        this.logger = logger || global.console || window.console || null;
        this.httpRequestErrorService = httpRequestErrorService;

        this.requestInstance = axios.create({
            ...config,
            baseURL,
            timeout: this.timeout,
        });
    }

    /**
     * Get Provider Instance
     *
     * @returns {AxiosInstance} Provider's instance
     * @memberof HttpRequestHandler
     */
    public getInstance(): AxiosInstance {
        return this.requestInstance;
    }

    /**
     * Intercept Request
     *
     * @param {*} callback callback to use before request
     * @returns {void}
     * @memberof HttpRequestHandler
     */
    public interceptRequest(callback: InterceptorCallback): void {
        this.getInstance().interceptors.request.use(callback);
    }

    /**
     * POST Request
     *
     * @param {string} url                  Url
     * @param {*} data                      Payload
     * @param {AxiosRequestConfig} config   Config
     * @throws {Error}                      If request fails
     * @returns {Promise}                   Request response or error info
     * @memberof HttpRequestHandler
     */
    public post(url: string, data: any = null, config: AxiosRequestConfig = null): Promise<IRequestResponse> {
        return this.handleRequest({
            type: 'post',
            url,
            data,
            config,
        });
    }

    /**
     * GET Request
     *
     * @param {string} url                  Url
     * @param {*} data                      Payload
     * @param {AxiosRequestConfig} config   Config
     * @throws {Error}                      If request fails
     * @returns {Promise}                   Request response or error info
     * @memberof HttpRequestHandler
     */
    public get(url: string, data: any = null, config: AxiosRequestConfig = null): Promise<IRequestResponse> {
        return this.handleRequest({
            type: 'get',
            url,
            data,
            config,
        });
    }

    /**
     * PUT Request
     *
     * @param {string} url                  Url
     * @param {*} data                      Payload
     * @param {AxiosRequestConfig} config   Config
     * @throws {Error}                      If request fails
     * @returns {Promise}                   Request response or error info
     * @memberof HttpRequestHandler
     */
    public put(url: string, data: any = null, config: AxiosRequestConfig = null): Promise<IRequestResponse> {
        return this.handleRequest({
            type: 'put',
            url,
            data,
            config,
        });
    }

    /**
     * DELETE Request
     *
     * @param {string} url                  Url
     * @param {*} data                      Payload
     * @param {AxiosRequestConfig} config   Config
     * @throws {Error}                      If request fails
     * @returns {Promise}                   Request response or error info
     * @memberof HttpRequestHandler
     */
    public delete(url: string, data: any = null, config: AxiosRequestConfig = null): Promise<IRequestResponse> {
        return this.handleRequest({
            type: 'delete',
            url,
            data,
            config,
        });
    }

    /**
     * PATCH Request
     *
     * @param {string} url                  Url
     * @param {*} data                      Payload
     * @param {AxiosRequestConfig} config   Config
     * @throws {Error}                      If request fails
     * @returns {Promise}                   Request response or error info
     * @memberof HttpRequestHandler
     */
    public patch(url: string, data: any = null, config: AxiosRequestConfig = null): Promise<IRequestResponse> {
        return this.handleRequest({
            type: 'patch',
            url,
            data,
            config,
        });
    }

    /**
     * HEAD Request
     *
     * @param {string} url                  Url
     * @param {*} data                      Payload
     * @param {AxiosRequestConfig} config   Config
     * @throws {Error}                      If request fails
     * @returns {Promise}                   Request response or error info
     * @memberof HttpRequestHandler
     */
    public head(url: string, data: any = null, config: AxiosRequestConfig = null): Promise<IRequestResponse> {
        return this.handleRequest({
            type: 'head',
            url,
            data,
            config,
        });
    }

    /**
     * Get Provider Instance
     *
     * @param {Error} err      Error instance
     * @returns {AxiosInstance} Provider's instance
     * @memberof HttpRequestHandler
     */
    protected processRequestError(err: Error): void {
        return new HttpRequestErrorHandler(
            this.logger,
            this.httpRequestErrorService,
            this.strategy
        ).process(err);
    }

    /**
     * Handle Request depending on used strategy
     *
     * @param {object} payload                      Payload
     * @param {string} payload.type                 Request type
     * @param {string} payload.url                  Request url
     * @param {*} payload.data                      Request data
     * @param {AxiosRequestConfig} payload.config   Config to modify request
     * @throws {Error}
     * @returns {Promise} Response Data
     * @memberof HttpRequestHandler
     */
    protected async handleRequest({
        type,
        url,
        data = null,
        config = null,
    }: IRequestData): Promise<IRequestResponse> {
        let response = null;
        let requestConfig = config || {};
        const key = type === 'get' || type === 'head' ? 'params' : 'data';

        requestConfig = {
            ...requestConfig,
            url,
            method: type as Method,
            [key]: data || {},
        };

        switch (this.strategy) {
            // Promise will hang but will be GC-ed
            // Can be used for a requests that are dispatched within asynchronous wrapper functions
            // Those functions should preferably never be awaited
            case 'silent':
                try {
                    response = await this.requestInstance.request(requestConfig);
                } catch (error) {
                    this.processRequestError(error);

                    response = await new Promise(() => null);

                    return response;
                }
                break;

            // Simply rejects a request promise without an error being thrown
            case 'reject':
                try {
                    response = await this.requestInstance.request(requestConfig);
                } catch (error) {
                    this.processRequestError(error);

                    return Promise.reject(error);
                }
                break;

            // Rejects the promise and throws an error object
            case 'throwError':
            default:
                response = await this.requestInstance.request(requestConfig);
        }

        return this.processResponseData(response);
    }

    // eslint-disable-next-line class-methods-use-this
    protected processResponseData(response) {
        if (response.data) {
            if (!this.flattenResponse) {
                return response;
            }

            // Special case of data property within Axios data object
            // This is in fact a proper response but we may want to flatten it
            // To ease developers' lives when obtaining the response
            if (typeof response.data === 'object' && response.data.data && Object.keys(response.data).length === 1) {
                return response.data.data;
            }

            return response.data;
        }

        return null;
    }
}