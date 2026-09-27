import type { ResponseError } from './errors/response-error';
import type {
  DefaultResponse,
  FetchResponse,
  RequestConfig,
} from './types/request-handler';
import { applyInterceptors } from './interceptor-manager';
import { handleResponseCache } from './cache-manager';
import { ABORT_ERROR, REJECT } from './constants';
import {
  DefaultParams,
  DefaultUrlParams,
  DefaultPayload,
  HeadersObject,
} from './types';
import { processHeaders } from './utils';

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
  isStaleRevalidation: boolean,
  requestFn: (
    isStaleRevalidation: boolean,
  ) => Promise<
    FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>
  >,
  requestConfig: RequestConfig<
    ResponseData,
    QueryParams,
    PathParams,
    RequestBody
  >,
): Promise<FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>> {
  const output = await requestFn(isStaleRevalidation);
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

  if (!isCancelled && requestConfig.logger?.warn) {
    requestConfig.logger.warn(
      'FETCH ERROR',
      redactError(error as ResponseError),
    );
  }

  // The defaultResponse strategy returns the default response in place of the error data.
  // The original data stays available through error.response.
  if (requestConfig.strategy === 'defaultResponse') {
    output.data = (requestConfig.defaultResponse ?? null) as typeof output.data;
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

// Credential headers that must not end up in logs
const SENSITIVE_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'x-api-key',
];

/**
 * Creates a copy of the error for logging, with credential headers masked and the request body removed.
 * The error itself is left untouched.
 */
function redactError(error: ResponseError): ResponseError {
  // Cache keys are dropped too, as they can contain short request bodies
  const config = {
    ...error.config,
    body: undefined,
    data: undefined,
    cacheKey: undefined,
    _prevKey: undefined,
    headers: processHeaders(error.config.headers as HeadersObject),
  };

  for (const name of SENSITIVE_HEADERS) {
    if (config.headers[name]) {
      config.headers[name] = '[REDACTED]';
    }
  }

  const copy = Object.assign(new Error(error.message), error, {
    config,
    request: config,
    response: error.response && { ...error.response, config },
  });

  copy.name = error.name;
  copy.stack = error.stack;

  return copy;
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
  error.isCancelled = error.name === ABORT_ERROR;
}
