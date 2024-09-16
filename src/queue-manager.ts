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
  timeout: number,
  dedupeTime: number = 0,
  isCancellable: boolean = false,
  isTimeoutEnabled: boolean = true,
): Promise<AbortController> {
  const now = Date.now();
  const item = queue.get(config);

  if (item) {
    // If the request is already in the queue and within the dedupeTime, reuse the existing controller
    if (!item.isCancellable && now - item.timestamp < dedupeTime) {
      return item.controller;
    }

    // If the request is too old, remove it and proceed to add a new one
    // Abort previous request, if applicable, and continue as usual
    if (item.isCancellable) {
      item.controller.abort(
        new DOMException('Aborted due to new request', 'AbortError'),
      );
    }

    if (item.timeoutId !== null) {
      clearTimeout(item.timeoutId);
    }

    queue.delete(config);
  }

  const controller = new AbortController();

  const timeoutId = isTimeoutEnabled
    ? setTimeout(() => {
        const error = new DOMException(
          `${config.url} aborted due to timeout`,
          'TimeoutError',
        );

        removeRequest(config, error);
      }, timeout)
    : null;

  queue.set(config, { controller, timeoutId, timestamp: now, isCancellable });

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
    // If the request is not yet aborted, abort it with the provided error
    if (error && !item.controller.signal.aborted) {
      item.controller.abort(error);
    }

    if (item.timeoutId !== null) {
      clearTimeout(item.timeoutId);
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

  return item?.controller;
}
