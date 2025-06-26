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

import { deleteCache } from 'fetchff';

export const INFINITE_CACHE_TIME = -1;

const cache = new Map<string, number>();

export const incrementRef = (key: string | null) => {
  if (!key) {
    return;
  }

  cache.set(key, (cache.get(key) || 0) + 1);
};

export const decrementRef = (key: string | null, cacheTime?: number) => {
  if (!key) {
    return;
  }

  const current = cache.get(key);

  if (!current) {
    return;
  }

  const newCount = current - 1;

  // If the current reference count is less than 2, we can consider deleting the global cache entry
  if (newCount <= 0 && cacheTime && cacheTime === INFINITE_CACHE_TIME) {
    cache.delete(key);

    setTimeout(() => {
      if (!getRefCount(key)) {
        deleteCache(key);
      }
    }, 2000); // Delay to ensure all operations are complete before deletion
  } else {
    cache.set(key, newCount);
  }
};

export const getRefCount = (key: string | null): number => {
  if (!key) {
    return 0;
  }

  return cache.get(key) || 0;
};

export const clearRefCache = () => {
  cache.clear();
};
