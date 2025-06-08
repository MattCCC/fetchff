export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface MutationSettings {
  revalidate?: boolean;
}
