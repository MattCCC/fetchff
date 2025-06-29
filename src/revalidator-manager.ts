/**
 * @module revalidator-manager
 *
 * Provides utilities for managing cache revalidation functions, including:
 * - Registering and unregistering revalidators for specific cache keys.
 * - Triggering revalidation for a given key.
 * - Enabling or disabling automatic revalidation on window focus and if user comes back online for specific keys.
 * - Attaching and removing global focus and online event handlers to trigger revalidation.
 *
 * Revalidators are functions that can be registered to revalidate cache entries when needed.
 * They are typically used to refresh data in the cache when the window gains focus or when specific actions occur.
 * @performance O(1) lookup by key makes it blazing fast to register, unregister, and revalidate cache entries.
 * - Designed for high performance: minimizes unnecessary re-renders and leverages fast cache key generation.
 * - Integrates with a global cache and pub/sub system for efficient state updates across contexts.
 * - Handles automatic revalidation, deduplication, retries, and cache management out of the box.
 * @remarks
 * - Designed to be used in various environments (Deno, Node.js, Bun, Browser, etc.) to ensure cache consistency and freshness.
 */
import { FetchResponse } from './types';
import { isBrowser, timeNow } from './utils';

export type RevalidatorFn = () => Promise<FetchResponse | null>;

type EventType = 'focus' | 'online';

type RevalidatorEntry = [
  RevalidatorFn, // main revalidator
  number, // lastUsed
  number, // ttl
  number?, // staleTime
  RevalidatorFn?, // bgRevalidator
  boolean?, // revalidateOnFocus
  boolean?, // revalidateOnReconnect
];

const DEFAULT_TTL = 3 * 60 * 1000; // Default TTL of 3 minutes
const revalidators = new Map<string, RevalidatorEntry>();
const staleTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Stores global event handlers for cache revalidation events (e.g., focus, online).
 * This avoids attaching multiple event listeners by maintaining a single handler per event type.
 * Event handlers are registered as needed when revalidators are registered with the corresponding flags.
 * @remarks
 * - Improves performance by reducing the number of event listeners.
 * - Enables efficient O(1) lookup and management of event handlers for revalidation.
 */
const eventHandlers = new Map<string, () => void>();

/**
 * Triggers revalidation for all registered entries based on the given event type.
 * For example, if it's a 'focus' event, it will revalidate entries that have the `revalidateOnFocus` flag set.
 * Updates the timestamp and invokes the revalidator function for each applicable entry.
 *
 * @param type - The type of event that caused the revalidation (e.g., 'focus' or 'online').
 * @param isStaleRevalidation - If `true`, uses background revalidator and doesn't mark as in-flight.
 */
export function revalidateAll(
  type: EventType,
  isStaleRevalidation: boolean = true,
) {
  const flagIndex = type === 'focus' ? 5 : 6;
  const now = timeNow();

  revalidators.forEach((entry) => {
    if (!entry[flagIndex]) {
      return;
    }

    entry[1] = now;

    // If it's a stale revalidation, use the background revalidator function
    const revalidator = isStaleRevalidation ? entry[4] : entry[0];

    if (revalidator) {
      Promise.resolve(revalidator()).catch(() => {});
    }
  });
}

/**
 * Revalidates an entry by executing the registered revalidation function.
 *
 * @param key The unique identifier for the cache entry to revalidate. If `null`, no revalidation occurs.
 * @param isStaleRevalidation - If `true`, it does not mark revalidated requests as in-flight.
 * @returns A promise that resolves to the result of the revalidator function, or
 *          `null` if no key or revalidator is found, or a `FetchResponse` if applicable.
 */
export async function revalidate<T = unknown>(
  key: string | null,
  isStaleRevalidation: boolean = false,
): Promise<T | null | FetchResponse> {
  // If no key is provided, no revalidation occurs
  if (!key) {
    return null;
  }

  const entry = revalidators.get(key);

  if (entry) {
    // Update only the lastUsed timestamp without resetting the whole array
    entry[1] = timeNow();

    const revalidator = isStaleRevalidation ? entry[4] : entry[0];

    // If no revalidator function is registered, return null
    if (revalidator) {
      return await revalidator();
    }
  }

  // If no revalidator is registered for the key, return null
  return null;
}

