import type { FetchResponse } from '../src';
import { withPolling } from '../src/polling-handler';

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
