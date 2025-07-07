import { applyInterceptors } from './interceptor-manager';
import type { FetchResponse, RetryConfig, RetryFunction } from './types';
import { delayInvocation, timeNow } from './utils';

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
  const retryAfter = extendedResponse?.headers?.['retry-after'];

  if (!retryAfter) {
    return null;
  }

  // Try parsing as seconds
  const seconds = Number(retryAfter);

  if (!isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  // Try parsing as HTTP-date
  const date = new Date(retryAfter);

  if (!isNaN(date.getTime())) {
    const ms = date.getTime() - timeNow();

    return ms > 0 ? ms : 0;
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
    output = await requestFn(false, attempt); // isStaleRevalidation=false, isFirstAttempt=attempt===0
    const error = output.error;

    // Check if we should retry based on successful response
    if (!error) {
      if (shouldRetry && attempt < maxRetries) {
        const shouldRetryResult = await shouldRetry(output, attempt);

        if (shouldRetryResult) {
          const onRetry = output.config.onRetry;

          if (onRetry) {
            applyInterceptors(onRetry, output, attempt);
          }

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
    // If the error status is 429 (Too Many Requests), handle rate limiting
    if (error.status === 429) {
      // Try to extract the "Retry-After" value from the response headers
      const retryAfterMs = getRetryAfterMs(output);

      // If a valid retry-after value is found, override the wait time before next retry
      if (retryAfterMs !== null) {
        waitTime = retryAfterMs;
      }
    }

    const onRetry = output.config.onRetry;

    if (onRetry) {
      applyInterceptors(onRetry, output, attempt);
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
  }

  // Decision cascade:
  if (customDecision !== null) {
    // shouldRetry explicitly says retry or not
    return !customDecision;
  }

  return !(retryOn || []).includes(output.error?.status ?? 0);
}