/**
 * Removes all revalidators associated with the specified event type.
 *
 * @param type - The event type whose revalidators should be removed.
 */
export function removeRevalidators(type: EventType) {
  removeEventHandler(type);

  const flagIndex = type === 'focus' ? 5 : 6;

  // Clear all revalidators with this flag
  revalidators.forEach((entry, key) => {
    if (entry[flagIndex]) {
      removeRevalidator(key);
    }
  });
}

/**
 * Registers a generic revalidation event handler for the specified event type.
 * Ensures the handler is only added once and only in browser environments.
 *
 * @param event - The type of event to listen for (e.g., 'focus', 'visibilitychange').
 */
function addEventHandler(event: EventType) {
  if (!isBrowser() || eventHandlers.has(event)) {
    return;
  }

  const handler = revalidateAll.bind(null, event, true);

  eventHandlers.set(event, handler);
  window.addEventListener(event, handler);
}

/**
 * Removes the generic event handler for the specified event type from the window object.
 *
 * @param event - The type of event whose handler should be removed.
 */
function removeEventHandler(event: EventType) {
  if (!isBrowser()) {
    return;
  }

  const handler = eventHandlers.get(event);

  if (handler) {
    window.removeEventListener(event, handler);

    eventHandlers.delete(event);
  }
}

/**
 * Registers a revalidation functions for a specific cache key.
 *
 * @param {string} key Cache key to utilize
 * @param {RevalidatorFn} revalidatorFn Main revalidation function (marks in-flight requests)
 * @param {number} [ttl] Time to live in milliseconds (default: 3 minutes)
 * @param {number} [staleTime] Time after which the cache entry is considered stale
 * @param {RevalidatorFn} [bgRevalidatorFn] For stale revalidation (does not mark in-flight requests)
 * @param {boolean} [revalidateOnFocus] Whether to revalidate on window focus
 * @param {boolean} [revalidateOnReconnect] Whether to revalidate on network reconnect
 */
export function addRevalidator(
  key: string,
  revalidatorFn: RevalidatorFn, // Main revalidation function (marks in-flight requests)
  ttl?: number,
  staleTime?: number,
  bgRevalidatorFn?: RevalidatorFn, // For stale revalidation (does not mark in-flight requests)
  revalidateOnFocus?: boolean,
  revalidateOnReconnect?: boolean,
) {
  revalidators.set(key, [
    revalidatorFn,
    timeNow(),
    ttl ?? DEFAULT_TTL,
    staleTime,
    bgRevalidatorFn,
    revalidateOnFocus,
    revalidateOnReconnect,
  ]);

  if (revalidateOnFocus) {
    addEventHandler('focus');
  }

  if (revalidateOnReconnect) {
    addEventHandler('online');
  }

  if (staleTime) {
    const timer = setTimeout(() => {
      revalidate(key, true).catch(() => {});
    }, staleTime);

    staleTimers.set(key, timer);
  }
}

export function removeRevalidator(key: string) {
  revalidators.delete(key);

  // Clean up stale timer
  const timer = staleTimers.get(key);

  if (timer) {
    clearTimeout(timer);
    staleTimers.delete(key);
  }
}

/**
 * Periodically cleans up expired revalidators from the registry.
 * Removes any revalidator whose TTL has expired.
 *
 * @param {number} intervalMs How often to run cleanup (default: 3 minutes)
 * @returns {() => void} A function to stop the periodic cleanup
 */
export function startRevalidatorCleanup(
  intervalMs: number = DEFAULT_TTL,
): () => void {
  const intervalId = setInterval(() => {
    const now = timeNow();

    revalidators.forEach(
      (
        [, lastUsed, ttl, , , revalidateOnFocus, revalidateOnReconnect],
        key,
      ) => {
        // Skip focus-only or reconnect-only revalidators to keep them alive
        if (revalidateOnFocus || revalidateOnReconnect) {
          return;
        }

        if (ttl > 0 && now - lastUsed > ttl) {
          removeRevalidator(key);
        }
      },
    );
  }, intervalMs);

  return () => clearInterval(intervalId);
}
