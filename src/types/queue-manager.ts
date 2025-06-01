import type { RequestConfig } from './request-handler';

export type RequestsQueue = WeakMap<RequestConfig, QueueItem>;

type timeoutId = NodeJS.Timeout | null;
type timestamp = number;
type isCancellable = boolean;

export type QueueItem = [
  AbortController,
  timeoutId,
  timestamp,
  isCancellable,
  Promise<unknown>?,
];
