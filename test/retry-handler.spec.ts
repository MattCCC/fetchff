/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchf } from '../src';
import type { RetryConfig } from '../src';
import { getRetryAfterMs, getShouldStopRetrying } from '../src/retry-handler';
import { pruneCache } from '../src/cache-manager';
import { clearAllTimeouts } from '../src/timeout-wheel';

describe('getRetryAfterMs', () => {
  it('returns null if response is null', () => {
    expect(getRetryAfterMs(null)).toBeNull();
  });

  it('returns null if headers are missing', () => {
    expect(getRetryAfterMs({ headers: undefined } as any)).toBeNull();
  });

  it('returns null if retry-after header is missing', () => {
    expect(getRetryAfterMs({ headers: {} } as any)).toBeNull();
  });

  it('parses seconds value correctly', () => {
    expect(getRetryAfterMs({ headers: { 'retry-after': '10' } } as any)).toBe(
      10000,
    );
  });

  it('parses zero seconds correctly', () => {
    expect(getRetryAfterMs({ headers: { 'retry-after': '0' } } as any)).toBe(0);
  });

  it('parses HTTP-date correctly (future date)', () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = getRetryAfterMs({ headers: { 'retry-after': future } } as any);
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThanOrEqual(5000);
  });

  it('returns 0 for HTTP-date in the past', () => {
    const past = new Date(Date.now() - 10000).toUTCString();
    expect(getRetryAfterMs({ headers: { 'retry-after': past } } as any)).toBe(
      0,
    );
  });

  it('returns null for invalid retry-after value', () => {
    expect(
      getRetryAfterMs({ headers: { 'retry-after': 'not-a-date' } } as any),
    ).toBeNull();
  });

  it('parses ratelimit-reset-after header', () => {
    expect(
      getRetryAfterMs({ headers: { 'ratelimit-reset-after': '5' } } as any),
    ).toBe(5000);
  });

  it('parses x-ratelimit-reset-after header', () => {
    expect(
      getRetryAfterMs({ headers: { 'x-ratelimit-reset-after': '3' } } as any),
    ).toBe(3000);
  });

  it('parses ratelimit-reset-at header with future date', () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = getRetryAfterMs({
      headers: { 'ratelimit-reset-at': future },
    } as any);
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThanOrEqual(5000);
  });

  it('parses x-ratelimit-reset-at header with future date', () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = getRetryAfterMs({
      headers: { 'x-ratelimit-reset-at': future },
    } as any);
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThanOrEqual(5000);
  });

  it('returns null for invalid ratelimit-reset-at value', () => {
    expect(
      getRetryAfterMs({
        headers: { 'ratelimit-reset-at': 'not-a-date' },
      } as any),
    ).toBeNull();
  });
});

describe('retry', () => {
  let fetchMock: jest.SpyInstance;
  let requestTimes: number[];

  // A server that fails with the given statuses, then succeeds
  const mockServer = (...statuses: number[]) => {
    requestTimes = [];
    fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      const status = statuses.shift() || 200;

      requestTimes.push(Date.now());

      return new Response(null, {
        status,
        headers: status === 429 ? { 'Retry-After': '3' } : {},
      });
    });
  };

  // Sends a request, and returns the delays before its retries
  const getRetryDelays = async (
    retry: RetryConfig,
    method = 'GET',
  ): Promise<number[]> => {
    const start = requestTimes.length;
    const promise = fetchf('https://api.example.com/books', {
      method,
      retry,
      strategy: 'softFail',
    });

    await jest.runAllTimersAsync();
    await promise;

    return requestTimes
      .slice(start + 1)
      .map((time, index) => time - requestTimes[start + index]);
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    pruneCache();
    clearAllTimeouts();
    jest.useRealTimers();
  });

  describe('methods', () => {
    it.each(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE'])(
      'should retry %s requests on the retryOn statuses by default',
      async (method) => {
        mockServer(500, 503);

        const delays = await getRetryDelays({ retries: 3, delay: 100 }, method);

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(delays).toHaveLength(2);
      },
    );

    it.each(['POST', 'PATCH'])(
      'should not retry %s requests on the retryOn statuses by default',
      async (method) => {
        mockServer(500, 503);

        await getRetryDelays({ retries: 3, delay: 100 }, method);

        expect(fetchMock).toHaveBeenCalledTimes(1);
      },
    );

    it('should retry the methods in the methods setting', async () => {
      mockServer(500, 500, 500);

      await getRetryDelays(
        { retries: 1, delay: 100, methods: ['post'] },
        'POST',
      );
      await getRetryDelays({ retries: 1, delay: 100, methods: ['POST'] });

      // POST is retried once, while GET isn't retried
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should let shouldRetry retry requests of any method', async () => {
      mockServer(500);

      const shouldRetry = jest.fn(() => true);

      await getRetryDelays({ retries: 1, delay: 100, shouldRetry }, 'POST');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(shouldRetry).toHaveBeenCalledTimes(1);
    });

    it('should retry all methods without the methods setting', async () => {
      const output = {
        error: { status: 500 },
        config: { method: 'POST' },
      } as any;

      await expect(
        getShouldStopRetrying(output, 0, 3, null, [500]),
      ).resolves.toBe(false);
      await expect(
        getShouldStopRetrying(output, 0, 3, null, [500], ['GET']),
      ).resolves.toBe(true);
    });
  });

  describe('jitter', () => {
    it('should wait the delays computed from delay, backoff and maxDelay without jitter', async () => {
      mockServer(500, 500, 500, 500);

      const delays = await getRetryDelays({
        retries: 4,
        delay: 1000,
        backoff: 2,
        maxDelay: 5000,
      });

      expect(delays).toEqual([1000, 2000, 4000, 5000]);
    });

    it('should wait random delays up to the computed ones with jitter', async () => {
      mockServer(500, 500, 500);
      jest.spyOn(Math, 'random').mockReturnValue(0.25);

      const delays = await getRetryDelays({
        retries: 3,
        delay: 1000,
        backoff: 2,
        jitter: true,
      });

      expect(delays).toEqual([250, 500, 1000]);
    });

    it('should wait the delays returned by a jitter function', async () => {
      mockServer(500, 500, 500);

      const jitter = jest.fn((delay: number) => delay + 100);
      const delays = await getRetryDelays({
        retries: 3,
        delay: 1000,
        backoff: 2,
        jitter,
      });

      // The function gets the computed delays, which don't include the jitter of previous delays
      expect(jitter.mock.calls).toEqual([[1000], [2000], [4000]]);
      expect(delays).toEqual([1100, 2100, 4100]);
    });

    it('should wait the delay that the server asks for with Retry-After without jitter', async () => {
      mockServer(429, 500);
      jest.spyOn(Math, 'random').mockReturnValue(0.25);

      const delays = await getRetryDelays({
        retries: 2,
        delay: 1000,
        backoff: 2,
        retryOn: [429, 500],
        jitter: true,
      });

      // The backoff continues from the delay of the server, with jitter: 3000 * 2 * 0.25
      expect(delays).toEqual([3000, 1500]);
    });

    it('should apply jitter to retries of successful responses', async () => {
      mockServer();
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const delays = await getRetryDelays({
        retries: 2,
        delay: 1000,
        jitter: true,
        shouldRetry: (_response, attempt) => attempt < 1,
      });

      expect(delays).toEqual([500]);
    });
  });
});
