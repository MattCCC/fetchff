/** All TypeScript types and interfaces */
export * from './types';

/** Core fetch function with caching, retries, and revalidation */
export { fetchf, fetchf as fetchff } from './request-handler';

/** Create a configured API fetcher instance */
export { createApiFetcher } from './api-handler';

/** Build and merge request configurations */
export {
  buildConfig, // Build request configuration from defaults and overrides
  setDefaultConfig, // Set global default configuration for requests
  getDefaultConfig, // Get the current global default configuration
} from './config-handler';

/** Cache management utilities */
export {
  generateCacheKey, // Generate cache key from URL and config
  getCache, // Get cached response for a key
  getCachedResponse, // Get cached response with revalidation
  mutate, // Update cache and notify subscribers
  setCache, // Set cache entry directly
  deleteCache, // Delete cache entry
} from './cache-manager';

/** Request Revalidation management for cache freshness */
export {
  revalidate, // Revalidate specific cache entry
  revalidateAll, // Revalidate all entries by event type
  removeRevalidators, // Clean up all revalidators by type
  setEventProvider, // Register custom event provider for focus/online events (e.g. React Native)
} from './revalidator-manager';

export type { EventProvider } from './revalidator-manager';

/** Subscribe to cache updates via pub/sub */
export { subscribe } from './pubsub-manager';

/** Abort in-flight requests and check request status */
export { abortRequest, getInFlightPromise } from './inflight-manager';

/** Network and environment utilities */
export { isSlowConnection, createAbortError } from './utils';

/** Timeout management for delayed operations */
export { addTimeout } from './timeout-wheel';
