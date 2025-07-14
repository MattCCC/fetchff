import type { RequestConfig, FetchResponse } from './types';
import { delayInvocation } from './utils';

/**
 * Executes a request function with polling, stopping when shouldStopPolling returns true,
 * pollingInterval is not set, or maxAttempts is reached.
 *
 * @template Output The type of the output returned by the request function.
 * @param requestFn - The function that performs a single request (with retries).
 * @param pollingInterval - Interval in ms between polling attempts.
 * @param shouldStopPolling - Function to determine if polling should stop.
 * @param maxAttempts - Maximum number of polling attempts, default: 0 (unlimited).
 * @param pollingDelay - Delay in ms before each polling attempt, default: 0.
 * @returns The final output from the last request.
 */
export async function withPolling<
  ResponseData,
  RequestBody,
  QueryParams,
  PathParams,
>(
  requestFn: (
    isStaleRevalidation?: boolean,
    attempt?: number,
  ) => Promise<
    FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>
  >,
  pollingInterval?: RequestConfig['pollingInterval'],
  shouldStopPolling?: RequestConfig['shouldStopPolling'],
  maxAttempts = 0,
  pollingDelay = 0,
): Promise<FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>> {
  if (!pollingInterval) {
    return requestFn();
  }

  let pollingAttempt = 0;
  let output: FetchResponse<ResponseData, RequestBody, QueryParams, PathParams>;

  while (maxAttempts === 0 || pollingAttempt < maxAttempts) {
    if (pollingDelay > 0) {
      await delayInvocation(pollingDelay);
    }

    output = await requestFn();

    pollingAttempt++;

    if (
      (maxAttempts > 0 && pollingAttempt >= maxAttempts) ||
      !pollingInterval ||
      (shouldStopPolling && shouldStopPolling(output, pollingAttempt))
    ) {
      break;
    }

    await delayInvocation(pollingInterval);
  }

  return output!;
}
