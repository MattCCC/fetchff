// 3rd party libs
import axios, {
    AxiosInstance,
    Method,
} from 'axios';
import {
    applyMagic,
    MagicalClass,
} from 'js-magic';

// Shared Modules
import {
    HttpRequestErrorHandler,
} from './http-request-error-handler';

// Types
import {
    IRequestData,
    IRequestResponse,
    InterceptorCallback,
    ErrorHandlingStrategy,
    RequestHandlerConfig,
    EndpointConfig,
    RequestError,
} from './types/http-request-handler';

/**
 * Generic Request Handler
 * It creates an Axios instance and handles requests within that instance
 * It handles errors depending on a chosen error handling strategy
 */
@applyMagic
export class HttpRequestHandler implements MagicalClass {
    /**
     * @var requestInstance Provider's instance
     */
    public requestInstance: AxiosInstance;

    /**
     * @var timeout Request timeout
     */
    public timeout: number = 30000;

    /**
     * @var cancellable Response cancellation
     */
    public cancellable: boolean = false;

    /**
     * @var strategy Request timeout
     */
    public strategy: ErrorHandlingStrategy = 'silent';

    /**
     * @var flattenResponse Response flattening
     */
    public flattenResponse: boolean = true;

    /**
     * @var defaultResponse Response flattening
     */
    public defaultResponse: any = null;

    /**
     * @var logger Logger
     */
    protected logger: any;

    /**
     * @var httpRequestErrorService HTTP error service
     */
    protected httpRequestErrorService: any;

    /**
     * @var requestsQueue    Queue of requests
     */
    protected requestsQueue: Map<string, any>;

