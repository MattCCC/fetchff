import { UNDEFINED } from './constants';

const revalidators = new Map<string, () => Promise<void>>();

export function registerRevalidator(key: string, fn: () => Promise<void>) {
  revalidators.set(key, fn);
}

export function unregisterRevalidator(key: string) {
  revalidators.delete(key);

  disableFocusRevalidation(key);
}
/**
 * Revalidates a cache entry by executing the registered revalidation function.
 *
 * @param {string} key Cache key to utilize
 * @returns {Promise<void | null>} - A promise that resolves when the revalidation is complete or null if no revalidator is found.
 */
export async function revalidate(key: string): Promise<void | null> {
  const fn = revalidators.get(key);

  if (fn) {
    return await fn();
  }

  // If no revalidator is registered for the key, return null
  return null;
}

let hasAttachedFocusHandler = false;
const focusRevalidateKeys = new Set<string>();

/**
 * Enables revalidation on window focus for a specific key.
 * When the window gains focus, it will revalidate the cache entry associated with the key.
 *
 * @param {string} key Cache key to utilize
 */
export function enableFocusRevalidation(key: string) {
  focusRevalidateKeys.add(key);
}
export function disableFocusRevalidation(key: string) {
  focusRevalidateKeys.delete(key);
}

function revalidateAllOnFocus() {
  focusRevalidateKeys.forEach(revalidate);
}

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

  window.removeEventListener('focus', revalidateAllOnFocus);
}
