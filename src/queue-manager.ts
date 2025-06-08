import { ABORT_ERROR, TIMEOUT_ERROR } from './constants';
import type { QueueItem } from './types/queue-manager';

/**
 * Queue Manager is responsible for managing and controlling the flow of concurrent or sequential requests. It handles:
 * - Request Queueing and Deduplication
 * - Request Timeout Handling
 * - Abort Controller Management and Request Cancellation
 * - Concurrency Control and Locking
 * - Request Lifecycle Management
 */
const queue: Map<string, QueueItem> = new Map();

/**
 * Adds a request to the queue if it's not already being processed within the dedupeTime interval.
 *
 * @param {string | null} key - Unique key for the request (e.g. cache key).
 * @param {string} url - The request URL (for error messages/timeouts).
 * @param {number} timeout - Timeout in milliseconds for the request.
 * @param {number} dedupeTime - Deduplication time in milliseconds.
 * @param {boolean} isCancellable - If true, then the previous request with same configuration should be aborted.
 * @param {boolean} isTimeoutEnabled - Whether timeout is enabled.
 * @returns {Promise<AbortController>} - A promise that resolves to an AbortController.
 */
export async function queueRequest(
  key: string | null,
  url: string,
  timeout: number | undefined,
  dedupeTime: number = 0,
  isCancellable: boolean = false,
  isTimeoutEnabled: boolean = true,
): Promise<AbortController> {
  if (!key) {
    return new AbortController();
  }

  const now = Date.now();
  const item = queue.get(key);

  if (item) {
    const prevIsCancellable = item[3];
    const previousController = item[0];
    const timeoutId = item[1];

    // If the request is already in the queue and within the dedupeTime, reuse the existing controller
    if (!prevIsCancellable && now - item[2] < dedupeTime) {
      return previousController;
    }

    // If the request is too old, remove it and proceed to add a new one
    // Abort previous request, if applicable, and continue as usual
    if (prevIsCancellable) {
      previousController.abort(
        new DOMException('Aborted due to new request', ABORT_ERROR),
      );
    }

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    queue.delete(key);
  }

  const controller = new AbortController();

  const timeoutId = isTimeoutEnabled
    ? setTimeout(() => {
        const error = new DOMException(
          `${url} aborted due to timeout`,
          TIMEOUT_ERROR,
        );

        removeRequestFromQueue(key, error);
      }, timeout)
    : null;

  queue.set(key, [controller, timeoutId, now, isCancellable]);

  return controller;
}

/**
 * Removes a request from the queue and clears its timeout.
 *
 * @param key - Unique key for the request.
 * @param {boolean} error - Error payload so to force the request to abort.
 */
export async function removeRequestFromQueue(
  key: string | null,
  error: DOMException | null | string = null,
): Promise<void> {
  // If the key is not in the queue, there's nothing to remove
  if (!key) {
    return;
  }

  const item = queue.get(key);

  if (item) {
    const controller = item[0];
    const timeoutId = item[1];

    // If the request is not yet aborted, abort it with the provided error
    if (error && !controller.signal.aborted) {
      controller.abort(error);
    }

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    queue.delete(key);
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
  const item = queue.get(key);

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
  const item = queue.get(key);
  if (item) {
    // store the promise at index 4
    item[4] = promise;

    queue.set(key, item);
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

  const item = queue.get(key);

  if (
    item &&
    item[4] &&
    Date.now() - item[2] < dedupeTime &&
    // If one request is cancelled, ALL deduped requests get cancelled
    !item[0].signal.aborted
  ) {
    return item[4] as Promise<T>;
  }

  return null;
}
