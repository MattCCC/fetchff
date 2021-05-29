// 3rd party libs
import {
    applyMagic,
    MagicalClass,
} from 'js-magic';

// Types
import {
    AxiosInstance,
} from 'axios';

import {
    IRequestResponse,
    APIHandlerConfig,
    EndpointConfig,
} from './types/http-request-handler';

import {
    HttpRequestHandler,
} from './http-request-handler';

/**
 * Handles dispatching of API requests
 */
@applyMagic
export class ApiHandler implements MagicalClass {
    /**
     * TS Index signature
     */
    [x: string]: any;

    /**
     * Api Url
     */
    public apiUrl = '';

    /**
     * @var httpRequestHandler Request Wrapper Instance
     */
    public httpRequestHandler: HttpRequestHandler;

    /**
     * Endpoints
     */
    public apiEndpoints: Record<string, EndpointConfig>;

    /**
     * Logger
     */
    public logger: any;

    /**
     * Creates an instance of API Handler
     *
     * @param {string} apiUrl               Base URL for all API calls
     * @param {number} timeout              Request timeout
     * @param {string} strategy             Error Handling Strategy
     * @param {string} flattenResponse      Whether to flatten response "data" object within "data" one
     * @param {*} logger                    Instance of Logger Class
     * @param {*} onError                   Instance of Error Service Class
     */
    public constructor({
        apiUrl,
        apiEndpoints,
        timeout = null,
        cancellable = false,
        strategy = null,
        flattenResponse = null,
        defaultResponse = {},
        logger = null,
        onError = null,
        ...config
    }: APIHandlerConfig) {
        this.apiUrl = apiUrl;
        this.apiEndpoints = apiEndpoints;
        this.logger = logger;

        this.httpRequestHandler = new HttpRequestHandler({
            ...config,
            baseURL: this.apiUrl,
            timeout,
            cancellable,
            strategy,
            flattenResponse,
            defaultResponse,
            logger,
            onError,
        });
    }

    /**
     * Get Provider Instance
     *
     * @returns {AxiosInstance} Provider's instance
     */
    public getInstance(): AxiosInstance {
        return this.httpRequestHandler.getInstance();
    }

    /**
     * Maps all API requests
     *
     * @param {*} prop          Caller
     * @returns {Function}      Tailored request function
     */
    public __get(prop: any): any {
        if (prop in this) {
            return this[prop];
        }

        // Prevent handler from running for non-existent endpoints
        if (!this.apiEndpoints[prop]) {
            return this.handleNonImplemented.bind(this, prop)
        }

        return this.handleRequest.bind(this, prop);
    }

    /**
     * Handle Single API Request
     *
     * @param {*} args      Arguments
     * @returns {Promise}   Resolvable API provider promise
     */
    public async handleRequest(...args: any): Promise<IRequestResponse> {
        const prop = args[0];
        const endpointSettings = this.apiEndpoints[prop];

        const queryParams = args[1] || {};
        const uriParams = args[2] || {};
        const requestConfig = args[3] || {};

        const uri = endpointSettings.url.replace(/:[a-z]+/ig, (str: string) => (uriParams[str.substr(1)] ? uriParams[str.substr(1)] : str));

        let responseData = null;

        const additionalRequestSettings = { ...endpointSettings };

        delete additionalRequestSettings.url;
        delete additionalRequestSettings.method;

        responseData = await this.httpRequestHandler[endpointSettings.method](uri, queryParams, {
            ...requestConfig,
            ...additionalRequestSettings,
        });

        return responseData;
    }

    /**
     * Triggered when trying to use non-existent endpoints
     *
     * @param prop Method Name
     * @returns {Promise}
     */
    protected handleNonImplemented(prop: string): Promise<any> {
        if (this.logger && this.logger.log) {
            this.logger.log(`${prop} endpoint not implemented.`)
        }

        return Promise.resolve(null);
    }
}

export const createApiFetcher = (options: APIHandlerConfig) => new ApiHandler(options);
