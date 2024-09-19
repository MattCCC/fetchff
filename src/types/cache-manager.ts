export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isLoading: boolean;
}
