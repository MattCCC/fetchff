import { ABORT_ERROR, TIMEOUT_ERROR } from './const';
import type { RequestConfig } from './types';
import type { QueueItem, RequestsQueue } from './types/queue-manager';

/**
 * Queue Manager is responsible for managing and controlling the flow of concurrent or sequential requests. It handles:
 * - Request Queueing and Deduplication
 * - Request Timeout Handling
 * - Abort Controller Management and Request Cancellation
 * - Concurrency Control and Locking
 * - Request Lifecycle Management
 */
const queue: RequestsQueue = new Map<RequestConfig, QueueItem>();

/**
 * Adds a request to the queue if it's not already being processed within the dedupeTime interval.
 *
 * @param {RequestConfig} config - The request configuration object.
 * @param {number} timeout - Timeout in milliseconds for the request.
 * @param {number} dedupeTime - Deduplication time in milliseconds.
 * @param {boolean} isCancellable - If true, then the previous request with same configuration should be aborted.
 * @param {boolean} isTimeoutEnabled - Whether timeout is enabled.
 * @returns {Promise<AbortController>} - A promise that resolves to an AbortController.
 */
export async function addRequest(
  config: RequestConfig,
  timeout: number | undefined,
  dedupeTime: number = 0,
  isCancellable: boolean = false,
  isTimeoutEnabled: boolean = true,
): Promise<AbortController> {
  const now = Date.now();
  const item = queue.get(config);

  if (item) {
    const isCancellable = item[3];
    const previousController = item[0];
    const timeoutId = item[1];

    // If the request is already in the queue and within the dedupeTime, reuse the existing controller
    if (!isCancellable && now - item[2] < dedupeTime) {
      return previousController;
    }

    // If the request is too old, remove it and proceed to add a new one
    // Abort previous request, if applicable, and continue as usual
    if (isCancellable) {
      previousController.abort(
        new DOMException('Aborted due to new request', ABORT_ERROR),
      );
    }

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    queue.delete(config);
  }

  const controller = new AbortController();

  const timeoutId = isTimeoutEnabled
    ? setTimeout(() => {
        const error = new DOMException(
          `${config.url} aborted due to timeout`,
          TIMEOUT_ERROR,
        );

        removeRequest(config, error);
      }, timeout)
    : null;

  queue.set(config, [controller, timeoutId, now, isCancellable]);

  return controller;
}

/**
 * Removes a request from the queue and clears its timeout.
 *
 * @param config - The request configuration.
 * @param {boolean} error - Error payload so to force the request to abort.
 */
export async function removeRequest(
  config: RequestConfig,
  error: DOMException | null | string = null,
): Promise<void> {
  const item = queue.get(config);

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

    queue.delete(config);
  }
}

/**
 * Gets the AbortController for a request configuration.
 *
 * @param config - The request configuration.
 * @returns {AbortController | undefined} - The AbortController or undefined.
 */
export async function getController(
  config: RequestConfig,
): Promise<AbortController | undefined> {
  const item = queue.get(config);

  return item?.[0];
}
