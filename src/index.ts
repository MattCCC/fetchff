/** Core fetch function with caching, retries, and revalidation */
export { fetchf } from './request-handler';

/** Create a configured API fetcher instance */
export { createApiFetcher } from './api-handler';

/** Subscribe to cache updates via pub/sub */
export { subscribe } from './pubsub-manager';

/** Abort in-flight requests and check request status */
export { abortRequest, getInFlightPromise } from './inflight-manager';

/** Cache management utilities */
export {
  generateCacheKey, // Generate cache key from URL and config
  getCachedResponse, // Get cached response for a key
  mutate, // Update cache and notify subscribers
  setCache, // Set cache entry directly
  deleteCache, // Delete cache entry
} from './cache-manager';

/** Request Revalidation management for cache freshness */
export {
  revalidate, // Revalidate specific cache entry
  revalidateAll, // Revalidate all entries by event type
  removeRevalidators, // Clean up all revalidators by type
} from './revalidator-manager';

/** Build and merge request configurations */
export { buildConfig } from './config-handler';

/** All TypeScript types and interfaces */
export * from './types';
