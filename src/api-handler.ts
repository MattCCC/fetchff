/* eslint-disable @typescript-eslint/no-explicit-any */
import { applyMagic, MagicalClass } from 'js-magic';
import type {
  RequestResponse,
  APIHandlerConfig,
  EndpointsConfig,
  FetcherInstance,
  EndpointConfig,
} from './types/http-request';
import { RequestHandler } from './request-handler';
import type { APIQueryParams, APIUriParams } from './types/api';

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
   *
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
  public async handleRequest(
    prop: string,
    queryParams: APIQueryParams = {},
    uriParams: APIUriParams = {},
    requestConfig: EndpointConfig = {},
  ): Promise<RequestResponse> {
    // Use global per-endpoint settings
    const endpoint = this.endpoints[prop];
    const endpointSettings = { ...endpoint };

    const responseData = await this.requestHandler.handleRequest(
      endpointSettings.url,
      queryParams,
      {
        ...endpointSettings,
        ...requestConfig,
        uriParams,
      },
    );

    return responseData;
  }
}
