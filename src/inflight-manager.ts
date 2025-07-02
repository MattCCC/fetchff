/**
 * @module inflight-manager
 *
 * Manages in-flight asynchronous requests using unique keys to enable deduplication and cancellation.
 *
 * Provides utilities for:
 * - Deduplication of requests within a configurable time window (`dedupeTime`)
 * - Timeout management and automatic request abortion
 * - AbortController lifecycle and cancellation logic
 * - Concurrency control and request state tracking
 * - In-flight promise deduplication to prevent duplicate network calls
 *
 * @remarks
 * - Requests with the same key within the deduplication interval share the same AbortController and in-flight promise.
 * - Supports cancellation of previous requests when a new one with the same key is issued, if `isCancellable` is enabled.
 * - Timeout logic ensures requests are aborted after a specified duration, if enabled.
 * - Internal queue state is managed via a Map, keyed by request identifier.
 * - Polled requests are also marked as "in-flight" to prevent duplicate requests.
 */

import { ABORT_ERROR, TIMEOUT_ERROR } from './constants';
import { addTimeout, removeTimeout } from './timeout-wheel';
import { timeNow } from './utils';

export type InFlightItem = [
  AbortController, // AbortController for the request
  boolean, // Whether timeout is enabled for the request
  number, // Timestamp when the request was marked in-flight
  boolean, // isCancellable - whether the request can be cancelled
  Promise<unknown> | null, // Optional in-flight promise for deduplication
];

const inFlight: Map<string, InFlightItem> = new Map();

/**
 * Adds a request to the queue if it's not already being processed within the dedupeTime interval.
 *
 * @param {string | null} key - Unique key for the request (e.g. cache key).
 * @param {string} url - The request URL (for error messages/timeouts).
 * @param {number} timeout - Timeout in milliseconds for the request.
 * @param {number} dedupeTime - Deduplication time in milliseconds.
 * @param {boolean} isCancellable - If true, then the previous request with same configuration should be aborted.
 * @param {boolean} isTimeoutEnabled - Whether timeout is enabled.
 * @returns {AbortController} - A promise that resolves to an AbortController.
 */
export function markInFlight(
  key: string | null,
  url: string,
  timeout: number | undefined,
  dedupeTime: number,
  isCancellable: boolean,
  isTimeoutEnabled: boolean,
): AbortController {
  if (!key) {
    return new AbortController();
  }

  const item = inFlight.get(key);
  let prevPromise: Promise<unknown> | null = null;

  // Previous request is in-flight, check if we can reuse it
  if (item) {
    const prevController = item[0];
    const prevIsCancellable = item[3];

    // If the request is already in the queue and within the dedupeTime, reuse the existing controller
    if (
      !prevIsCancellable &&
      timeNow() - item[2] < dedupeTime &&
      !prevController.signal.aborted
    ) {
      return prevController;
    }

    // If the request is too old, remove it and proceed to add a new one
    // Abort previous request, if applicable, and continue as usual
    if (prevIsCancellable) {
      prevController.abort(
        new DOMException('Aborted due to new request', ABORT_ERROR),
      );
    }

    removeTimeout(key);
    prevPromise = item[4];
  }

  const controller = new AbortController();

  inFlight.set(key, [
    controller,
    isTimeoutEnabled,
    timeNow(),
    isCancellable,
    prevPromise,
  ]);

  if (isTimeoutEnabled) {
    addTimeout(
      key,
      () => {
        abortRequest(
          key,
          new DOMException(url + ' aborted due to timeout', TIMEOUT_ERROR),
        );
      },
      timeout as number,
    );
  }

  return controller;
}

/**
 * Removes a request from the queue and clears its timeout.
 *
 * @param key - Unique key for the request.
 * @param {boolean} error - Optional error to abort the request with. If null, the request is simply removed but no abort sent.
 * @returns {Promise<void>} - A promise that resolves when the request is aborted and removed.
 */
export async function abortRequest(
  key: string | null,
  error: DOMException | null | string = null,
): Promise<void> {
  // If the key is not in the queue, there's nothing to remove
  if (key) {
    const item = inFlight.get(key);

    if (item) {
      const controller = item[0];

      // If the request is not yet aborted, abort it with the provided error
      if (error) {
        controller.abort(error);
      }

      removeTimeout(key);
      inFlight.delete(key);
    }
  }
}

/**
 * Gets the AbortController for a request key.
 *
 * @param key - Unique key for the request.
 * @returns {AbortController | undefined} - The AbortController or undefined.
 */
export async function getController(
  key: string,
): Promise<AbortController | undefined> {
  const item = inFlight.get(key);

  return item?.[0];
}

/**
 * Adds helpers for in-flight promise deduplication.
 *
 * @param key - Unique key for the request.
 * @param promise - The promise to store.
 */
export function setInFlightPromise(
  key: string,
  promise: Promise<unknown>,
): void {
  const item = inFlight.get(key);
  if (item) {
    // store the promise at index 4
    item[4] = promise;

    inFlight.set(key, item);
  }
}

/**
 * Retrieves the in-flight promise for a request key if it exists and is within the dedupeTime interval.
 *
 * @param key - Unique key for the request.
 * @param dedupeTime - Deduplication time in milliseconds.
 * @returns {Promise<T> | null} - The in-flight promise or null.
 */
export function getInFlightPromise<T = unknown>(
  key: string | null,
  dedupeTime: number,
): Promise<T> | null {
  if (!key) {
    return null;
  }

  const prevReq = inFlight.get(key);

  if (
    prevReq &&
    // If the request is in-flight and has a promise
    prevReq[4] &&
    // If the request is cancellable, we will not reuse it
    !prevReq[3] &&
    // If the request is within the dedupeTime
    timeNow() - prevReq[2] < dedupeTime &&
    // If one request is cancelled, ALL deduped requests get cancelled
    !prevReq[0].signal.aborted
  ) {
    return prevReq[4] as Promise<T>;
  }

  return null;
}
