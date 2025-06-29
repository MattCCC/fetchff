export interface CacheEntry<T> {
  data: T;
  time: number;
}

export interface MutationSettings {
  revalidate?: boolean;
}
