/**
 * Manages the "in-flight" state of asynchronous operations identified by a key.
 *
 * Provides utilities to mark a key as in-flight, unmark it, check its state,
 * subscribe to in-flight state changes, and execute functions with automatic
 * in-flight state management to prevent duplicate requests.
 *
 * @module inflight-manager
 */

import { notifySubscribers } from './pubsub-manager';

const inFlight = new Set<string>();

export function markInFlight(key: string) {
  inFlight.add(key);

  notifySubscribers(key, { isFetching: true });
}

export function unmarkInFlight(key: string) {
  inFlight.delete(key);
}

export function isInFlight(key: string) {
  return inFlight.has(key);
}

/**
 * Executes a function while marking a key as in-flight.
 * This is useful for preventing duplicate requests for the same resource.
 *
 * @param {string} key - The key to mark as in-flight.
 * @param {() => T} fn - The function to execute.
 * @returns {Promise<T>} - The result of the function execution.
 */
export async function withInFlight<T>(key: string, fn: () => T): Promise<T> {
  if (!key) {
    return fn();
  }

  markInFlight(key);

  try {
    return fn();
  } finally {
    unmarkInFlight(key);
  }
}
