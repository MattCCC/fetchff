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
import { addTimeout, removeTimeout } from './timeout-wheel';
import { FetchResponse } from './types';
import { isBrowser, noop, timeNow } from './utils';

export type RevalidatorFn = (
  isStaleRevalidation?: boolean,
) => Promise<FetchResponse | null>;

type EventType = 'focus' | 'online';

type RevalidatorEntry = [
  RevalidatorFn, // main revalidator
  number, // lastUsed
  number, // ttl
  number?, // staleTime
  RevalidatorFn?, // bgRevalidator
  boolean?, // refetchOnFocus
  boolean?, // refetchOnReconnect
];

const DEFAULT_TTL = 3 * 60 * 1000; // Default TTL of 3 minutes
const revalidators = new Map<string, RevalidatorEntry>();

/**
 * Stores cleanup functions for active event handlers (browser or custom providers).
 * Each entry removes the corresponding event listener when called.
 * @remarks
 * - Improves performance by reducing the number of event listeners.
 * - Enables efficient O(1) lookup and management of event handlers for revalidation.
 */
const eventHandlers = new Map<string, () => void>();

/** Subscribe to an event and return a cleanup function */
export type EventProvider = (handler: () => void) => () => void;

const customEventProviders = new Map<EventType, EventProvider>();

/**
 * Registers a custom event provider for 'focus' or 'online' events.
 * Useful for non-browser environments like React Native.
 *
 * @param type - The event type ('focus' or 'online').
 * @param provider - A function that subscribes to the event and returns a cleanup function.
 */
export function setEventProvider(
  type: EventType,
  provider: EventProvider,
): void {
  customEventProviders.set(type, provider);

  // Re-register if already active
  if (eventHandlers.has(type)) {
    removeEventHandler(type);
    addEventHandler(type);
  }
}

/**
 * Triggers revalidation for all registered entries based on the given event type.
 * For example, if it's a 'focus' event, it will revalidate entries that have the `refetchOnFocus` flag set.
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

  for (const entry of revalidators.values()) {
    if (!entry[flagIndex]) {
      continue;
    }

    entry[1] = now;

    // If it's a stale revalidation, use the background revalidator function
    const revalidator = isStaleRevalidation ? entry[4] : entry[0];

    if (revalidator) {
      Promise.resolve(revalidator(isStaleRevalidation)).catch(noop);
    }
  }
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
      return await revalidator(isStaleRevalidation);
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
 * Supports browser window events and custom event providers (e.g. for React Native).
 * Ensures the handler is only added once.
 *
 * @param event - The type of event to listen for (e.g., 'focus', 'online').
 */
function addEventHandler(event: EventType) {
  if (eventHandlers.has(event)) {
    return;
  }

  const handler = revalidateAll.bind(null, event, true);

  // Priority 1: Custom event provider (works in any environment including React Native)
  const customProvider = customEventProviders.get(event);

  if (customProvider) {
    const cleanup = customProvider(handler);

    eventHandlers.set(event, cleanup);

    return;
  }

  // Priority 2: Browser window events
  if (isBrowser()) {
    window.addEventListener(event, handler);

    eventHandlers.set(event, () => window.removeEventListener(event, handler));
  }
}

/**
 * Removes the event handler for the specified event type.
 *
 * @param event - The type of event whose handler should be removed.
 */
function removeEventHandler(event: EventType) {
  const cleanup = eventHandlers.get(event);

  if (cleanup) {
    cleanup();
    eventHandlers.delete(event);
  }
}

/**
 * Registers a revalidation functions for a specific cache key.
 *
 * @param {string} key Cache key to utilize
 * @param {RevalidatorFn} revalidatorFn Main revalidation function (marks in-flight requests)
 * @param {number} [ttl] Time to live in milliseconds (default: 3 minutes)
 * @param {number} [staleTime] Time (in seconds) after which the cache entry is considered stale
 * @param {RevalidatorFn} [bgRevalidatorFn] For stale revalidation (does not mark in-flight requests)
 * @param {boolean} [refetchOnFocus] Whether to revalidate on window focus
 * @param {boolean} [refetchOnReconnect] Whether to revalidate on network reconnect
 */
export function addRevalidator(
  key: string,
  revalidatorFn: RevalidatorFn, // Main revalidation function (marks in-flight requests)
  ttl?: number,
  staleTime?: number,
  bgRevalidatorFn?: RevalidatorFn, // For stale revalidation (does not mark in-flight requests)
  refetchOnFocus?: boolean,
  refetchOnReconnect?: boolean,
) {
  const existing = revalidators.get(key);

  if (existing) {
    // Update in-place to avoid allocating a new tuple array
    existing[0] = revalidatorFn;
    existing[1] = timeNow();
    existing[2] = ttl ?? DEFAULT_TTL;
    existing[3] = staleTime;
    existing[4] = bgRevalidatorFn;
    existing[5] = refetchOnFocus;
    existing[6] = refetchOnReconnect;
  } else {
    revalidators.set(key, [
      revalidatorFn,
      timeNow(),
      ttl ?? DEFAULT_TTL,
      staleTime,
      bgRevalidatorFn,
      refetchOnFocus,
      refetchOnReconnect,
    ]);
  }

  if (refetchOnFocus) {
    addEventHandler('focus');
  }

  if (refetchOnReconnect) {
    addEventHandler('online');
  }

  if (staleTime) {
    addTimeout('s:' + key, revalidate.bind(null, key, true), staleTime * 1000);
  }
}

export function removeRevalidator(key: string) {
  revalidators.delete(key);

  // Clean up stale timer
  removeTimeout('s:' + key);
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
      ([, lastUsed, ttl, , , refetchOnFocus, refetchOnReconnect], key) => {
        // Skip focus-only or reconnect-only revalidators to keep them alive
        if (refetchOnFocus || refetchOnReconnect) {
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
