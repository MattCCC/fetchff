import type { RequestConfig } from './request-handler';

export type RequestsQueue = WeakMap<RequestConfig, QueueItem>;

export interface QueueItem {
  controller: AbortController;
  timeoutId?: NodeJS.Timeout | null;
  timestamp: number;
}
