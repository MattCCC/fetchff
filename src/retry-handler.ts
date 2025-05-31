import type { FetchResponse } from './types';

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
    const ms = date.getTime() - Date.now();

    return ms > 0 ? ms : 0;
  }

  return null;
}
