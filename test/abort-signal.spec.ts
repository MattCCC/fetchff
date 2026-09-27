import { getEventListeners } from 'events';
import { createApiFetcher, fetchf } from '../src';
import { pruneCache } from '../src/cache-manager';
import { clearAllTimeouts } from '../src/timeout-wheel';

const jsonResponse = (status = 200) =>
  new Response(JSON.stringify({ ok: status < 300 }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Like the native fetch(), it responds after the given time, or rejects with the reason of the signal once it is aborted.
// It also records whether the signal was aborted already when the request was made, i.e. it wouldn't have been sent.
const mockFetch = (ms: number, ...statuses: number[]) => {
  const abortedOnSend: boolean[] = [];
  const fetchSpy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation((_url, init) => {
      const signal = init!.signal!;
      const status = statuses.shift() || 200;

      abortedOnSend.push(signal.aborted);

      return new Promise((resolve, reject) => {
        if (signal.aborted) {
          return reject(signal.reason);
        }

        const timer = setTimeout(() => resolve(jsonResponse(status)), ms);

        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(signal.reason);
        });
      });
    });

  return { fetchSpy, abortedOnSend };
};

describe('signal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    pruneCache();
    clearAllTimeouts();
    jest.useRealTimers();
  });

  it('should abort the request once the signal passed to it is aborted', async () => {
    const { fetchSpy } = mockFetch(1000);
    const controller = new AbortController();
    const promise = fetchf('/api/report', { signal: controller.signal });

    await jest.advanceTimersByTimeAsync(100);
    controller.abort();

    const response = await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]!.signal!.aborted).toBe(true);
    expect(response.error!.name).toBe('AbortError');
    expect(response.error!.isCancelled).toBe(true);
    expect(response.data).toBeNull();
  });

  it('should not send the request when its signal is aborted already', async () => {
    const { abortedOnSend } = mockFetch(1000);
    const controller = new AbortController();

    controller.abort();

    const response = await fetchf('/api/report', {
      signal: controller.signal,
    });

    expect(abortedOnSend).toEqual([true]);
    expect(response.error!.isCancelled).toBe(true);
  });

  it('should reject with the reason of the abort when rejectCancelled is true', async () => {
    mockFetch(1000);
    const controller = new AbortController();
    const promise = fetchf('/api/report', {
      signal: controller.signal,
      rejectCancelled: true,
    });

    controller.abort();

    await expect(promise).rejects.toBe(controller.signal.reason);
  });

  it('should reject with a custom reason of the abort, like fetch()', async () => {
    mockFetch(1000);
    const controller = new AbortController();
    const reason = new Error('The user left the page');
    const promise = fetchf('/api/report', { signal: controller.signal });

    controller.abort(reason);

    await expect(promise).rejects.toBe(reason);
  });

  it('should not be affected by the signal once the request is done', async () => {
    mockFetch(100);
    const controller = new AbortController();
    const promise = fetchf('/api/report', { signal: controller.signal });

    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(100);
    const response = await promise;

    // The request stopped listening to the signal
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);

    controller.abort();

    expect(response.error).toBeNull();
    expect(response.data).toEqual({ ok: true });
  });

  it('should keep the timeout of the request', async () => {
    mockFetch(5000);
    const controller = new AbortController();
    const promise = fetchf('/api/report', {
      signal: controller.signal,
      timeout: 1000,
    });

    const assertion = expect(promise).rejects.toMatchObject({
      name: 'TimeoutError',
    });

    await jest.advanceTimersByTimeAsync(1000);
    await assertion;

    expect(controller.signal.aborted).toBe(false);
  });

  it('should not retry the request once it is aborted', async () => {
    const { fetchSpy } = mockFetch(1000);
    const controller = new AbortController();
    const shouldRetry = jest.fn(() => true);
    const promise = fetchf('/api/report', {
      signal: controller.signal,
      retry: { retries: 3, delay: 100, shouldRetry },
    });

    await jest.advanceTimersByTimeAsync(500);
    controller.abort();

    const response = await promise;

    await jest.advanceTimersByTimeAsync(10000);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(shouldRetry).not.toHaveBeenCalled();
    expect(response.error!.isCancelled).toBe(true);
  });

  it('should not send retries once the signal is aborted during the retry delay', async () => {
    const { fetchSpy, abortedOnSend } = mockFetch(0, 500, 500, 500);
    const controller = new AbortController();
    const promise = fetchf('/api/report', {
      signal: controller.signal,
      retry: { retries: 3, delay: 1000, backoff: 1 },
    });

    await jest.advanceTimersByTimeAsync(500);
    controller.abort();
    await jest.advanceTimersByTimeAsync(500);

    const response = await promise;

    await jest.advanceTimersByTimeAsync(10000);

    // The retry after the delay isn't sent, as its signal is aborted already
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(abortedOnSend).toEqual([false, true]);
    expect(response.error!.isCancelled).toBe(true);
  });

  it('should stop polling once the signal is aborted', async () => {
    const { fetchSpy } = mockFetch(0);
    const controller = new AbortController();
    const shouldStopPolling = jest.fn(() => false);
    const promise = fetchf('/api/report', {
      signal: controller.signal,
      pollingInterval: 1000,
      shouldStopPolling,
    });

    await jest.advanceTimersByTimeAsync(1500);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    controller.abort();

    // Polling stops right away, instead of after the interval
    const response = await promise;

    await jest.advanceTimersByTimeAsync(10000);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(shouldStopPolling).toHaveBeenCalledTimes(2);
    expect(response.error).toBeNull();
    expect(response.data).toEqual({ ok: true });
  });

  it('should stop polling when the signal is aborted during a request', async () => {
    const { fetchSpy } = mockFetch(500);
    const controller = new AbortController();
    const promise = fetchf('/api/report', {
      signal: controller.signal,
      pollingInterval: 1000,
    });

    await jest.advanceTimersByTimeAsync(1600);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    controller.abort();

    const response = await promise;

    await jest.advanceTimersByTimeAsync(10000);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(response.error!.isCancelled).toBe(true);
  });

  it('should abort requests of createApiFetcher() endpoints', async () => {
    mockFetch(1000);
    const controller = new AbortController();
    const api = createApiFetcher({
      baseURL: 'https://example.com',
      endpoints: { getReport: { url: '/report' } },
    });

    const promise = api.getReport({ signal: controller.signal });

    controller.abort();

    const response = await promise;

    expect(response.error!.isCancelled).toBe(true);
  });
});
