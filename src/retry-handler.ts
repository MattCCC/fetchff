import { applyInterceptors } from './interceptor-manager';
import type { FetchResponse, RetryConfig, RetryFunction } from './types';
import { delayInvocation, timeNow } from './utils';
import { generateCacheKey } from './cache-manager';

function getMsFromHttpDate(dateString: string): number | null {
  const ms = Date.parse(dateString) - timeNow();

  if (!isNaN(ms)) {
    return Math.max(0, Math.floor(ms));
  }
  return null;
}

/**
 * Calculates the number of milliseconds to wait before retrying a request,
 * based on the `Retry-After` HTTP header in the provided response.
 *
 * The function supports both numeric (seconds) and HTTP-date formats for the `Retry-After` header.
 * - If the header is a number, it is interpreted as seconds and converted to milliseconds.
 * - If the header is a date, the function calculates the difference between the date and the current time.
 *
 * @param extendedResponse - The response object containing headers, or `null`.
 * @returns The number of milliseconds to wait before retrying, or `null` if the header is not present or invalid.
 */
export function getRetryAfterMs(
  extendedResponse: FetchResponse | null,
): number | null {
  if (!extendedResponse) {
    return null;
  }

  const headers = extendedResponse.headers || {};
  const retryAfter = headers['retry-after'];

  if (retryAfter) {
    // Try parsing as seconds
    const seconds = Number(retryAfter);

    if (!isNaN(seconds) && seconds >= 0) {
      return seconds * 1000;
    }

    const ms = getMsFromHttpDate(retryAfter);

    if (ms !== null) {
      return ms;
    }
  }

  // Headers are already in lowercase
  const RATELIMIT_RESET = 'ratelimit-reset';

  // Unix timestamp when the rate limit window resets (relative to current time)
  // Fallback to checking 'ratelimit-reset-after' OR 'x-ratelimit-reset-after' headers
  const rateLimitResetAfter =
    headers[RATELIMIT_RESET + '-after'] ||
    headers['x-' + RATELIMIT_RESET + '-after'];

  if (rateLimitResetAfter) {
    const seconds = Number(rateLimitResetAfter);

    if (!isNaN(seconds)) {
      return seconds * 1000;
    }
  }

  // ISO 8601 datetime when the rate limit resets
  // Fallback to checking 'ratelimit-reset-at' 'x-ratelimit-reset-at' headers
  const rateLimitResetAt =
    headers[RATELIMIT_RESET + '-at'] || headers['x-' + RATELIMIT_RESET + '-at'];

  if (rateLimitResetAt) {
    return getMsFromHttpDate(rateLimitResetAt);
  }

  return null;
}

/**
 * Executes a request function with retry logic according to the provided configuration.
 *
 * The function attempts the request up to the specified number of retries, applying delay and backoff strategies.
 * Retries can be triggered based on response status codes, custom logic, or the presence of a `Retry-After` header.
 * Optionally, an `onRetry` interceptor can be invoked before each retry attempt.
 *
 * @typeParam ResponseData - The type of the response data.
 * @typeParam RequestBody - The type of the request body.
 * @typeParam QueryParams - The type of the query parameters.
 * @typeParam PathParams - The type of the path parameters.
 * @param requestFn - The function that performs the request. Receives `isStaleRevalidation` and `attempt` as arguments.
 * @param config - The retry configuration, including retry count, delay, backoff, retry conditions, and hooks.
 * @returns A promise resolving to the fetch response, or rejecting if all retries are exhausted.
 * @throws Error if the maximum number of retries is exceeded or a non-retriable error occurs.
 */
export async function withRetry<
  ResponseData,
  RequestBody,
  QueryParams,
  PathParams,
