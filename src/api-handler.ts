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
    IHttpRequestHandler,
    IRequestResponse,
} from './types/http-request-handler';

// Shared Modules
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
     *
     * @memberof ApiHandler
     */
    public apiUrl = '';

    /**
     * @var httpRequestHandler Request Wrapper Instance
     */
    public httpRequestHandler: IHttpRequestHandler;

    /**
     * Endpoints
     *
     * @memberof ApiHandler
     */
    public apiEndpoints: Record<string, any>;

    /**
     * Logger
     *
     * @memberof ApiHandler
     */
    public logger: any;

    public constructor({
        apiUrl,
        apiEndpoints,
        strategy = null,
        logger = null,
        httpRequestErrorService = null,
    }) {
        this.apiUrl = apiUrl;
        this.apiEndpoints = apiEndpoints;
        this.logger = logger;

        this.httpRequestHandler = new HttpRequestHandler({
            baseURL: this.apiUrl,
            strategy,
            logger,
            httpRequestErrorService,
        });
    }

    /**
     * Get Provider Instance
     *
     * @returns {AxiosInstance} Provider's instance
     * @memberof HttpRequestHandler
     */
    public getInstance(): AxiosInstance {
        return this.httpRequestHandler.getInstance();
    }

    /**
     * Maps all API requests
     *
     * @param {*} prop          Caller
     * @returns {Function}      Tailored request function
     * @memberof ApiHandler
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
     * @memberof ApiHandler
     */
    public async handleRequest(...args: any): Promise<IRequestResponse> {
        const prop = args[0];
        const api = this.apiEndpoints[prop];
        const apiData = args[1] || {};
        const uriParams = args[2] || {};
        const uri = api.url.replace(/:[a-z]+/ig, (str: string) => (uriParams[str.substr(1)] ? uriParams[str.substr(1)] : str));
        const requestData = {
            ...apiData,
        };

        let responseData = null;

        responseData = await this.httpRequestHandler[api.method](uri, requestData);

        return responseData;
    }

    /**
     * Triggered when trying to use non-existent endpoints
     * @param prop Method Name
     */
    protected handleNonImplemented(prop: string) {
        if (this.logger && this.logger.log) {
            this.logger.log(`${prop} endpoint not implemented.`)
        }

        return Promise.resolve(null);
    }
}