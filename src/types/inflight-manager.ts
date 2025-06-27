type timeoutId = NodeJS.Timeout | null;
type timestamp = number;
type isCancellable = boolean;
type RequestPromise = Promise<unknown>;

export type InFlightItem = [
  AbortController,
  timeoutId,
  timestamp,
  isCancellable,
  RequestPromise?,
];
