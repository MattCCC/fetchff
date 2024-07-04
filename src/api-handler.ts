/* eslint-disable @typescript-eslint/no-explicit-any */
// 3rd party libs
import { applyMagic, MagicalClass } from 'js-magic';

// Types
import type { AxiosInstance } from 'axios';

import {
  RequestResponse,
  APIHandlerConfig,
  EndpointsConfig,
} from './types/http-request';

import { RequestHandler } from './request-handler';

/**
 * Handles dispatching of API requests
 */
@applyMagic
export class ApiHandler implements MagicalClass {
  /**
   * TS Index signature
   */
  [x: string]: unknown;

  /**
   * @var requestHandler Request Wrapper Instance
   */
  public requestHandler: RequestHandler;

  /**
   * Endpoints
   */
  protected endpoints: EndpointsConfig<string>;

  /**
   * Logger
   */
  protected logger: any;

  /**
   * Creates an instance of API Handler
   *
   * @param {string} config.apiUrl               Base URL for all API calls
   * @param {number} config.timeout              Request timeout
   * @param {string} config.strategy             Error Handling Strategy
   * @param {string} config.flattenResponse      Whether to flatten response "data" object within "data" one
   * @param {*} config.logger                    Instance of Logger Class
   * @param {*} config.onError                   Instance of Error Service Class
   */
  public constructor({
    axios,
    apiUrl,
    endpoints,
    timeout = null,
    cancellable = false,
    strategy = null,
    flattenResponse = null,
    defaultResponse = {},
    logger = null,
    onError = null,
    ...config
  }: APIHandlerConfig) {
    this.endpoints = endpoints;
    this.logger = logger;

    this.requestHandler = new RequestHandler({
      ...config,
      baseURL: apiUrl,
      axios,
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
    return this.requestHandler.getInstance();
  }

  /**
   * Maps all API requests
   *
   * @private
   * @param {*} prop          Caller
   * @returns {Function}      Tailored request function
   */
  public __get(prop: any): any {
    if (prop in this) {
      return this[prop];
    }

    // Prevent handler from running for non-existent endpoints
    if (!this.endpoints[prop]) {
      return this.handleNonImplemented.bind(this, prop);
    }

    return this.handleRequest.bind(this, prop);
  }

  /**
   * Handle Single API Request
   *
   * @param {*} args      Arguments
   * @returns {Promise}   Resolvable API provider promise
   */
  public async handleRequest(...args: string[]): Promise<RequestResponse> {
    const prop = args[0];
    const endpointSettings = this.endpoints[prop];

    const queryParams = args[1] || {};
    const uriParams = args[2] || {};
    const requestConfig = args[3] || {};

    const uri = endpointSettings.url.replace(/:[a-z]+/gi, (str: string) =>
      uriParams[str.substring(1)] ? uriParams[str.substring(1)] : str,
    );

    let responseData = null;

    const additionalRequestSettings = { ...endpointSettings };

    delete additionalRequestSettings.url;
    delete additionalRequestSettings.method;

    responseData = await this.requestHandler[
      (endpointSettings.method || 'get').toLowerCase()
    ](uri, queryParams, {
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
  protected handleNonImplemented(prop: string): Promise<null> {
    if (this.logger?.log) {
      this.logger.log(`${prop} endpoint not implemented.`);
    }

    return Promise.resolve(null);
  }
}

export const createApiFetcher = <AllEndpointsList = { [x: string]: unknown }>(
  options: APIHandlerConfig,
) => new ApiHandler(options) as ApiHandler & AllEndpointsList;
