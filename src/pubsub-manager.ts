/**
 * Manages a set of listeners (subscribers) for arbitrary string keys, allowing cross-context or cross-component
 * cache updates and synchronization. Provides functions to add, remove, and notify listeners, as well as a
 * convenient subscribe/unsubscribe API.
 *
 * @template T - The type of the response object passed to listeners.
 *
 * @remarks
 * - Listeners are grouped by a string key, which typically represents a cache key or resource identifier.
 * - When `notifySubscribers` is called for a key, all listeners registered for that key are invoked with the provided response.
 * - The `subscribe` function returns an unsubscribe function for convenient cleanup.
 *
 * @example
 * ```ts
 * const unsubscribe = subscribe('user:123', (response) => {
 *   // handle updated data
 * });
 * // Later, to stop listening:
 * unsubscribe();
 * ```
 */

import { noop } from './utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener<T = any> = (response: T) => void;

const listeners = new Map<string, Set<Listener>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addListener<T = any>(key: string, fn: Listener<T>): void {
  let set = listeners.get(key);

  if (!set) {
    listeners.set(key, (set = new Set()));
  }

  set.add(fn);
}

export function removeListener<T>(key: string, fn: Listener<T>) {
  const set = listeners.get(key);

  if (set) {
    set.delete(fn);

    // If the set is empty, remove the key from the listeners map
    if (set.size === 0) {
      listeners.delete(key);
    }
  }
}

export function notifySubscribers<T>(key: string, response: T) {
  const fns = listeners.get(key);

  if (fns) {
    if (fns.size === 1) {
      // If there's only one listener, call it directly
      const fn = fns.values().next().value;
      fn!(response);
    } else {
      fns.forEach((fn) => fn(response));
    }
  }
}

export function subscribe<T>(key: string | null, fn: (response: T) => void) {
  if (!key) {
    // No op if no key is provided
    return noop;
  }

  addListener<T>(key, fn);

  // Return an unsubscribe function
  return () => {
    removeListener(key, fn);
  };
}
