/** All TypeScript types and interfaces */
export type * from './types';

/** Core fetch function with caching, retries, and revalidation */
export { fetchf } from './request-handler';

/** Create a configured API fetcher instance */
export { createApiFetcher } from './api-handler';

/** Build and merge request configurations */
export {
  buildConfig, // Build request configuration from defaults and overrides
  setDefaultConfig, // Set global default configuration for requests
} from './config-handler';

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

/** Subscribe to cache updates via pub/sub */
export { subscribe } from './pubsub-manager';

/** Abort in-flight requests and check request status */
export { abortRequest, getInFlightPromise } from './inflight-manager';

/** Network and environment utilities (Browser Only) */
export { isSlowConnection } from './utils';
