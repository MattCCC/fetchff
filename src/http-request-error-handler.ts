// Types
import {
    ErrorHandlingStrategy,
} from './types/http-request-handler';

export class HttpRequestErrorHandler {
    /**
     * Logger Class
     *
     * @type {*}
     * @memberof HttpRequestErrorHandler
     */
    public logger: any;

    /**
     * Error Service Class
     *
     * @type {*}
     * @memberof HttpRequestErrorHandler
     */
    public httpRequestErrorService: any;

    /**
     * @var strategy Request timeout
     *
     * @memberof HttpRequestHandler
     */
    public strategy: ErrorHandlingStrategy;

    /**
     * @var noThrowStrategies List of strategies excluded from error throwing
     *
     * @memberof HttpRequestHandler
     */
    public noThrowStrategies: ErrorHandlingStrategy[] = ['reject', 'silent'];

    public constructor(logger: any, httpRequestErrorService: any, strategy: ErrorHandlingStrategy) {
        this.logger = logger;
        this.httpRequestErrorService = httpRequestErrorService;
        this.strategy = strategy;
    }

    /**
     * Process and Error
     *
     * @param {*} error Error instance or message
     * @throws          Request error context
     * @returns {void}
     */
    public process(error: string | Error) {
        if (this.logger && this.logger.warn) {
            this.logger.warn('API ERROR', error);
        }

        let errorContext = error;

        if (typeof error === 'string') {
            errorContext = new Error(error);
        }

        if (this.httpRequestErrorService) {
            if (typeof this.httpRequestErrorService.process !== 'undefined') {
                this.httpRequestErrorService.process(errorContext);
            } else if (typeof this.httpRequestErrorService === 'function') {
                this.httpRequestErrorService(errorContext);
            }
        }

        if (!this.noThrowStrategies.includes(this.strategy)) {
            throw errorContext;
        }
    }
}