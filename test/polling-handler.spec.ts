import type { FetchResponse } from '../src';
import { withPolling } from '../src/polling-handler';
import { fetchf } from '../src';

async function flushPollingTimers(ms: number, times: number) {
  for (let i = 0; i < times; i++) {
    // Flush microtasks enough times for polling to work reliably
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  }
}

describe('withPolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should poll the specified number of times', async () => {
    let count = 0;
    const maxAttempts = 10;
    const pollingInterval = 10;
    const doRequestOnce = jest.fn(async () => {
      count++;
      return { ok: true } as FetchResponse;
    });

    const promise = withPolling(
      doRequestOnce,
      pollingInterval,
      undefined,
      10,
      0, // pollingDelay = 0
    );

    await flushPollingTimers(pollingInterval, maxAttempts - 1);

    // Should have polled at least 10 times
    await promise;

    expect(doRequestOnce).toHaveBeenCalledTimes(maxAttempts);
    expect(count).toBe(maxAttempts);
  });

  it('should stop polling if shouldStopPolling returns true', async () => {
    let count = 0;
    const doRequestOnce = jest.fn(async () => {
      count++;
      return { ok: true } as FetchResponse;
    });
    const shouldStopPolling = jest.fn((_output, attempt) => attempt === 1);
    const promise = withPolling(doRequestOnce, 1, shouldStopPolling, 10);
    await flushPollingTimers(1, 2);

    await promise;
    expect(count).toBe(1);
  });

  it('should break if maxAttempts is exceeded', async () => {
    let count = 0;
    const doRequestOnce = jest.fn(async () => {
      count++;
      return { ok: true } as FetchResponse;
    });
    const promise = withPolling(doRequestOnce, 1, () => false, 2);
    await flushPollingTimers(1, 2);

    await promise;
    expect(count).toBe(2);
  });

  it('should support pollingDelay before each attempt', async () => {
    let count = 0;
    const doRequestOnce = jest.fn(async () => {
      count++;
      return { ok: true } as FetchResponse;
    });
    const pollingDelay = 50; // Delay before each polling attempt
    const promise = withPolling(doRequestOnce, 1, undefined, 2, pollingDelay);

    // First polling attempt
    await flushPollingTimers(pollingDelay, 1); // 50ms delay before first polling attempt
    await flushPollingTimers(1, 1); // 1ms for pollingInterval
    // Second polling attempt after 50ms delay
    await flushPollingTimers(pollingDelay, 1); // 50ms delay before second polling attempt
    await flushPollingTimers(1, 1); // 1ms for pollingInterval

    await promise;
    expect(count).toBe(2);
  });

  it('should return the last output from doRequestOnce', async () => {
    const outputs = [{ ok: false }, { ok: true }];
    const doRequestOnce = jest
      .fn()
      .mockResolvedValueOnce(outputs[0])
      .mockResolvedValueOnce(outputs[1]);
    const promise = withPolling(doRequestOnce, 1, undefined, 2);
    await flushPollingTimers(1, 2);
    const result = await promise;
    expect(result).toBe(outputs[1]);
  });

  it('should only poll once if pollingInterval is 0', async () => {
    let count = 0;
    const doRequestOnce = jest.fn(async () => {
      count++;
      return { ok: true } as FetchResponse;
    });
    await withPolling(doRequestOnce, 0, undefined, 10);
    expect(count).toBe(1);
  });

  it('should throw if doRequestOnce rejects', async () => {
    const doRequestOnce = jest.fn().mockRejectedValue(new Error('fail'));
    await expect(withPolling(doRequestOnce, 1, undefined, 2)).rejects.toThrow(
      'fail',
    );
  });
});

describe('withPolling() while the page is hidden or offline', () => {
  const request = async () => ({ ok: true }) as FetchResponse;
  let restore = () => {};

  // Replaces a global like `document` or `navigator`, which Node.js lacks or doesn't let tests change
  function stubGlobal(name: 'document' | 'navigator', value: object) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);

    Object.defineProperty(globalThis, name, { value, configurable: true });

    restore = () => {
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        delete (globalThis as Record<string, unknown>)[name];
      }
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    restore();
    restore = () => {};
    jest.useRealTimers();
  });

  it('should pause while the page is hidden and resume once it is visible', async () => {
    const page = { visibilityState: 'hidden' };
    stubGlobal('document', page);
    const requestFn = jest.fn(request);

    const promise = withPolling(requestFn, 100, undefined, 3);

    // The first request is sent right away, the next ones wait for the page
    await jest.advanceTimersByTimeAsync(1000);
    expect(requestFn).toHaveBeenCalledTimes(1);

    page.visibilityState = 'visible';
    await jest.advanceTimersByTimeAsync(200);

    await promise;
    expect(requestFn).toHaveBeenCalledTimes(3);
  });

  it('should keep polling while the page is hidden if refreshWhenHidden is true', async () => {
    stubGlobal('document', { visibilityState: 'hidden' });
    const requestFn = jest.fn(request);

    const promise = withPolling(requestFn, 100, undefined, 3, 0, true);
    await jest.advanceTimersByTimeAsync(200);

    await promise;
    expect(requestFn).toHaveBeenCalledTimes(3);
  });

  it('should pause while offline and resume once back online', async () => {
    const connection = { onLine: false };
    stubGlobal('navigator', connection);
    const requestFn = jest.fn(request);

    const promise = withPolling(requestFn, 100, undefined, 3);

    await jest.advanceTimersByTimeAsync(1000);
    expect(requestFn).toHaveBeenCalledTimes(1);

    connection.onLine = true;
    await jest.advanceTimersByTimeAsync(200);

    await promise;
    expect(requestFn).toHaveBeenCalledTimes(3);
  });

  it('should keep polling while offline if refreshWhenOffline is true', async () => {
    stubGlobal('navigator', { onLine: false });
    const requestFn = jest.fn(request);

    const promise = withPolling(requestFn, 100, undefined, 3, 0, false, true);
    await jest.advanceTimersByTimeAsync(200);

    await promise;
    expect(requestFn).toHaveBeenCalledTimes(3);
  });

  it('should keep polling where the connection state is unknown', async () => {
    // Like in Node.js, where navigator exists without onLine
    stubGlobal('navigator', {});
    const requestFn = jest.fn(request);

    const promise = withPolling(requestFn, 100, undefined, 3);
    await jest.advanceTimersByTimeAsync(200);

    await promise;
    expect(requestFn).toHaveBeenCalledTimes(3);
  });

  it('should pause fetchf() polling while the page is hidden', async () => {
    const page = { visibilityState: 'hidden' };
    stubGlobal('document', page);
    const fetcher = jest.fn(async () => ({ data: 'ok' }));

    const promise = fetchf('/status', {
      pollingInterval: 100,
      maxPollingAttempts: 2,
      timeout: 0,
      fetcher,
    });

    await jest.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    page.visibilityState = 'visible';
    await jest.advanceTimersByTimeAsync(100);

    await promise;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('should keep fetchf() polling while the page is hidden if refreshWhenHidden is true', async () => {
    stubGlobal('document', { visibilityState: 'hidden' });
    const fetcher = jest.fn(async () => ({ data: 'ok' }));

    const promise = fetchf('/status', {
      pollingInterval: 100,
      maxPollingAttempts: 2,
      timeout: 0,
      refreshWhenHidden: true,
      fetcher,
    });

    await jest.advanceTimersByTimeAsync(100);

    await promise;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
