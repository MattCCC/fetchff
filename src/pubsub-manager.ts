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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener<T = any> = (response: T) => void;

const listeners = new Map<string, Set<Listener>>();

function ensureListenerSet(key: string) {
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }

  return listeners.get(key)!;
}

export function addListener<T>(key: string, fn: Listener<T>): Set<Listener<T>> {
  return ensureListenerSet(key).add(fn);
}

export function removeListener<T>(key: string, fn: Listener<T>) {
  const set = listeners.get(key);

  if (set) {
    set.delete(fn);
  }
}

export function notifySubscribers<T>(key: string, response: T) {
  const fns = listeners.get(key);

  if (fns) {
    fns.forEach((fn) => fn(response));
  }
}

export function subscribe<T>(key: string, fn: (response: T) => void) {
  const set = addListener<T>(key, fn);

  // Return an unsubscribe function
  return () => {
    set.delete(fn);

    // If the set is empty, remove the key from the listeners map
    if (set.size === 0) {
      listeners.delete(key);
    }
  };
}
