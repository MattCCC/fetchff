/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRequestHandler } from '../src/request-handler';
import fetchMock from 'fetch-mock';
import * as interceptorManager from '../src/interceptor-manager';
import { delayInvocation } from '../src/utils';
import type {
  RequestConfig,
  RequestHandlerReturnType,
} from '../src/types/request-handler';
import { fetchf } from '../src';
import { ABORT_ERROR } from '../src/constants';
import { pruneCache } from '../src/cache-manager';

jest.mock('../src/utils', () => {
  const originalModule = jest.requireActual('../src/utils');

  return {
    ...originalModule,
    delayInvocation: jest.fn(),
  };
});

let fetcher = jest.fn();

fetchMock.mockGlobal();

describe('Request Handler', () => {
  const apiUrl = 'http://example.com/api/';
  const responseMock = {
    data: {
      test: 'data',
    },
  };
  const nestedDataMock = {
    data: {
      data: {
        data: {
          test: 'data',
        },
      },
    },
  };

  console.warn = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach((done) => {
    done();
  });

  describe('request()', () => {
    fetchMock.mockGlobal();

    afterEach(() => {
      fetchMock.clearHistory();
      fetchMock.removeRoutes();
      jest.useRealTimers();
    });

    it('should get request instance', () => {
      const requestHandler = createRequestHandler({ fetcher });

      const response = requestHandler.getInstance();

      expect(response).toBeTruthy();
    });

    it('should properly hang promise when using Silent strategy', async () => {
      const requestHandler = createRequestHandler({
        fetcher,
        strategy: 'silent',
      });

      (requestHandler.getInstance() as any).request = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      const request = requestHandler.request(apiUrl);

      const timeout = new Promise((resolve) => {
        const wait = setTimeout(() => {
          clearTimeout(wait);

          resolve('timeout');
        }, 2000);
      });

      jest.advanceTimersByTime(2000);

      expect(typeof request.then).toBe('function');

      const response = await Promise.any([request, timeout]);

      expect(response).toBe('timeout');
    });

    it('should reject promise when using rejection strategy', async () => {
      const requestHandler = createRequestHandler({
        fetcher,
        strategy: 'reject',
      });

      (requestHandler.getInstance() as any).request = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      try {
        const response = await (requestHandler as any).delete(apiUrl);
        expect(response).toBe(undefined);
      } catch (error) {
        expect(typeof error).toBe('object');
      }
    });

    it('should reject promise when using reject strategy per endpoint', async () => {
      const requestHandler = createRequestHandler({
        fetcher,
        strategy: 'silent',
      });

      (requestHandler.getInstance() as any).request = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      try {
        await requestHandler.request(apiUrl, {
          strategy: 'reject',
        });
      } catch (error) {
        expect(typeof error).toBe('object');
      }
    });

    it('should use custom fetcher instance if provided', async () => {
      const customFetcher = jest
        .fn()
        .mockResolvedValue({ data: { foo: 'bar' } });

      const handler = createRequestHandler({ fetcher: customFetcher });
      const result = await handler.request('http://example.com/api/custom');
      expect(customFetcher).toHaveBeenCalled();
      expect(result.data).toEqual({ foo: 'bar' });
    });

    it('should abort request on timeout', async () => {
      const handler = createRequestHandler({
        timeout: 1000,
        rejectCancelled: true,
      });
      fetchMock.get(
        'http://example.com/api/timeout',
        () => new Promise(() => {}),
      ); // never resolves

      const promise = handler.request('http://example.com/api/timeout');
      jest.advanceTimersByTime(1100); // advance enough for timeout to trigger
      await expect(promise).rejects.toThrow();
    });

    it('should not cache if cacheBuster returns true', async () => {
      let callCount = 0;
      fetchMock.get('http://example.com/api/cache-buster', () => {
        callCount++;
        return { status: 200, body: { foo: 'bar' } };
      });
      const handler = createRequestHandler({
        cacheTime: 60,
        cacheBuster: () => true,
      });
      await handler.request('http://example.com/api/cache-buster');
      await handler.request('http://example.com/api/cache-buster');
      expect(callCount).toBe(2);
    });
  });

  describe('request() Polling Mechanism', () => {
    const baseURL = 'https://api.example.com';
    const mockLogger = { warn: jest.fn() };

    beforeEach(() => {
      jest.clearAllMocks();
      fetchMock.clearHistory();
      fetchMock.removeRoutes();
      fetchMock.mockGlobal();
      jest.useFakeTimers();
    });

    afterEach(() => {
      fetchMock.clearHistory();
      fetchMock.removeRoutes();
      jest.useRealTimers();
    });

    it('should handle polling with shouldStopPolling always false (infinite loop protection)', async () => {
      const handler = createRequestHandler({
        pollingInterval: 10,
        shouldStopPolling: () => false,
        retry: { retries: 0 },
        maxPollingAttempts: 10,
      });

      let callCount = 0;

      (globalThis.fetch as jest.Mock) = jest.fn().mockImplementation(() => {
        callCount++;

        return Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      const promise = handler.request('http://example.com/api/poll');

      // Advance timers in steps and allow microtasks to run
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(10);
        await Promise.resolve(); // allow scheduled fetches to run
      }

      // Should have polled at least 10 times
      await promise.catch(() => {}); // avoid unhandled rejection

      expect(callCount).toBeGreaterThanOrEqual(10);
    });

    it('should poll the specified number of times until shouldStopPolling returns true', async () => {
      // Setup polling configuration
      const pollingConfig = {
        pollingInterval: 100,
        shouldStopPolling: jest.fn((_response, pollingAttempt) => {
          // Stop polling at 3 attempts
          return pollingAttempt === 3;
        }),
      };

      // Initialize RequestHandler with polling configuration
      const requestHandler = createRequestHandler({
        baseURL,
        retry: {
          retries: 0, // No retries for this test
        },
        ...pollingConfig,
        logger: mockLogger,
      });

      // Mock fetch to return a successful response every time using fetch-mock
      fetchMock.get(baseURL + '/endpoint', {
        status: 200,
        body: {},
      });

      const mockDelayInvocation = delayInvocation as jest.MockedFunction<
        typeof delayInvocation
      >;

      mockDelayInvocation.mockResolvedValue(true);

      // Make the request
      await requestHandler.request('/endpoint');

      // Advance timers to cover the polling interval
      jest.advanceTimersByTime(300); // pollingInterval * 3

      // Ensure polling stopped after 3 attempts
      expect(pollingConfig.shouldStopPolling).toHaveBeenCalledTimes(3);
      expect(fetchMock.callHistory.calls(baseURL + '/endpoint').length).toBe(3); // 3 polls

      // Ensure delay function was called for each polling attempt
      // 2 delays after the first request, as last one does not require a delay
      expect(mockDelayInvocation).toHaveBeenCalledTimes(2);
      expect(mockDelayInvocation).toHaveBeenCalledWith(
        pollingConfig.pollingInterval,
      );
    });

    it('should not poll if pollingInterval is not provided', async () => {
      // Setup without polling configuration
      const requestHandler = createRequestHandler({
        baseURL,
        retry: {
          retries: 0, // No retries for this test
        },
        pollingInterval: 0, // No polling
        logger: mockLogger,
      });

      fetchMock.getOnce(baseURL + '/endpoint', {
        status: 200,
        body: {},
      });

      await requestHandler.request('/endpoint');

      // Ensure fetch was only called once
      expect(fetchMock.callHistory.calls(baseURL + '/endpoint').length).toBe(1);

      // Ensure polling was not attempted
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should stop polling on error and not proceed with polling attempts', async () => {
      const requestHandler = createRequestHandler({
        baseURL,
        retry: {
          retries: 0, // No retries for this test
        },
        pollingInterval: 100,
        shouldStopPolling: jest.fn(() => false), // Always continue polling if no errors
        logger: mockLogger,
      });

      // Mock fetch to fail using fetch-mock
      fetchMock.getOnce(baseURL + '/endpoint', {
        status: 500,
        body: 'fail',
      });

      const mockDelayInvocation = delayInvocation as jest.MockedFunction<
        typeof delayInvocation
      >;

      mockDelayInvocation.mockResolvedValue(true);

      await expect(
        requestHandler.request(baseURL + '/endpoint'),
      ).rejects.toMatchObject({
        status: 500,
      });

      // Ensure fetch was called once (no polling due to error)
      expect(fetchMock.callHistory.calls(baseURL + '/endpoint').length).toBe(1);

      // Ensure polling was not attempted after failure
      expect(mockDelayInvocation).toHaveBeenCalledTimes(0);

      // Ensure we process the error
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should call delay invocation correct number of times', async () => {
      const requestHandler = createRequestHandler({
        baseURL,
        retry: {
          retries: 0, // No retries for this test
        },
        pollingInterval: 100,
        shouldStopPolling: jest.fn((_response, pollingAttempt) => {
          // Stop polling after 3 attempts
          return pollingAttempt === 3;
        }),
        logger: mockLogger,
      });

      // Use fetch-mock to return a successful response
      fetchMock.get(baseURL + '/endpoint', {
        status: 200,
        body: {},
      });

      await requestHandler.request('/endpoint');

      // Advance timers to cover polling interval
      jest.advanceTimersByTime(300); // pollingInterval * 3

      // 2 delays after the first request, as last one does not require a delay
      expect(delayInvocation).toHaveBeenCalledTimes(2);
    });

    it('should not poll if shouldStopPolling returns true immediately', async () => {
      const pollingConfig = {
        pollingInterval: 100,
        shouldStopPolling: jest.fn(() => true), // Stop immediately
      };

      const requestHandler = createRequestHandler({
        baseURL,
        retry: { retries: 0 },
        ...pollingConfig,
        logger: mockLogger,
      });

      fetchMock.getOnce(baseURL + '/endpoint', { status: 200, body: {} });

      await requestHandler.request('/endpoint');

      expect(fetchMock.callHistory.calls(baseURL + '/endpoint').length).toBe(1);
      expect(pollingConfig.shouldStopPolling).toHaveBeenCalledTimes(1);
    });
  });

  describe('request() Retry Mechanism', () => {
    const baseURL = 'https://api.example.com';
    const mockLogger = { warn: jest.fn() };

    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
      globalThis.fetch = jest.fn();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should succeed if the request eventually succeeds after retries', async () => {
      // Setup retry configuration
      const retryConfig = {
        retries: 3, // Number of retry attempts
        delay: 100, // Initial delay in ms
        maxDelay: 50000, // Maximum delay in ms
        backoff: 1.5, // Backoff factor
        retryOn: [500], // HTTP status codes to retry on
        shouldRetry: jest.fn((response) => {
          return Promise.resolve(response.error.status === 500);
        }), // Always retry
      };

      // Initialize RequestHandler with mock configuration
      const requestHandler = createRequestHandler({
        baseURL,
        retry: retryConfig,
        logger: mockLogger,
        onError: jest.fn(),
      });

      // Mock fetch to fail twice and then succeed
      let callCount = 0;
      (globalThis.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount <= retryConfig.retries) {
          return Promise.reject({
            status: 500,
            json: jest.fn().mockResolvedValue({}),
          });
        }
        return Promise.resolve({
          ok: true,
          clone: jest.fn().mockReturnValue({}),
          json: jest.fn().mockResolvedValue({}),
        });
      });

      const mockDelayInvocation = delayInvocation as jest.MockedFunction<
        typeof delayInvocation
      >;

      mockDelayInvocation.mockResolvedValue(true);

      // Make the request
      await expect(requestHandler.request('/endpoint')).resolves.not.toThrow();

      // Advance timers to cover the delay period
      const totalDelay =
        retryConfig.delay +
        retryConfig.delay * retryConfig.backoff +
        retryConfig.delay * Math.pow(retryConfig.backoff, 2);
      jest.advanceTimersByTime(totalDelay);

      // Check fetch call count (should be retries + 1)
      expect(globalThis.fetch).toHaveBeenCalledTimes(retryConfig.retries + 1);

      // Ensure delay function was called for each retry attempt
      expect(mockDelayInvocation).toHaveBeenCalledTimes(retryConfig.retries);
      expect(mockDelayInvocation).toHaveBeenCalledWith(retryConfig.delay);
      expect(mockDelayInvocation).toHaveBeenCalledWith(
        retryConfig.delay * retryConfig.backoff,
      );

      expect(mockDelayInvocation).toHaveBeenCalledWith(
        retryConfig.delay * Math.pow(retryConfig.backoff, 2),
      );
    });

    it('should retry the specified number of times on failure', async () => {
      // Set up a RequestHandler with retry configuration
      const retryConfig = {
        retries: 3,
        delay: 100,
        maxDelay: 5000,
        backoff: 1.5,
        retryOn: [500], // Retry on server errors
        shouldRetry: jest.fn(() => Promise.resolve(true)),
      };
      const requestHandler = createRequestHandler({
        baseURL,
        retry: retryConfig,
        logger: mockLogger,
        onError: jest.fn(),
      });

      (globalThis.fetch as jest.Mock).mockRejectedValue({
        status: 500,
        json: jest.fn().mockResolvedValue({}),
      });

      const mockDelayInvocation = delayInvocation as jest.MockedFunction<
        typeof delayInvocation
      >;

      mockDelayInvocation.mockResolvedValue(false);

      try {
        await requestHandler.request('/endpoint');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        //
      }

      jest.advanceTimersByTime(10000);

      expect(globalThis.fetch).toHaveBeenCalledTimes(retryConfig.retries + 1);

      // Check delay between retries
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempt 1 failed. Retry in 100ms.',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempt 2 failed. Retry in 150ms.',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempt 3 failed. Retry in 225ms.',
      );
    });

    it('should not retry if the error status is not in retryOn list', async () => {
      const retryConfig = {
        retries: 2,
        delay: 100,
        maxDelay: 5000,
        backoff: 1.5,
        retryOn: [500],
      };
      const requestHandler = createRequestHandler({
        baseURL,
        retry: retryConfig,
        logger: mockLogger,
        onError: jest.fn(),
      });

      (globalThis.fetch as jest.Mock).mockRejectedValue({
        status: 400,
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(requestHandler.request('/endpoint')).rejects.toMatchObject({
        status: 400,
        json: expect.any(Function),
      });

      expect(globalThis.fetch).toHaveBeenCalledTimes(1); // No retries
    });

    it('should not retry if the error status is not in retryOn list and shouldRetry calls for status check', async () => {
      const retryConfig = {
        retries: 2,
        delay: 100,
        maxDelay: 5000,
        backoff: 1.5,
        retryOn: [500],
        shouldRetry: jest.fn(() => Promise.resolve(null)),
      };
      const requestHandler = createRequestHandler({
        baseURL,
        retry: retryConfig,
        logger: mockLogger,
        onError: jest.fn(),
      });

      (globalThis.fetch as jest.Mock).mockRejectedValue({
        status: 400,
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(requestHandler.request('/endpoint')).rejects.toMatchObject({
        status: 400,
        json: expect.any(Function),
      });

      expect(globalThis.fetch).toHaveBeenCalledTimes(1); // No retries
    });

    it('should calculate delay correctly with backoff', async () => {
      const retryConfig = {
        retries: 3,
        delay: 100,
        maxDelay: 5000,
        backoff: 1.5,
        retryOn: [500],
        shouldRetry: jest.fn(() => Promise.resolve(true)),
      };
      const requestHandler = createRequestHandler({
        baseURL,
        retry: retryConfig,
        logger: mockLogger,
        onError: jest.fn(),
      });

      (globalThis.fetch as jest.Mock).mockRejectedValue({
        status: 500,
        json: jest.fn().mockResolvedValue({}),
      });

      const mockDelayInvocation = delayInvocation as jest.MockedFunction<
        typeof delayInvocation
      >;

      mockDelayInvocation.mockResolvedValue(false);

      try {
        await requestHandler.request('/endpoint');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        //
      }

      // Advance time for the total delay
      jest.advanceTimersByTime(100 + 150 + 225);

      expect(mockDelayInvocation).toHaveBeenCalledTimes(3);
      expect(mockDelayInvocation).toHaveBeenCalledWith(100);
      expect(mockDelayInvocation).toHaveBeenCalledWith(150);
      expect(mockDelayInvocation).toHaveBeenCalledWith(225);
    });

    it('should not retry if shouldRetry returns false', async () => {
      const retryConfig = {
        retries: 3,
        delay: 100,
        maxDelay: 5000,
        backoff: 1.5,
        retryOn: [500],
        shouldRetry: jest.fn(() => Promise.resolve(false)),
      };
      const requestHandler = createRequestHandler({
        baseURL,
        retry: retryConfig,
        logger: mockLogger,
        onError: jest.fn(),
      });

      (globalThis.fetch as jest.Mock).mockRejectedValue({
        status: 500,
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(requestHandler.request('/endpoint')).rejects.toMatchObject({
        status: 500,
        json: expect.any(Function),
      });

      expect(globalThis.fetch).toHaveBeenCalledTimes(1); // No retries
    });

    it('should retry if onResponse throws an error and shouldRetry returns true based on custom response data conditional check', async () => {
      // Setup retry configuration
      const retryConfig = {
        retries: 3, // Number of retry attempts
        delay: 100, // Initial delay in ms
        backoff: 1.5, // Backoff factor
        retryOn: [200, 500], // HTTP status codes to retry on
        shouldRetry: jest.fn((response) => {
          // Retry only if response.data.bookId === 'none'
          return response.data?.bookId === 'none';
        }),
      };

      // Initialize RequestHandler with mock configuration
      const requestHandler = createRequestHandler({
        baseURL,
        retry: retryConfig,
        logger: mockLogger,
        onError: jest.fn(),
        onResponse: jest.fn(() => {
          // Simulate throwing an error in onResponse
          throw new Error('Simulated error in onResponse');
        }),
      });

      const fm = fetchMock.createInstance();

      fm.mockGlobal();

      fm.route(
        'https://api.example.com/endpoint',
        () =>
          new Response(JSON.stringify({ bookId: 'none' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      );

      const mockDelayInvocation = delayInvocation as jest.MockedFunction<
        typeof delayInvocation
      >;

      mockDelayInvocation.mockResolvedValue(true);

      // Make the request
      await expect(requestHandler.request('/endpoint')).rejects.toThrow(
        'Simulated error in onResponse',
      );

      // Advance timers to cover the delay period
      const totalDelay =
        retryConfig.delay +
        retryConfig.delay * retryConfig.backoff +
        retryConfig.delay * Math.pow(retryConfig.backoff, 2);
      jest.advanceTimersByTime(totalDelay);

      // Check fetch call count (should be retries + 1)
      expect(fm.callHistory.calls()).toHaveLength(retryConfig.retries + 1);

      // Ensure delay function was called for each retry attempt
      expect(mockDelayInvocation).toHaveBeenCalledTimes(retryConfig.retries);

      // Ensure shouldRetry was called with the correct error
      expect(retryConfig.shouldRetry).toHaveBeenCalledTimes(
        retryConfig.retries,
      );

      for (let i = 1; i <= retryConfig.retries; i++) {
        expect(retryConfig.shouldRetry).toHaveBeenNthCalledWith(
          i,
          expect.objectContaining({
            error: expect.objectContaining({
              message: 'Simulated error in onResponse',
            }),
          }),
          i - 1, // Retry attempt count
        );
      }
    });

    it('should retry if shouldRetry returns true based on custom response data conditional check', async () => {
      // Setup retry configuration
      const retryConfig = {
        retries: 3, // Number of retry attempts
        delay: 100, // Initial delay in ms
        backoff: 1.5, // Backoff factor
        retryOn: [200, 500], // HTTP status codes to retry on
        shouldRetry: jest.fn((response) => {
          // Retry only if response.data.bookId === 'none'
          // You can also access response.error if needed
          return response?.data?.bookId === 'none';
        }),
      };

      // Initialize RequestHandler with mock configuration
      const requestHandler = createRequestHandler({
        baseURL,
        retry: retryConfig,
        logger: mockLogger,
        onError: jest.fn(),
      });

      // Mock fetch to return a response with bookId: 'none' for retries
      let callCount = 0;
      (globalThis.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount <= retryConfig.retries) {
          return Promise.resolve(
            new Response(JSON.stringify({ bookId: 'none' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        // Final successful response
        return Promise.resolve(
          new Response(JSON.stringify({ bookId: 'success' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });

      const mockDelayInvocation = delayInvocation as jest.MockedFunction<
        typeof delayInvocation
      >;

      mockDelayInvocation.mockResolvedValue(true);

      // Make the request
      const response = await requestHandler.request('/endpoint');

      // Advance timers to cover the delay period
      const totalDelay =
        retryConfig.delay +
        retryConfig.delay * retryConfig.backoff +
        retryConfig.delay * Math.pow(retryConfig.backoff, 2);
      jest.advanceTimersByTime(totalDelay);

      // Check fetch call count (should be retries + 1)
      expect(globalThis.fetch).toHaveBeenCalledTimes(retryConfig.retries + 1);

      // Ensure delay function was called for each retry attempt
      expect(mockDelayInvocation).toHaveBeenCalledTimes(retryConfig.retries);

      // Ensure shouldRetry was called with the correct response
      expect(retryConfig.shouldRetry).toHaveBeenCalledTimes(
        retryConfig.retries,
      );

      for (let i = 1; i <= retryConfig.retries; i++) {
        expect(retryConfig.shouldRetry).toHaveBeenNthCalledWith(
          i,
          expect.objectContaining({
            data: { bookId: 'none' },
          }),
          i - 1, // Retry attempt count
        );
      }

      // Ensure the final response is successful
      expect(response).toMatchObject({
        data: { bookId: 'success' },
      });
    });
  });

  describe('request() request deduplication', () => {
    const baseURL = 'https://api.example.com';
    let callCount: number;

    beforeEach(() => {
      callCount = 0;
      fetchMock.mockGlobal();
      fetchMock.clearHistory();
      fetchMock.removeRoutes();
      jest.useFakeTimers();
    });

    afterEach(() => {
      fetchMock.clearHistory();
      fetchMock.removeRoutes();
      jest.useRealTimers();
    });

    it('should deduplicate requests within dedupeTime and reuse the same response', async () => {
      fetchMock.route(baseURL + '/dedupe', () => {
        callCount++;
        return {
          status: 200,
          body: { value: 'deduped' },
        };
      });

      // Fire two requests with the same config in quick succession
      const req1 = fetchf(baseURL + '/dedupe', { dedupeTime: 1000 });
      const req2 = fetchf(baseURL + '/dedupe', { dedupeTime: 1000 });

      // Both should resolve to the same response and only one network call should be made
      const [res1, res2] = await Promise.all([req1, req2]);
      expect(res1.data).toEqual({ value: 'deduped' });
      expect(res2.data).toEqual({ value: 'deduped' });
      expect(callCount).toBe(1);
    });

    it('should not deduplicate requests if dedupeTime has passed', async () => {
      fetchMock.route(baseURL + '/dedupe-expire', () => {
        callCount++;
        return {
          status: 200,
          body: { value: 'not deduped' },
        };
      });

      // First request
      const res1 = await fetchf(baseURL + '/dedupe-expire', {
        dedupeTime: 100,
      });
      // Advance time past dedupeTime
      jest.advanceTimersByTime(200);

      // Second request after dedupeTime
      const res2 = await fetchf(baseURL + '/dedupe-expire', {
        dedupeTime: 100,
      });

      expect(res1.data).toEqual({ value: 'not deduped' });
      expect(res2.data).toEqual({ value: 'not deduped' });
      expect(callCount).toBe(2);
    });

    it('should not deduplicate if dedupeTime is 0', async () => {
      fetchMock.route(baseURL + '/dedupe-zero', () => {
        callCount++;
        return {
          status: 200,
          body: { value: 'no dedupe' },
        };
      });

      const req1 = fetchf(baseURL + '/dedupe-zero', { dedupeTime: 0 });
      const req2 = fetchf(baseURL + '/dedupe-zero', { dedupeTime: 0 });

      const [res1, res2] = await Promise.all([req1, req2]);
      expect(res1.data).toEqual({ value: 'no dedupe' });
      expect(res2.data).toEqual({ value: 'no dedupe' });
      expect(callCount).toBe(2);
    });

    it('should deduplicate requests with different params as different keys', async () => {
      let callCount = 0;
      fetchMock.get(
        (call) => call.url.startsWith(baseURL + '/dedupe-params'),
        () => {
          callCount++;
          return { status: 200, body: { value: 'deduped-params' } };
        },
      );
      const req1 = fetchf(baseURL + '/dedupe-params', {
        params: { a: 1 },
        dedupeTime: 1000,
      });
      const req2 = fetchf(baseURL + '/dedupe-params', {
        params: { a: 2 },
        dedupeTime: 1000,
      });
      const [res1, res2] = await Promise.all([req1, req2]);
      expect(res1.data).toEqual({ value: 'deduped-params' });
      expect(res2.data).toEqual({ value: 'deduped-params' });
      expect(callCount).toBe(2);
    });

    it('should deduplicate requests with same key but different dedupeTime windows', async () => {
      let callCount = 0;
      fetchMock.get(baseURL + '/dedupe-window', () => {
        callCount++;
        return { status: 200, body: { value: 'window' } };
      });
      const req1 = fetchf(baseURL + '/dedupe-window', { dedupeTime: 100 });
      const req2 = fetchf(baseURL + '/dedupe-window', { dedupeTime: 100 });
      const [res1, res2] = await Promise.all([req1, req2]);
      expect(res1.data).toEqual({ value: 'window' });
      expect(res2.data).toEqual({ value: 'window' });
      expect(callCount).toBe(1);
      jest.advanceTimersByTime(200);
      const res3 = await fetchf(baseURL + '/dedupe-window', {
        dedupeTime: 100,
      });
      expect(res3.data).toEqual({ value: 'window' });
      expect(callCount).toBe(2);
    });

    it('should not deduplicate if dedupeTime is negative', async () => {
      let callCount = 0;
      fetchMock.get(baseURL + '/dedupe-negative', () => {
        callCount++;
        return { status: 200, body: { value: 'negative' } };
      });
      const req1 = fetchf(baseURL + '/dedupe-negative', { dedupeTime: -1 });
      const req2 = fetchf(baseURL + '/dedupe-negative', { dedupeTime: -1 });
      const [res1, res2] = await Promise.all([req1, req2]);
      expect(res1.data).toEqual({ value: 'negative' });
      expect(res2.data).toEqual({ value: 'negative' });
      expect(callCount).toBe(2);
    });

    it('should deduplicate requests even if one fails and the other succeeds', async () => {
      let callCount = 0;
      let shouldFail = true;
      fetchMock.get(baseURL + '/dedupe-fail', () => {
        callCount++;
        if (shouldFail) {
          shouldFail = false;
          return { status: 500, body: { error: 'fail' } };
        }
        return { status: 200, body: { value: 'success' } };
      });
      const req1 = fetchf(baseURL + '/dedupe-fail', { dedupeTime: 1000 });
      const req2 = fetchf(baseURL + '/dedupe-fail', { dedupeTime: 1000 });
      try {
        await Promise.all([req1, req2]);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        // One or both may fail, but callCount should be 1
        expect(callCount).toBe(1);
      }
      // Next request should succeed and not be deduped
      const res3 = await fetchf(baseURL + '/dedupe-fail', { dedupeTime: 1000 });
      expect(res3.data).toEqual({ value: 'success' });
      expect(callCount).toBe(2);
    });
  });

  describe('request() 429 Retry-After handling', () => {
    const baseURL = 'https://api.example.com';
    const mockLogger = { warn: jest.fn() };
    let mockDelayInvocation: jest.MockedFunction<typeof delayInvocation>;

    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
      fetchMock.mockGlobal();
      mockDelayInvocation = delayInvocation as jest.MockedFunction<
        typeof delayInvocation
      >;
      mockDelayInvocation.mockResolvedValue(true);
    });

    afterEach(() => {
      jest.useRealTimers();
      fetchMock.clearHistory();
      fetchMock.removeRoutes();
    });

    it('should respect Retry-After header in seconds for 429', async () => {
      let callCount = 0;
      fetchMock.route(baseURL + '/endpoint', () => {
        callCount++;
        if (callCount === 1) {
          return {
            status: 429,
            headers: new Headers({ 'Retry-After': '2' }),
            body: {},
          };
        }
        return { status: 200, body: {} };
      });
      await fetchf(baseURL + '/endpoint', {
        retry: {
          retries: 1,
          delay: 100,
          maxDelay: 5000,
          backoff: 1.5,
          retryOn: [429],
          shouldRetry: () => Promise.resolve(true),
        },
        logger: mockLogger,
        onError: jest.fn(),
      });
      expect(mockDelayInvocation).toHaveBeenCalledWith(2000);
    });

    it('should respect Retry-After header as HTTP-date for 429', async () => {
      let callCount = 0;
      const futureDate = new Date(Date.now() + 3000).toUTCString();
      fetchMock.route(baseURL + '/endpoint', () => {
        callCount++;
        if (callCount === 1) {
          return {
            status: 429,
            headers: { 'Retry-After': futureDate },
            body: {},
          };
        }
        return { status: 200, body: {} };
      });
      await fetchf(baseURL + '/endpoint', {
        retry: {
          retries: 1,
          delay: 100,
          maxDelay: 5000,
          backoff: 1.5,
          retryOn: [429],
          shouldRetry: () => Promise.resolve(true),
        },
        logger: mockLogger,
        onError: jest.fn(),
      });
      expect(mockDelayInvocation.mock.calls[0][0]).toBeGreaterThanOrEqual(0);
      expect(mockDelayInvocation.mock.calls[0][0]).toBeLessThanOrEqual(3000);
    });

    it('should use default delay if Retry-After header is missing', async () => {
      let callCount = 0;
      fetchMock.route(baseURL + '/endpoint', () => {
        callCount++;
        if (callCount === 1) {
          return { status: 429, headers: {}, body: {} };
        }
        return { status: 200, body: {} };
      });
      await fetchf(baseURL + '/endpoint', {
        retry: {
          retries: 1,
          delay: 1234,
          maxDelay: 5000,
          backoff: 1.5,
          retryOn: [429],
          shouldRetry: () => Promise.resolve(true),
        },
        logger: mockLogger,
        onError: jest.fn(),
      });
      expect(mockDelayInvocation).toHaveBeenCalledWith(1234);
    });

    it('should use default delay if Retry-After header is invalid', async () => {
      let callCount = 0;
      fetchMock.route(baseURL + '/endpoint', () => {
        callCount++;
        if (callCount === 1) {
          return {
            status: 429,
            headers: { 'Retry-After': 'not-a-date' },
            body: {},
          };
        }
        return { status: 200, body: {} };
      });
      await fetchf(baseURL + '/endpoint', {
        retry: {
          retries: 1,
          delay: 4321,
          maxDelay: 5000,
          backoff: 1.5,
          retryOn: [429],
          shouldRetry: () => Promise.resolve(true),
        },
        logger: mockLogger,
        onError: jest.fn(),
      });
      expect(mockDelayInvocation).toHaveBeenCalledWith(4321);
    });
  });

  describe('request() with interceptors', () => {
    let requestHandler: RequestHandlerReturnType;
    const spy = jest.spyOn(interceptorManager, 'applyInterceptor');

    jest.useFakeTimers();

    beforeEach(() => {
      requestHandler = createRequestHandler({
        baseURL: 'https://api.example.com',
        timeout: 5000,
        cancellable: true,
        rejectCancelled: true,
        strategy: 'reject',
        defaultResponse: null,
        onError: () => {},
      });

      fetchMock.clearHistory();
      fetchMock.removeRoutes();
      spy.mockClear();
      fetchMock.mockGlobal();
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('should propagate error thrown by onRequest interceptor', async () => {
      const handler = createRequestHandler({
        onRequest: () => {
          throw new Error('Interceptor error');
        },
      });
      await expect(
        handler.request('http://example.com/api/err'),
      ).rejects.toThrow('Interceptor error');
    });

    it('should call onError and onResponse hooks', async () => {
      const onError = jest.fn();
      const onResponse = jest.fn();
      const handler = createRequestHandler({
        onError,
        onResponse,
      });
      fetchMock.getOnce('http://example.com/api/hook', {
        status: 200,
        body: { foo: 'bar' },
      });
      await handler.request('http://example.com/api/hook');
      expect(onResponse).toHaveBeenCalled();

      fetchMock.getOnce('http://example.com/api/hook-fail', {
        status: 500,
        body: 'fail',
      });

      await expect(
        handler.request('http://example.com/api/hook-fail'),
      ).rejects.toThrow();
      expect(onError).toHaveBeenCalled();
    });

    it('should apply interceptors correctly', async () => {
      fetchMock.route('https://api.example.com/test-endpoint?key=value', {
        status: 200,
        body: { data: 'response from second request' },
      });

      const url = '/test-endpoint';
      const params = { key: 'value' };

      await requestHandler.request(url, { params });

      expect(spy).toHaveBeenCalledTimes(4);
    });

    it('should handle modified config in interceptRequest', async () => {
      fetchMock.route('https://api.example.com/test-endpoint?key=value', {
        status: 200,
        body: { data: 'response with modified config' },
      });

      const url = '/test-endpoint';
      const params = { key: 'value' };
      const config = {
        onRequest(config) {
          const headers = new Headers();
          headers.set('Modified-Header', 'ModifiedValue');
          config.headers = headers;
        },
      } as RequestConfig;

      await requestHandler.request(url, { ...config, params });

      expect(spy).toHaveBeenCalledTimes(4);
      const lastCall = fetchMock.callHistory.lastCall();

      expect(lastCall?.options?.headers).toMatchObject({
        'modified-header': 'ModifiedValue',
      });
    });

    it('should handle modified response in applyInterceptor', async () => {
      const modifiedUrl = 'https://api.example.com/test-endpoint?key=value';

      fetchMock.route(
        modifiedUrl,
        new Response(JSON.stringify({ username: 'original response' }), {
          status: 200,
        }),
      );

      const url = '/test-endpoint';
      const params = { key: 'value' };
      const requestConfig: RequestConfig = {
        async onResponse(response) {
          response.data = { username: 'modified response' };
        },
      };

      const { data, config } = await requestHandler.request(url, {
        ...requestConfig,
        params,
      });

      expect(spy).toHaveBeenCalledTimes(4);
      expect(data).toMatchObject({ username: 'modified response' });
      expect(config.url).toContain(modifiedUrl);
    });

    it('should handle request failure with interceptors', async () => {
      fetchMock.route('https://api.example.com/test-endpoint?key=value', {
        status: 500,
        body: { error: 'Server error' },
      });

      const url = '/test-endpoint';
      const params = { key: 'value' };
      const config = {};

      await expect(
        requestHandler.request(url, { ...config, params }),
      ).rejects.toThrow(
        'https://api.example.com/test-endpoint?key=value failed! Status: 500',
      );

      // Only request and error interceptors are called (4 because 2 for request and 2 for errors)
      expect(spy).toHaveBeenCalledTimes(4);
    });

    it('should handle request with different response status', async () => {
      fetchMock.route('https://api.example.com/test-endpoint?key=value', {
        status: 404,
        body: { error: 'Not found' },
      });

      const url = '/test-endpoint';
      const params = { key: 'value' };
      const config = {};

      await expect(
        requestHandler.request(url, { ...config, params }),
      ).rejects.toThrow(
        'https://api.example.com/test-endpoint?key=value failed! Status: 404',
      );

      // Only request and error interceptors are called (4 because 2 for request and 2 for errors)
      expect(spy).toHaveBeenCalledTimes(4);
    });
  });

  describe('request() with native fetch()', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      globalThis.fetch = jest.fn();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should properly hang promise when using Silent strategy', async () => {
      const requestHandler = createRequestHandler({
        strategy: 'silent',
      });

      globalThis.fetch = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      const request = requestHandler.request(apiUrl);

      const timeout = new Promise((resolve) => {
        const wait = setTimeout(() => {
          clearTimeout(wait);

          resolve('timeout');
        }, 2000);
      });

      jest.advanceTimersByTime(2000);

      expect(typeof request.then).toBe('function');

      const response = await Promise.any([request, timeout]);

      expect(response).toBe('timeout');
    });

    it('should reject promise when using rejection strategy', async () => {
      const requestHandler = createRequestHandler({
        strategy: 'reject',
      });

      globalThis.fetch = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      try {
        const response = await (requestHandler as any).delete(apiUrl);
        expect(response).toBe(undefined);
      } catch (error) {
        expect(typeof error).toBe('object');
      }
    });

    it('should reject promise when using reject strategy per endpoint', async () => {
      const requestHandler = createRequestHandler({
        strategy: 'silent',
      });

      globalThis.fetch = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      try {
        await requestHandler.request(apiUrl, {
          strategy: 'reject',
        });
      } catch (error) {
        expect(typeof error).toBe('object');
      }
    });
  });

  describe('Request cancellation', () => {
    beforeEach(() => {
      fetchMock.mockGlobal();
    });

    afterEach(() => {
      fetchMock.clearHistory();
      fetchMock.removeRoutes();
    });

    it('should cancel previous request when fetchf() is used', async () => {
      const url = 'https://example.com/api/post/send';

      fetchMock.route(url, () => {
        return {
          status: 200,
          body: { message: 'This response is mocked once' },
        };
      });

      const sendPost = () =>
        fetchf(url, {
          cancellable: true,
          rejectCancelled: true,
        });

      const firstRequest = sendPost();
      const secondRequest = sendPost();

      // Wait for both to settle to avoid unhandled rejection
      const [firstResult, secondResult] = await Promise.allSettled([
        firstRequest,
        secondRequest,
      ]);

      // Check the results
      expect(firstResult.status).toBe('rejected');
      expect((firstResult as any).reason).toBeInstanceOf(DOMException);
      expect((firstResult as any).reason.message).toBe(
        'The operation was aborted.',
      );

      expect(secondResult.status).toBe('fulfilled');
      expect((secondResult as any).value).toMatchObject({
        data: {
          message: 'This response is mocked once',
        },
      });
    });

    it('should cancel previous request and pass a different successive request', async () => {
      const requestHandler = createRequestHandler({
        cancellable: true,
        rejectCancelled: true,
        flattenResponse: true,
      });

      fetchMock.route(
        'https://example.com/first',
        new Promise((_resolve, reject) => {
          reject(new DOMException('The operation was aborted.', ABORT_ERROR));
        }),
      );

      fetchMock.route('https://example.com/second', {
        status: 200,
        body: { username: 'response from second request' },
      });

      const firstRequest = requestHandler.request('https://example.com/first');
      const secondRequest = requestHandler.request(
        'https://example.com/second',
      );

      expect(secondRequest).resolves.toMatchObject({
        data: { username: 'response from second request' },
      });
      expect(firstRequest).rejects.toThrow('The operation was aborted.');
    });

    it('should not cancel previous request when cancellable is set to false', async () => {
      const requestHandler = createRequestHandler({
        cancellable: false, // No request cancellation
        rejectCancelled: true,
        flattenResponse: false,
      });

      // Mock the first request
      fetchMock.route('https://example.com/first', {
        status: 200,
        body: { data: { message: 'response from first request' } },
      });

      // Mock the second request
      fetchMock.route('https://example.com/second', {
        status: 200,
        body: { data: { message: 'response from second request' } },
      });

      const firstRequest = requestHandler.request('https://example.com/first');
      const secondRequest = requestHandler.request(
        'https://example.com/second',
      );

      // Validate both requests resolve successfully without any cancellation
      await expect(firstRequest).resolves.toMatchObject({
        data: { data: { message: 'response from first request' } },
      });
      await expect(secondRequest).resolves.toMatchObject({
        data: { data: { message: 'response from second request' } },
      });
    });

    it('should cancel first request without throwing when successive request is made through fetchf() and rejectCancelled is false', async () => {
      const abortedError = new DOMException(
        'The operation was aborted.',
        ABORT_ERROR,
      );

      fetchMock.route(
        'https://example.com/first',
        new Promise((_resolve, reject) => {
          reject(abortedError);
        }),
      );

      fetchMock.route('https://example.com/second', {
        status: 200,
        body: { username: 'response from second request' },
      });

      const firstRequest = fetchf('https://example.com/first', {
        cancellable: true,
        rejectCancelled: false,
        flattenResponse: true,
        defaultResponse: {},
      });

      const secondRequest = fetchf('https://example.com/second', {
        flattenResponse: true,
      });

      expect(secondRequest).resolves.toMatchObject({
        data: { username: 'response from second request' },
      });
      expect(firstRequest).resolves.toMatchObject({ data: {} });
    });
  });

  describe('Response output', () => {
    beforeEach(() => {
      fetchMock.mockGlobal();
    });

    afterEach(() => {
      fetchMock.clearHistory();
      fetchMock.removeRoutes();
    });

    it('should return defaultResponse if response is empty', async () => {
      const handler = createRequestHandler({ defaultResponse: { foo: 'bar' } });
      fetchMock.getOnce('http://example.com/api/empty', {
        status: 200,
        body: {},
      });
      const result = await handler.request('http://example.com/api/empty');
      expect(result.data).toEqual({ foo: 'bar' });
    });

    it('should show nested data object if flattening is off', async () => {
      fetcher = jest.fn().mockResolvedValue({ data: responseMock, ok: true });

      const requestHandler = createRequestHandler({
        fetcher,
        flattenResponse: false,
      });

      const { data } = await requestHandler.request(apiUrl, {
        method: 'put',
      });

      expect(data).toMatchObject(responseMock);
    });

    it('should handle deeply nested data if data flattening is on', async () => {
      fetcher = jest
        .fn()
        .mockResolvedValue({ data: { data: responseMock }, ok: true });

      const requestHandler = createRequestHandler({
        fetcher,
        flattenResponse: true,
      });

      const { data } = await requestHandler.request(apiUrl, {
        method: 'patch',
      });

      expect(data).toMatchObject(responseMock.data);
      expect(data).not.toMatchObject(nestedDataMock);
    });

    it('should return null if there is no data', async () => {
      fetcher = jest.fn().mockResolvedValue({ data: null, ok: true });

      const requestHandler = createRequestHandler({
        fetcher,
        flattenResponse: true,
        defaultResponse: null,
      });

      expect(
        await requestHandler.request(apiUrl, { method: 'head' }),
      ).toMatchObject({ data: null });
    });
  });

  describe('request() cache', () => {
    const apiUrl = 'http://example.com/api/cache-test';
    let requestHandler: RequestHandlerReturnType;

    beforeEach(() => {
      jest.useFakeTimers();
      fetchMock.clearHistory();
      fetchMock.removeRoutes();
      fetchMock.mockGlobal();
      requestHandler = createRequestHandler({
        cacheTime: 60,
      });
    });

    afterEach(() => {
      fetchMock.clearHistory();
      fetchMock.removeRoutes();

      // Advance time to ensure cache expiration
      jest.advanceTimersByTime(61000); // 61 seconds > cacheTime of 60 seconds

      pruneCache(0.0000001);
      jest.useRealTimers();
    });

    it('should cache the response and return cached data on subsequent requests', async () => {
      let callCount = 0;
      fetchMock.get(apiUrl, () => {
        callCount++;
        return { status: 200, body: { value: 'cached' } };
      });

      // First request - should hit the network
      const firstResponse = await requestHandler.request(apiUrl);
      expect(firstResponse.data).toEqual({ value: 'cached' });
      expect(callCount).toBe(1);

      // Second request - should return cached data, not hit the network
      const secondResponse = await requestHandler.request(apiUrl);
      expect(secondResponse.data).toEqual({ value: 'cached' });
      expect(callCount).toBe(1);
    });

    it('should bypass cache if cacheTime is 0', async () => {
      let callCount = 0;
      fetchMock.get(apiUrl, () => {
        callCount++;
        return { status: 200, body: { value: 'no-cache' } };
      });

      const handlerNoCache = createRequestHandler({ cacheTime: 0 });
      await handlerNoCache.request(apiUrl);
      await handlerNoCache.request(apiUrl);
      expect(callCount).toBe(2);
    });

    it('should cache different responses for different URLs', async () => {
      let callCountA = 0;
      let callCountB = 0;
      fetchMock.get('http://example.com/api/a', () => {
        callCountA++;
        return { status: 200, body: { value: 'A' } };
      });
      fetchMock.get('http://example.com/api/b', () => {
        callCountB++;
        return { status: 200, body: { value: 'B' } };
      });

      const handler = createRequestHandler({ cacheTime: 60 });
      const respA1 = await handler.request('http://example.com/api/a');
      const respA2 = await handler.request('http://example.com/api/a');
      const respB1 = await handler.request('http://example.com/api/b');
      const respB2 = await handler.request('http://example.com/api/b');
      expect(respA1.data).toEqual({ value: 'A' });
      expect(respA2.data).toEqual({ value: 'A' });
      expect(respB1.data).toEqual({ value: 'B' });
      expect(respB2.data).toEqual({ value: 'B' });
      expect(callCountA).toBe(1);
      expect(callCountB).toBe(1);
    });

    it('should not return cached data if cache is expired', async () => {
      let callCount = 0;
      fetchMock.get(apiUrl, () => {
        callCount++;
        return { status: 200, body: { value: 'expire' } };
      });
      // Use 1 second for cacheTime to avoid timing issues
      const handler = createRequestHandler({ cacheTime: 1 });
      const resp1 = await handler.request(apiUrl);
      expect(resp1.data).toEqual({ value: 'expire' });
      // Simulate cache expiration (advance by 1100ms > 1s)
      jest.advanceTimersByTime(1100);
      const resp2 = await handler.request(apiUrl, {
        // Skip setting cache in the 2nd request
        skipCache: () => true,
      });
      expect(resp2.data).toEqual({ value: 'expire' });
      expect(callCount).toBe(2);
    });

    it('should not cache if skipCache returns true', async () => {
      let callCount = 0;
      fetchMock.get(apiUrl, () => {
        callCount++;
        return { status: 200, body: { value: 'skip' } };
      });

      const handler = createRequestHandler({
        cacheTime: 60,
      });

      // Provide skipCache that always returns true
      const resp1 = await handler.request(apiUrl, {
        skipCache: () => true,
      });
      expect(resp1.data).toEqual({ value: 'skip' });
      expect(callCount).toBe(1);

      // Second request should hit the network again (no cache set)
      const resp2 = await handler.request(apiUrl, {
        skipCache: () => false, // now allow caching
      });
      expect(resp2.data).toEqual({ value: 'skip' });
      expect(callCount).toBe(2);

      // Third request should return cached data (cache was set on previous call)
      const resp3 = await handler.request(apiUrl, {
        skipCache: () => false,
      });
      expect(resp3.data).toEqual({ value: 'skip' });
      expect(callCount).toBe(2);
    });

    it('should cache if skipCache returns false', async () => {
      let callCount = 0;
      fetchMock.get(apiUrl, () => {
        callCount++;
        return { status: 200, body: { value: 'cache' } };
      });

      const handler = createRequestHandler({
        cacheTime: 60,
      });

      // Provide skipCache that always returns false
      const resp1 = await handler.request(apiUrl, {
        skipCache: () => false,
      });
      expect(resp1.data).toEqual({ value: 'cache' });
      expect(callCount).toBe(1);

      // Second request should return cached data
      const resp2 = await handler.request(apiUrl, {
        skipCache: () => false,
      });
      expect(resp2.data).toEqual({ value: 'cache' });
      expect(callCount).toBe(1);

      // Third request should return cached data
      const resp3 = await handler.request(apiUrl, {
        skipCache: () => false,
      });
      expect(resp3.data).toEqual({ value: 'cache' });
      expect(callCount).toBe(1);
    });

    it('should cache if skipCache is not provided', async () => {
      let callCount = 0;
      fetchMock.get(apiUrl, () => {
        callCount++;
        return { status: 200, body: { value: 'default' } };
      });

      const handler = createRequestHandler({
        cacheTime: 60,
      });

      const resp1 = await handler.request(apiUrl);
      expect(resp1.data).toEqual({ value: 'default' });
      expect(callCount).toBe(1);

      const resp2 = await handler.request(apiUrl);
      expect(resp2.data).toEqual({ value: 'default' });
      expect(callCount).toBe(1);
    });

    it('should use custom cacheKey function for caching', async () => {
      let callCount = 0;
      fetchMock.get(apiUrl, () => {
        callCount++;
        return { status: 200, body: { value: 'custom-key' } };
      });

      const customKey = 'my-custom-key';
      const handler = createRequestHandler({
        cacheTime: 60,
        cacheKey: () => customKey,
      });

      // First request - should hit the network
      const resp1 = await handler.request(apiUrl);
      expect(resp1.data).toEqual({ value: 'custom-key' });
      expect(callCount).toBe(1);

      // Second request - should return cached data using custom key
      const resp2 = await handler.request(apiUrl);
      expect(resp2.data).toEqual({ value: 'custom-key' });
      expect(callCount).toBe(1);
    });

    it('should cache separately for different custom cacheKey values', async () => {
      let callCount = 0;
      fetchMock.get(
        (call) => call.url.startsWith(apiUrl),
        () => {
          callCount++;
          return { status: 200, body: { value: 'custom-key-multi' } };
        },
      );
      const handler = createRequestHandler({
        cacheTime: 60,
        cacheKey: (cfg) => cfg.url + '-custom',
      });

      // First request with one key
      const resp1 = await handler.request(apiUrl);
      expect(resp1.data).toEqual({ value: 'custom-key-multi' });
      expect(callCount).toBe(1);

      // Second request with a different key (simulate different url)
      const resp2 = await handler.request(apiUrl + '?v=2');
      expect(resp2.data).toEqual({ value: 'custom-key-multi' });
      expect(callCount).toBe(2);

      // Third request with first key again (should be cached)
      const resp3 = await handler.request(apiUrl);
      expect(resp3.data).toEqual({ value: 'custom-key-multi' });
      expect(callCount).toBe(2);
    });
  });
});
