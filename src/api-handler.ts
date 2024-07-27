/* eslint-disable @typescript-eslint/no-explicit-any */
// 3rd party libs
import { applyMagic, MagicalClass } from 'js-magic';

import type {
  RequestResponse,
  APIHandlerConfig,
  EndpointsConfig,
  FetcherInstance,
} from './types/http-request';

import { RequestHandler } from './request-handler';

/**
 * Handles dispatching of API requests
 */
@applyMagic
export class ApiHandler<EndpointsList = { [x: string]: unknown }>
  implements MagicalClass
{
  /**
   * TS Index signature
   */
  [x: string]: unknown;

  /**
   * API Handler Config
   */
  public config: APIHandlerConfig<EndpointsList>;

  /**
   * Endpoints list
   */
  public endpoints: EndpointsConfig<string>;

  /**
   * Request Handler Instance
   */
  public requestHandler: RequestHandler;

  /**
   * Creates an instance of API Handler
   * @inheritdoc createApiFetcher()
   */
  public constructor(config: APIHandlerConfig<EndpointsList>) {
    this.config = config;
    this.endpoints = config.endpoints;
    this.requestHandler = new RequestHandler(config);
  }

  /**
   * Get Fetcher Provider Instance
   *
   * @returns {FetcherInstance} Provider's instance
   */
  public getInstance(): FetcherInstance {
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

    // Prevent handler from triggering non-existent endpoints
    if (!this.endpoints[prop]) {
      return this.handleNonImplemented.bind(this, prop);
    }

    return this.handleRequest.bind(this, prop);
  }

  /**
   * Triggered when trying to use non-existent endpoints
   *
   * @param prop Method Name
   * @returns {Promise}
   */
  protected handleNonImplemented(prop: string): Promise<null> {
    console.error(`${prop} endpoint must be added to 'endpoints'.`);

    return Promise.resolve(null);
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
}
