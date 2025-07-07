export interface CacheEntry<T> {
  data: T;
  time: number;
  stale?: number; // Time in milliseconds when the cache entry is considered stale
  expiry?: number; // Time in milliseconds when the cache entry expires
}
