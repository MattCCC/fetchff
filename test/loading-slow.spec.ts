import {
  createApiFetcher,
  fetchf,
  removeRevalidators,
  revalidate,
  revalidateAll,
} from '../src';
import type { RequestConfig } from '../src';
import { defaultConfig } from '../src/config-handler';
import { pruneCache } from '../src/cache-manager';
import { clearAllTimeouts } from '../src/timeout-wheel';

// A custom fetcher that responds after the given time, or rejects once the request is aborted
const respondAfter = (ms: number, response: unknown = { data: 'ok' }) =>
  jest.fn(
    (_url: string, config?: RequestConfig | null) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms, response);

        config?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(config.signal!.reason);
        });
      }),
  );

describe('onLoadingSlow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    removeRevalidators('focus');
    pruneCache();
    clearAllTimeouts();
    jest.useRealTimers();
  });

  it('should be called once with the config when a request is still pending after loadingTimeout', async () => {
    const onLoadingSlow = jest.fn();
    const promise = fetchf('/report', {
      onLoadingSlow,
      loadingTimeout: 1000,
      timeout: 0,
      fetcher: respondAfter(5000),
    });

    await jest.advanceTimersByTimeAsync(999);
    expect(onLoadingSlow).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(onLoadingSlow).toHaveBeenCalledTimes(1);
    expect(onLoadingSlow).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/report', method: 'GET' }),
    );

    await jest.advanceTimersByTimeAsync(4000);
    await promise;
    expect(onLoadingSlow).toHaveBeenCalledTimes(1);
  });

  it('should not be called when the request finishes within loadingTimeout', async () => {
    const onLoadingSlow = jest.fn();
    const promise = fetchf('/report', {
      onLoadingSlow,
      loadingTimeout: 1000,
      timeout: 0,
      fetcher: respondAfter(500),
    });

    await jest.advanceTimersByTimeAsync(500);
    await promise;
    await jest.advanceTimersByTimeAsync(5000);

    expect(onLoadingSlow).not.toHaveBeenCalled();
  });

  it('should consider requests slow after 3 seconds by default', async () => {
    const onLoadingSlow = jest.fn();

    expect(defaultConfig.loadingTimeout).toBe(3000);

    const promise = fetchf('/report', {
      onLoadingSlow,
      timeout: 0,
      fetcher: respondAfter(5000),
    });

    await jest.advanceTimersByTimeAsync(2999);
    expect(onLoadingSlow).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(onLoadingSlow).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2000);
    await promise;
  });

  it('should not be called if loadingTimeout is 0', async () => {
    const onLoadingSlow = jest.fn();
    const promise = fetchf('/report', {
      onLoadingSlow,
      loadingTimeout: 0,
      timeout: 0,
      fetcher: respondAfter(5000),
    });

    await jest.advanceTimersByTimeAsync(5000);
    await promise;

    expect(onLoadingSlow).not.toHaveBeenCalled();
  });

  it('should call the interceptors of the global, endpoint and request configs in order', async () => {
    const calls: string[] = [];
    const api = createApiFetcher({
      baseURL: 'https://api.example.com',
      endpoints: {
        getReport: {
          url: '/report',
          onLoadingSlow: () => {
            calls.push('endpoint');
          },
        },
      },
      onLoadingSlow: () => {
        calls.push('global');
      },
      loadingTimeout: 1000,
      timeout: 0,
      fetcher: respondAfter(2000),
    });

    const promise = api.getReport({
      onLoadingSlow: [
        () => {
          calls.push('request');
        },
      ],
    });

    await jest.advanceTimersByTimeAsync(2000);
    await promise;

    expect(calls).toEqual(['global', 'endpoint', 'request']);
  });

  it('should not be called for background revalidations', async () => {
    const onLoadingSlow = jest.fn();
    const fetcher = respondAfter(2000);
    const promise = fetchf('/report', {
      cacheKey: 'report',
      cacheTime: 60,
      refetchOnFocus: true,
      onLoadingSlow,
      loadingTimeout: 1000,
      timeout: 0,
      fetcher,
    });

    await jest.advanceTimersByTimeAsync(2000);
    await promise;
    expect(onLoadingSlow).toHaveBeenCalledTimes(1);

    // Revalidations on focus update the data in the background
    revalidateAll('focus');
    await jest.advanceTimersByTimeAsync(2000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onLoadingSlow).toHaveBeenCalledTimes(1);

    // Explicit revalidations show a loading state
    const revalidation = revalidate('report');
    await jest.advanceTimersByTimeAsync(2000);
    await revalidation;
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(onLoadingSlow).toHaveBeenCalledTimes(2);
  });

  it('should count the time of all retries', async () => {
    const onLoadingSlow = jest.fn();
    const fetcher = respondAfter(400, new Response(null, { status: 500 }));
    const promise = fetchf('/report', {
      onLoadingSlow,
      loadingTimeout: 1000,
      timeout: 0,
      strategy: 'softFail',
      retry: { retries: 2, delay: 300, backoff: 1 },
      fetcher,
    });

    // 3 attempts of 400 ms with 300 ms between them
    await jest.advanceTimersByTimeAsync(1800);
    const { error } = await promise;

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(error?.status).toBe(500);
    expect(onLoadingSlow).toHaveBeenCalledTimes(1);
  });

  it('should not be called when the request times out first', async () => {
    const onLoadingSlow = jest.fn();
    const promise = fetchf('/report', {
      onLoadingSlow,
      loadingTimeout: 5000,
      timeout: 1000,
      strategy: 'softFail',
      fetcher: respondAfter(10000),
    });

    await jest.advanceTimersByTimeAsync(10000);
    const { error } = await promise;

    expect(error?.name).toBe('TimeoutError');
    expect(onLoadingSlow).not.toHaveBeenCalled();
  });

  it('should ignore errors thrown by the interceptors', async () => {
    const promise = fetchf('/report', {
      onLoadingSlow: () => {
        throw new Error('Interceptor failed');
      },
      loadingTimeout: 1000,
      timeout: 0,
      fetcher: respondAfter(2000),
    });

    await jest.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toMatchObject({ error: null });
  });
});
