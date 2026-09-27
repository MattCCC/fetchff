export interface CacheEntry<T> {
  data: T;
  time: number;
  stale?: number; // Time in milliseconds when the cache entry is considered stale
  expiry?: number; // Time in milliseconds when the cache entry expires
}

/**
 * The copy of a response that is saved in a cache store.
 */
export interface StoredResponse<ResponseData = unknown> {
  data: ResponseData;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
}

/**
 * A store that keeps cached responses beyond the in-memory cache, e.g. in localStorage, IndexedDB or AsyncStorage.
 * Its methods can be synchronous or return promises, so e.g. a `Map` can be used as well.
 */
export interface CacheStore {
  /**
   * Returns the entry saved under the key, or `null`/`undefined` if there is none.
   */
  get(
    key: string,
  ):
    | CacheEntry<StoredResponse>
    | null
    | undefined
    | Promise<CacheEntry<StoredResponse> | null | undefined>;

  /**
   * Saves the entry under the key.
   */
  set(key: string, entry: CacheEntry<StoredResponse>): unknown;

  /**
   * Removes the entry saved under the key.
   */
  delete(key: string): unknown;
}
