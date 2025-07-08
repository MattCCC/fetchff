import type { ResponseError } from './errors/response-error';
import type {
  DefaultResponse,
  FetchResponse,
  RequestConfig,
} from './types/request-handler';
import { applyInterceptors } from './interceptor-manager';
import { handleResponseCache } from './cache-manager';
import { ABORT_ERROR, CANCELLED_ERROR, REJECT } from './constants';
import { DefaultParams, DefaultUrlParams, DefaultPayload } from './types';

/**
 * Handles final processing for both success and error responses
 * Applies error interceptors, caching, notifications, and error strategy
 */
export async function withErrorHandling<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
>(
  requestFn: () => Promise<
    FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>
  >,
  requestConfig: RequestConfig<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  >,
): Promise<FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>> {
  const output = await requestFn();
  const error = output.error;

  if (!error) {
    // SUCCESS PATH
    handleResponseCache(output, requestConfig);

    return output;
  }

  // ERROR PATH

  if (requestConfig.onError) {
    await applyInterceptors(requestConfig.onError, error);
  }

  // Timeouts and request cancellations using AbortController do not throw any errors unless rejectCancelled is true.
  // Only handle the error if the request was not cancelled, or if it was cancelled and rejectCancelled is true.
  const isCancelled = error.isCancelled;

  if (!isCancelled && requestConfig.logger) {
    logger(requestConfig, 'FETCH ERROR', error as ResponseError);
  }

  // Handle cache and notifications FIRST (before strategy)
  handleResponseCache(output, requestConfig, true);

  // handle error strategy as the last part
  const shouldHandleError = !isCancelled || requestConfig.rejectCancelled;

  if (shouldHandleError) {
    const strategy = requestConfig.strategy;
    // Reject the promise
    if (strategy === REJECT) {
      return Promise.reject(error);
    }

    // Hang the promise
    if (strategy === 'silent') {
      await new Promise(() => null);
    }
  }

  return output;
}

export function enhanceError<
  ResponseData = DefaultResponse,
  RequestBody = DefaultPayload,
  QueryParams = DefaultParams,
  PathParams = DefaultUrlParams,
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any,
  response: FetchResponse<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  > | null,
  requestConfig: RequestConfig<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  >,
): void {
  error.status = error.status || response?.status || 0;
  error.statusText = error.statusText || response?.statusText || '';
  error.config = error.request = requestConfig;
  error.response = response;
  error.isCancelled =
    error.name === ABORT_ERROR || error.name === CANCELLED_ERROR;
}

/**
 * Logs messages or errors using the configured logger's `warn` method.
 *
 * @param {RequestConfig} reqConfig - Request config passed when making the request
 * @param {...(string | ResponseError<any>)} args - Messages or errors to log.
 */
function logger(
  reqConfig: RequestConfig,
  ...args: (string | ResponseError)[]
): void {
  const logger = reqConfig.logger;

  if (logger && logger.warn) {
    logger.warn(...args);
  }
}
