/* eslint-disable @typescript-eslint/no-explicit-any */
export class RequestErrorHandler {
  /**
   * Logger Class
   *
   * @type {*}
   * @memberof RequestErrorHandler
   */
  protected logger: any;

  /**
   * Error Service Class
   *
   * @type {*}
   * @memberof RequestErrorHandler
   */
  public requestErrorService: any;

  public constructor(logger: any, requestErrorService: any) {
    this.logger = logger;
    this.requestErrorService = requestErrorService;
  }

  /**
   * Process and Error
   *
   * @param {*} error Error instance or message
   * @throws          Request error context
   * @returns {void}
   */
  public process(error: string | Error): void {
    if (this.logger?.warn) {
      this.logger.warn('API ERROR', error);
    }

    let errorContext = error;

    if (typeof error === 'string') {
      errorContext = new Error(error);
    }

    if (this.requestErrorService) {
      if (typeof this.requestErrorService.process !== 'undefined') {
        this.requestErrorService.process(errorContext);
      } else if (typeof this.requestErrorService === 'function') {
        this.requestErrorService(errorContext);
      }
    }
  }
}
