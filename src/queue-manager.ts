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
const queue: RequestsQueue = new WeakMap<RequestConfig, QueueItem>();
const locks = new WeakMap<object, Promise<void>>();

/**
 * Ensures that the operation on the queue is performed atomically.
 *
 * @param fn - The function to be executed with lock.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
export async function withLock<T>(
  key: object,
  fn: () => Promise<T>,
): Promise<T> {
  let release: () => void;
  const lock = new Promise<void>((resolve) => (release = resolve));

  // Wait for existing locks to be released
  if (locks.has(key)) {
    await locks.get(key);
  }

  locks.set(key, lock);

  try {
    return await fn();
  } finally {
    release();
    locks.delete(key);
  }
}

/**
 * Adds a request to the queue if it's not already being processed within the dedupeTime interval.
 *
 * @param {RequestConfig} config - The request configuration object.
 * @param {number} timeout - Timeout in milliseconds for the request.
 * @param {number} dedupeTime - Deduplication time in milliseconds.
 * @param {boolean} isCancellable - If true, then the previous request with same configuration should be aborted.
 * @param {boolean} resetTimeout - Whether to reset the timeout.
 * @returns {Promise<AbortController>} - A promise that resolves to an AbortController.
 */
export async function addRequest(
  config: RequestConfig,
  timeout: number,
  dedupeTime: number = 0,
  isCancellable: boolean = false,
  resetTimeout: boolean = false,
): Promise<AbortController> {
  return withLock(config, async () => {
    const now = Date.now();
    const existingItem = queue.get(config);

    if (existingItem) {
      // If the request is already in the queue and within the dedupeTime, reuse the existing controller
      if (now - existingItem.timestamp < dedupeTime) {
        return existingItem.controller;
      }

      // Abort previous request, if applicable, and continue as usual
      if (isCancellable) {
        existingItem.controller.abort();
      }

      // If the request is too old, remove it and proceed to add a new one
      removeRequest(config);
    }

    // Create a new AbortController and add the request to the queue
    const controller = new AbortController();

    // Set up a timeout to automatically abort the request if it exceeds the specified time.
    const timeoutId =
      // Timeout might be already set and we may not want to reset it, so do not create it when "resetTimeout" is set to "true"
      timeout > 0 && !resetTimeout
        ? setTimeout(() => {
            const error = new Error(`${config.url} aborted due to timeout`);
            error.name = 'TimeoutError';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (error as any).code = 23; // DOMException.TIMEOUT_ERR

            controller.abort(error);
            removeRequest(config);
          }, timeout)
        : null;

    queue.set(config, { controller, timeoutId, timestamp: now });
    return controller;
  });
}

/**
 * Removes a request from the queue and clears its timeout.
 *
 * @param config - The request configuration.
 */
export async function removeRequest(config: RequestConfig): Promise<void> {
  await withLock(config, async () => {
    const item = queue.get(config);

    if (item) {
      if (item.timeoutId !== null) {
        clearTimeout(item.timeoutId);
      }
      queue.delete(config);
    }
  });
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
  let controller: AbortController | undefined;

  await withLock(config, async () => {
    const item = queue.get(config);
    controller = item?.controller;
  });

  return controller;
}