>(
  requestFn: (
    isStaleRevalidation: boolean,
    attempt: number,
  ) => Promise<
    FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>
  >,
  config: RetryConfig<ResponseData, RequestBody, QueryParams, PathParams>,
): Promise<FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>> {
  const {
    retries = 0,
    delay = 0,
    backoff = 1,
    maxDelay,
    retryOn = [],
    shouldRetry,
  } = config;

  let attempt = 0;
  let waitTime = delay;
  const maxRetries = retries > 0 ? retries : 0;
  let output: FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>;

  while (attempt <= maxRetries) {
    // Subsequent attempts will have output defined, but the first attempt may not.
    // Let's apply onRetry interceptor and regenerate cache key if ot really changes.
    if (attempt > 0 && output!) {
      const cfg = output.config;
      const onRetry = cfg.onRetry;

      if (onRetry) {
        await applyInterceptors(onRetry, output, attempt);

        // If the key was automatically generated, we need to regenerate it as config may change.
        // We don't detect whether config changed for performance reasons.
        if (cfg._isAutoKey) {
          cfg._prevKey = cfg.cacheKey as string;
          cfg.cacheKey = generateCacheKey(cfg, false);
        }
      }
    }

    output = await requestFn(true, attempt); // isStaleRevalidation=false, isFirstAttempt=attempt===0
    const error = output.error;

    // Check if we should retry based on successful response
    if (!error) {
      if (shouldRetry && attempt < maxRetries) {
        const shouldRetryResult = await shouldRetry(output, attempt);

        if (shouldRetryResult) {
          await delayInvocation(waitTime);
          waitTime *= backoff || 1;
          waitTime = Math.min(waitTime, maxDelay || waitTime);
          attempt++;
          continue;
        }
      }

      break;
    }

    // Determine if we should stop retrying
    const shouldStopRetrying = await getShouldStopRetrying(
      output,
      attempt,
      maxRetries,
      shouldRetry,
      retryOn,
    );

    if (shouldStopRetrying) {
      break;
    }

    // If we should not stop retrying, continue to the next attempt
    // Handle rate limiting if the error status is 429 (Too Many Requests) or 503 (Service Unavailable)
    if (error.status === 429 || error.status === 503) {
      // Try to extract the "Retry-After" value from the response headers
      const retryAfterMs = getRetryAfterMs(output);

      // If a valid retry-after value is found, override the wait time before next retry
      if (retryAfterMs !== null) {
        waitTime = retryAfterMs;
      }
    }

    await delayInvocation(waitTime);
    waitTime *= backoff || 1;
    waitTime = Math.min(waitTime, maxDelay || waitTime);
    attempt++;
  }

  return output!;
}

/**
 * Determines whether to stop retrying based on the error, current attempt count, and retry configuration.
 *
 * This function checks:
 * - If the maximum number of retries has been reached.
 * - If a custom `shouldRetry` callback is provided, its result is used to decide.
 * - If no custom logic is provided, falls back to checking if the error status is included in the `retryOn` list.
 *
 * @typeParam ResponseData - The type of the response data.
 * @typeParam RequestBody - The type of the request body.
 * @typeParam QueryParams - The type of the query parameters.
 * @typeParam PathParams - The type of the path parameters.
 * @param output - The response object containing the error and request configuration.
 * @param attempt - The current retry attempt number.
 * @param maxRetries - The maximum number of retry attempts allowed.
 * @param shouldRetry - Optional custom function to determine if a retry should occur.
 * @param retryOn - Optional list of HTTP status codes that should trigger a retry.
 * @returns A promise resolving to `true` if retrying should stop, or `false` to continue retrying.
 */
export async function getShouldStopRetrying<
  ResponseData,
  RequestBody,
  QueryParams,
  PathParams,
>(
  output: FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>,
  attempt: number,
  maxRetries: number,
  shouldRetry?: RetryFunction<
    ResponseData,
    RequestBody,
    QueryParams,
    PathParams
  > | null,
  retryOn: number[] = [],
): Promise<boolean> {
  // Safety first: always respect max retries
  // We check retries provided regardless of the shouldRetry being provided so to avoid infinite loops.
  // It is a fail-safe so to prevent excessive retry attempts even if custom retry logic suggests a retry.
  if (attempt === maxRetries) {
    return true;
  }

  let customDecision: boolean | null = null;

  // Get custom decision if shouldRetry is provided
  if (shouldRetry) {
    const result = await shouldRetry(output, attempt);
    customDecision = result;

    // Decision cascade:
    if (customDecision !== null) {
      return !customDecision;
    }
  }

  return !(retryOn || []).includes(output.error?.status ?? 0);
}
