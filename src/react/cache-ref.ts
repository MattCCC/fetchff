/**
 * @module cache-ref
 *
 * Provides reference counting utilities for cache management in React applications.
 *
 * This module maintains an internal reference count for cache keys, allowing for
 * precise control over when cache entries should be deleted. It exports functions
 * to increment and decrement reference counts, retrieve the current count, and clear
 * all reference counts. When a reference count drops to zero and certain conditions
 * are met, the corresponding cache entry is scheduled for deletion.
 *
 * @see deleteCache
 */

import { abortRequest, deleteCache } from 'fetchff';

export const INFINITE_CACHE_TIME = -1;

const refs = new Map<string, number>();

export const incrementRef = (key: string | null) => {
  if (!key) {
    return;
  }

  refs.set(key, (refs.get(key) || 0) + 1);
};

export const decrementRef = (
  key: string | null,
  cacheTime?: number,
  dedupeTime?: number,
  url?: string | null,
) => {
  if (!key) {
    return;
  }

  const current = getRefCount(key);

  if (!current) {
    return;
  }

  const newCount = current - 1;

  // If the current reference count is less than 2, we can consider deleting the global cache entry
  // The infinite cache time is a special case where we never delete the cache entry unless the reference count drops to zero.
  // This allows for long-lived cache entries that are only deleted when explicitly no longer needed.
  if (newCount <= 0 && cacheTime && cacheTime === INFINITE_CACHE_TIME) {
    refs.delete(key);

    // Abort any ongoing requests associated with this cache key
    abortRequest(
      key,
      new DOMException('Request to ' + url + ' aborted', 'AbortError'),
    );

    setTimeout(() => {
      // Check if the reference count is still zero before deleting the cache as it might have been incremented again
      // This is to ensure that if another increment happens during the timeout, we don't delete the cache prematurely
      // This is particularly useful in scenarios where multiple components might be using the same cache
      // entry and we want to avoid unnecessary cache deletions.
      if (!getRefCount(key)) {
        deleteCache(key);
      }
    }, dedupeTime); // Delay to ensure all operations are complete before deletion
  } else {
    refs.set(key, newCount);
  }
};

export const getRefCount = (key: string | null): number => {
  if (!key) {
    return 0;
  }

  return refs.get(key) || 0;
};

export const getRefs = (): Map<string, number> => {
  return refs;
};

export const clearRefCache = () => {
  refs.clear();
};
