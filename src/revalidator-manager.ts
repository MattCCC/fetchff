/**
 * @module revalidator-manager
 *
 * Provides utilities for managing cache revalidation functions, including:
 * - Registering and unregistering revalidators for specific cache keys.
 * - Triggering revalidation for a given key.
 * - Enabling or disabling automatic revalidation on window focus for specific keys.
 * - Attaching and removing global focus event handlers to trigger revalidation.
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
import { UNDEFINED } from './constants';
import { FetchResponse } from './types';

export type RevalidatorFn = () => Promise<FetchResponse | null>;

type RevalidatorEntry = [RevalidatorFn, number, number]; // [revalidator, lastUsed, ttl]

const DEFAULT_TTL = 3 * 60 * 1000; // Default TTL of 3 minutes
const FOCUS_REVALIDATORS_SUFFIX = '|F';
const revalidators = new Map<string, RevalidatorEntry>();

export function registerRevalidator(
  key: string,
  fn: RevalidatorFn,
  ttl: number = DEFAULT_TTL,
) {
  revalidators.set(key, [fn, Date.now(), ttl]);
}

export function unregisterManualRevalidator(key: string) {
  revalidators.delete(key);
}

export function registerRevalidators(
  key: string,
  revalidatorFn: RevalidatorFn,
  revalidatorOnFocus: boolean,
  ttl: number = DEFAULT_TTL,
) {
  registerRevalidator(key, revalidatorFn, ttl);

  if (revalidatorOnFocus) {
    initFetchffRevalidationOnFocus();

    enableFocusRevalidation(
      key + FOCUS_REVALIDATORS_SUFFIX,
      revalidatorFn,
      ttl,
    );
  }
}

export function unregisterAllRevalidators(key: string) {
  unregisterManualRevalidator(key);
  unregisterFocusRevalidator(key + FOCUS_REVALIDATORS_SUFFIX);
}

/**
 * Revalidates an entry by executing the registered revalidation function.
 *
 * @param {string | null} key Cache key to utilize. If null, no revalidation occurs.
 * @returns {Promise<T | void | null>} - A promise that resolves when the revalidation is complete or null if no revalidator is found.
 */
export async function revalidate<T = unknown>(
  key: string | null,
): Promise<T | null | FetchResponse> {
  // If no key is provided, no revalidation occurs
  if (key === null) {
    return null;
  }

  const entry = revalidators.get(key);

  if (entry) {
    // Update only the lastUsed timestamp without resetting the whole array
    entry[1] = Date.now();

    return await entry[0]?.();
  }

  // If no revalidator is registered for the key, return null
  return null;
}

/**
 * Focus revalidation allows the application to automatically revalidate cache entries
 * when the window gains focus. This is useful for ensuring that data is fresh when the user
 * returns to the page after switching tabs or minimizing the browser.
 * It avoids the need for multiple event listeners by using a single global focus handler.
 * This gives performance benefits by avoiding many event listeners.
 * @performance O(1) lookup by key makes it blazing fast to register, unregister, and revalidate cache entries.
 **/
let hasAttachedFocusHandler = false;

/**
 * Enables revalidation on window focus for a specific key.
 * When the window gains focus, it will revalidate the cache entry associated with the key.
 *
 * @param {string} key Cache key to utilize
 * @param {RevalidatorFn | null} revalidatorFn Function to revalidate the cache entry
 * @param {number} ttl Time to live in milliseconds (default: 3 minutes)
 */
export function enableFocusRevalidation(
  key: string,
  revalidatorFn: RevalidatorFn | null = null,
  ttl: number = DEFAULT_TTL,
) {
  if (!revalidatorFn || !hasAttachedFocusHandler) {
    return;
  }

  revalidators.set(key + FOCUS_REVALIDATORS_SUFFIX, [
    revalidatorFn,
    Date.now(),
    ttl,
  ]);
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
    const now = Date.now();
    revalidators.forEach(([, lastUsed, ttl], key) => {
      if (ttl > 0 && now - lastUsed > ttl) {
        revalidators.delete(key);
      }
    });
  }, intervalMs);

  return () => clearInterval(intervalId);
}
/**
 * Disables revalidation on window focus for a specific key.
 * This will prevent the cache entry associated with the key from being revalidated when the window gains focus.
 *
 * @param {string} key Cache key to utilize
 */
export function unregisterFocusRevalidator(key: string) {
  if (!hasAttachedFocusHandler) {
    return;
  }

  revalidators.delete(key + FOCUS_REVALIDATORS_SUFFIX);
}

function revalidateAllOnFocus() {
  const now = Date.now();

  revalidators.forEach((entry, key) => {
    // Only process focus revalidators (keys ending with FOCUS_REVALIDATORS_SUFFIX)
    if (!key.endsWith(FOCUS_REVALIDATORS_SUFFIX)) {
      return;
    }

    const ttl = entry[2];

    // Clean up expired entries
    if (ttl > 0 && now - entry[1] > entry[2]) {
      revalidators.delete(key);
      return;
    }

    // Update only the lastUsed timestamp in-place
    entry[1] = now;

    // Fire-and-forget, swallow errors
    Promise.resolve(entry[0]?.()).catch(() => {});
  });
}

/**
 * Initializes a single global focus event listener to revalidate all registered keys
 * when the window gains focus. This gives performance benefits by avoiding many event listeners.
 *
 * This is useful for ensuring that cache entries are fresh when the user returns
 * to the page after switching tabs or minimizing the browser.
 */
export function initFetchffRevalidationOnFocus() {
  // If we're in a non-browser environment or the focus handler is already attached, do nothing
  if (typeof window === UNDEFINED || hasAttachedFocusHandler) {
    return;
  }

  hasAttachedFocusHandler = true;

  // Attach the focus event listener to revalidate all keys when the window gains focus
  window.addEventListener('focus', revalidateAllOnFocus);
}

export function removeFetchffRevalidationOnFocus() {
  if (typeof window === UNDEFINED || !hasAttachedFocusHandler) {
    return;
  }

  hasAttachedFocusHandler = false;

  // Remove the focus event listener to stop revalidating on focus
  window.removeEventListener('focus', revalidateAllOnFocus);
}