    /**
     * Creates an instance of HttpRequestHandler
     *
     * @param {string} baseURL              Base URL for all API calls
     * @param {number} timeout              Request timeout
     * @param {string} strategy             Error Handling Strategy
     * @param {string} flattenResponse      Whether to flatten response "data" object within "data" one
     * @param {*} logger                    Instance of Logger Class
     * @param {*} httpRequestErrorService   Instance of Error Service Class
     */
    public constructor({
        baseURL = '',
        timeout = null,
        cancellable = false,
        strategy = null,
        flattenResponse = null,
        defaultResponse = {},
        logger = null,
        onError = null,
        ...config
    }: RequestHandlerConfig) {
        this.timeout = timeout !== null ? timeout : this.timeout;
        this.strategy = strategy !== null ? strategy : this.strategy;
        this.cancellable = cancellable || this.cancellable;
        this.flattenResponse = flattenResponse !== null ? flattenResponse : this.flattenResponse;
        this.defaultResponse = defaultResponse;
        this.logger = logger || global.console || window.console || null;
        this.httpRequestErrorService = onError;
        this.requestsQueue = new Map();

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
     */
    public getInstance(): AxiosInstance {
        return this.requestInstance;
    }

    /**
     * Intercept Request
     *
     * @param {*} callback callback to use before request
     * @returns {void}
     */
    public interceptRequest(callback: InterceptorCallback): void {
        this.getInstance().interceptors.request.use(callback);
    }

    /**
     * Maps all API requests
     *
     * @param {string} url                  Url
     * @param {*} data                      Payload
     * @param {EndpointConfig} config       Config
     * @throws {RequestError}                      If request fails
     * @returns {Promise}                   Request response or error info
     */
    public __get(prop: string) {
        if (prop in this) {
            return this[prop];
        }

        return this.prepareRequest.bind(this, prop);
    }

    /**
     * Prepare Request
     *
     * @param {string} url                  Url
     * @param {*} data                      Payload
     * @param {EndpointConfig} config       Config
     * @throws {RequestError}                      If request fails
     * @returns {Promise}                   Request response or error info
     */
    public prepareRequest(type: Method, url: string, data: any = null, config: EndpointConfig = null): Promise<IRequestResponse> {
        return this.handleRequest({
            type,
            url,
            data,
            config,
        });
    }

    /**
     * Build request configuration
     *
     * @param {string} method               Request method
     * @param {string} url                  Request url
     * @param {*}      data                 Request data
     * @param {EndpointConfig} config       Request config
     * @returns {AxiosInstance} Provider's instance
     */
    protected buildRequestConfig(method: string, url: string, data: any, config: EndpointConfig): EndpointConfig {
        const methodLowerCase = method.toLowerCase() as Method;
        const key = methodLowerCase === 'get' || methodLowerCase === 'head' ? 'params' : 'data';

        return {
            ...config,
            url,
            method: methodLowerCase,
            [key]: data || {},
        };
    }

    /**
     * Process global Request Error
     *
     * @param {RequestError} error      Error instance
     * @param {EndpointConfig} requestConfig   Per endpoint request config
     * @returns {AxiosInstance} Provider's instance
     */
    protected processRequestError(error: RequestError, requestConfig: EndpointConfig): void {
        if (axios.isCancel(error)) {
            return;
        }

        // Invoke per request "onError" call
        if (requestConfig.onError && typeof requestConfig.onError === 'function') {
            requestConfig.onError(error);
        }

        const errorHandler = new HttpRequestErrorHandler(
            this.logger,
            this.httpRequestErrorService
        );

        errorHandler.process(error);
    }

    /**
     * Output error response depending on chosen strategy
     *
     * @param {RequestError} error      Error instance
     * @param {EndpointConfig} requestConfig   Per endpoint request config
     * @returns {AxiosInstance} Provider's instance
     */
    protected async outputErrorResponse(error: RequestError, requestConfig: EndpointConfig): Promise<IRequestResponse> {
        const isRequestCancelled = requestConfig.cancelToken && axios.isCancel(error);
        const errorHandlingStrategy = requestConfig.strategy || this.strategy;

        // By default cancelled requests aren't rejected
        if (isRequestCancelled && !requestConfig.rejectCancelled) {
            return this.defaultResponse;
        }

        if (errorHandlingStrategy === 'silent') {
            // Hang the promise
            await new Promise(() => null);

            return this.defaultResponse;
        }

        // Simply rejects a request promise
        if (errorHandlingStrategy === 'reject' || errorHandlingStrategy === 'throwError') {
            return Promise.reject(error);
        }

        return this.defaultResponse;
    }

    /**
     * Output error response depending on chosen strategy
     *
     * @param {RequestError} error                     Error instance
     * @param {EndpointConfig} requestConfig    Per endpoint request config
     * @returns {*}                             Error response
     */
    public isRequestCancelled(error: RequestError, requestConfig: EndpointConfig): boolean {
        return requestConfig.cancelToken && axios.isCancel(error);
    }

    /**
     * Automatically Cancel Previous Requests
     *
     * @param {string} type                    Request type
     * @param {string} url                     Request url
     * @param {EndpointConfig} requestConfig   Per endpoint request config
     * @returns {AxiosInstance} Provider's instance
     */
    protected addCancellationToken(type: string, url: string, requestConfig: EndpointConfig) {
        // Both disabled
        if (!this.cancellable && !requestConfig.cancellable) {
            return {};
        }

        // Explicitly disabled per request
        if (typeof requestConfig.cancellable !== "undefined" && !requestConfig.cancellable) {
            return {};
        }

        const key = `${type}-${url}`;
        const previousRequest = this.requestsQueue.get(key);

        if (previousRequest) {
            previousRequest.cancel();
        }

        const tokenSource = axios.CancelToken.source();

        this.requestsQueue.set(key, tokenSource);

        const mappedRequest = this.requestsQueue.get(key) || {};

        return mappedRequest.token ? {
            cancelToken: mappedRequest.token
        } : {};
    }

    /**
     * Handle Request depending on used strategy
     *
     * @param {object} payload                      Payload
     * @param {string} payload.type                 Request type
     * @param {string} payload.url                  Request url
     * @param {*} payload.data                      Request data
     * @param {EndpointConfig} payload.config       Request config
     * @throws {RequestError}
     * @returns {Promise} Response Data
     */
    protected async handleRequest({
        type,
        url,
        data = null,
        config = null,
    }: IRequestData): Promise<IRequestResponse> {
        let response = null;
        const endpointConfig = config || {};
        let requestConfig = this.buildRequestConfig(type, url, data, endpointConfig);

        requestConfig = {
            ...this.addCancellationToken(type, url, requestConfig),
            ...requestConfig,
        };

        try {
            response = await this.requestInstance.request(requestConfig);
        } catch (error) {
            this.processRequestError(error, requestConfig);

            return this.outputErrorResponse(error, requestConfig);
        }

        return this.processResponseData(response);
    }

    /**
     * Process request response
     *
     * @param response Response object
     * @returns {*} Response data
     */
    protected processResponseData(response) {
        if (response.data) {
            if (!this.flattenResponse) {
                return response;
            }

            // Special case of data property within Axios data object
            // This is in fact a proper response but we may want to flatten it
            // To ease developers' lives when obtaining the response
            if (typeof response.data === 'object' && typeof response.data.data !== "undefined" && Object.keys(response.data).length === 1) {
                return response.data.data;
            }

            return response.data;
        }

        return this.defaultResponse;
    }
}