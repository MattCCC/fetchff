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
import type { ResponseError } from '../src/errors/response-error';
import { ABORT_ERROR } from '../src/constants';

jest.mock('../src/utils', () => {
  const originalModule = jest.requireActual('../src/utils');

  return {
    ...originalModule,
    delayInvocation: jest.fn(),
  };
});

const fetcher = {
  create: jest.fn().mockReturnValue({ request: jest.fn() }),
};

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

  it('should get request instance', () => {
    const requestHandler = createRequestHandler({ fetcher });

    const response = requestHandler.getInstance();

    expect(response).toBeTruthy();
  });

  describe('request()', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      globalThis.fetch = jest.fn();
    });

    afterEach(() => {
      jest.useRealTimers();
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
  });

  describe('request() Polling Mechanism', () => {
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

    it('should poll the specified number of times until shouldStopPolling returns true', async () => {
      // Setup polling configuration
      const pollingConfig = {
        pollingInterval: 100,
        shouldStopPolling: jest.fn((_response, pollingAttempt) => {
          // Stop polling after 3 attempts
          return pollingAttempt >= 3;
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

      // Mock fetch to return a successful response every time
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        clone: jest.fn().mockReturnValue({}),
        json: jest.fn().mockResolvedValue({}),
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
      expect(pollingConfig.shouldStopPolling).toHaveBeenCalledTimes(4);
      expect(globalThis.fetch).toHaveBeenCalledTimes(4); // 1 initial + 3 polls

      // Ensure delay function was called for each polling attempt
      expect(mockDelayInvocation).toHaveBeenCalledTimes(3);
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

      // Mock fetch to return a successful response
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        clone: jest.fn().mockReturnValue({}),
        json: jest.fn().mockResolvedValue({}),
      });

      await requestHandler.request('/endpoint');

      // Ensure fetch was only called once
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Ensure polling was not attempted
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should stop polling on error and not proceed with polling attempts', async () => {
      // Setup polling configuration
      const pollingConfig = {
        pollingInterval: 100,
        shouldStopPolling: jest.fn(() => false), // Always continue polling if no errors
      };

      const requestHandler = createRequestHandler({
        baseURL,
        retry: {
          retries: 0, // No retries for this test
        },
        ...pollingConfig,
        logger: mockLogger,
      });

      // Mock fetch to fail
      (globalThis.fetch as jest.Mock).mockRejectedValue({
        status: 500,
        json: jest.fn().mockResolvedValue({}),
      });

      const mockDelayInvocation = delayInvocation as jest.MockedFunction<
        typeof delayInvocation
      >;

      mockDelayInvocation.mockResolvedValue(true);

      await expect(requestHandler.request('/endpoint')).rejects.toMatchObject({
        status: 500,
        json: expect.any(Function),
      });

      // Ensure fetch was called once (no polling due to error)
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Ensure polling was not attempted after failure
      expect(mockDelayInvocation).toHaveBeenCalledTimes(0);

      // Ensure we process the error
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should log polling attempts and delays', async () => {
      // Setup polling configuration
      const pollingConfig = {
        pollingInterval: 100,
        shouldStopPolling: jest.fn((_response, pollingAttempt) => {
          // Stop polling after 3 attempts
          return pollingAttempt >= 3;
        }),
      };

      const requestHandler = createRequestHandler({
        baseURL,
        retry: {
          retries: 0, // No retries for this test
        },
        ...pollingConfig,
        logger: mockLogger,
      });

      // Mock fetch to return a successful response
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        clone: jest.fn().mockReturnValue({}),
        json: jest.fn().mockResolvedValue({}),
      });

      await requestHandler.request('/endpoint');

      // Advance timers to cover polling interval
      jest.advanceTimersByTime(300); // pollingInterval * 3

      // Check if polling was logged properly
      expect(mockLogger.warn).toHaveBeenCalledWith('Polling attempt 1...');
      expect(mockLogger.warn).toHaveBeenCalledWith('Polling attempt 2...');
      expect(mockLogger.warn).toHaveBeenCalledWith('Polling attempt 3...');
    });

    it('should not poll if shouldStopPolling returns true immediately', async () => {
      // Setup polling configuration
      const pollingConfig = {
        pollingInterval: 100,
        shouldStopPolling: jest.fn(() => true), // Stop immediately
      };

      const requestHandler = createRequestHandler({
        baseURL,
        retry: {
          retries: 0, // No retries for this test
        },
        ...pollingConfig,
        logger: mockLogger,
      });

      // Mock fetch to return a successful response
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        clone: jest.fn().mockReturnValue({}),
        json: jest.fn().mockResolvedValue({}),
      });

      await requestHandler.request('/endpoint');

      // Ensure fetch was only called once
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);

      // Ensure polling was skipped
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
        shouldRetry: jest.fn(() => Promise.resolve(true)),
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

      fetchMock.mock(
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
      expect(fetchMock.calls()).toHaveLength(retryConfig.retries + 1);

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
          // Retry only if response.error.bookId === 'none'
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

  describe('request() with interceptors', () => {
    let requestHandler: RequestHandlerReturnType;
    const spy = jest.spyOn(interceptorManager, 'applyInterceptor');

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

      jest.useFakeTimers();
      fetchMock.reset();
      spy.mockClear();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should apply interceptors correctly', async () => {
      fetchMock.mock('https://api.example.com/test-endpoint?key=value', {
        status: 200,
        body: { data: 'response from second request' },
      });

      const url = '/test-endpoint';
      const params = { key: 'value' };

      await requestHandler.request(url, { params });

      expect(spy).toHaveBeenCalledTimes(4);
    });

    it('should handle modified config in interceptRequest', async () => {
      fetchMock.mock('https://api.example.com/test-endpoint?key=value', {
        status: 200,
        body: { data: 'response with modified config' },
      });

      const url = '/test-endpoint';
      const params = { key: 'value' };
      const config = {
        onRequest(config) {
          config.headers = { 'Modified-Header': 'ModifiedValue' };
        },
      } as RequestConfig;

      await requestHandler.request(url, { ...config, params });

      expect(spy).toHaveBeenCalledTimes(4);
      expect(fetchMock.lastOptions()).toMatchObject({
        headers: { 'Modified-Header': 'ModifiedValue' },
      });
    });

    it('should handle modified response in applyInterceptor', async () => {
      const modifiedUrl = 'https://api.example.com/test-endpoint?key=value';

      fetchMock.mock(
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
      fetchMock.mock('https://api.example.com/test-endpoint?key=value', {
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
      fetchMock.mock('https://api.example.com/test-endpoint?key=value', {
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
      globalThis.fetch = jest.fn();
    });

    it('should cancel previous request when fetchf() is used', async () => {
      const url = 'https://example.com/api/post/send';

      // Reset fetchMock before each test
      fetchMock.reset();

      let requestCounter = 0;

      // Mock the endpoint with a conditional response
      fetchMock.mock(
        url,
        () => {
          // Increment the counter for each request
          requestCounter++;

          if (requestCounter === 1) {
            // Simulate successful response for the first request
            return {
              status: 200,
              body: { message: 'This response is mocked once' },
            };
          } else {
            // Simulate aborted request for subsequent requests
            return Promise.reject(
              new DOMException('The operation was aborted.', 'AbortError'),
            );
          }
        },
        { overwriteRoutes: true },
      );

      // Create an API fetcher with cancellable requests enabled
      const sendPost = () =>
        fetchf(url, {
          cancellable: true,
          rejectCancelled: true,
        });

      async function sendData() {
        const firstRequest = sendPost();
        const secondRequest = sendPost();

        try {
          const secondResponse = await secondRequest;
          expect(secondResponse).toMatchObject({
            message: 'This response is mocked once',
          });

          await expect(firstRequest).rejects.toThrow(
            'The operation was aborted.',
          );
        } catch (error) {
          const err = error as ResponseError;

          expect(err.message).toBe('The operation was aborted.');
        }
      }

      // Execute the sendData function and await its completion
      await sendData();
    });

    it('should cancel previous request and pass a different successive request', async () => {
      fetchMock.reset();

      const requestHandler = createRequestHandler({
        cancellable: true,
        rejectCancelled: true,
        flattenResponse: true,
      });

      fetchMock.mock(
        'https://example.com/first',
        new Promise((_resolve, reject) => {
          reject(new DOMException('The operation was aborted.', ABORT_ERROR));
        }),
      );

      fetchMock.mock('https://example.com/second', {
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
      fetchMock.reset();

      const requestHandler = createRequestHandler({
        cancellable: false, // No request cancellation
        rejectCancelled: true,
        flattenResponse: false,
      });

      // Mock the first request
      fetchMock.mock('https://example.com/first', {
        status: 200,
        body: { data: { message: 'response from first request' } },
      });

      // Mock the second request
      fetchMock.mock('https://example.com/second', {
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
      fetchMock.reset();

      const abortedError = new DOMException(
        'The operation was aborted.',
        ABORT_ERROR,
      );

      fetchMock.mock(
        'https://example.com/first',
        new Promise((_resolve, reject) => {
          reject(abortedError);
        }),
      );

      fetchMock.mock('https://example.com/second', {
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
    it('should show nested data object if flattening is off', async () => {
      const requestHandler = createRequestHandler({
        fetcher,
        flattenResponse: false,
      });

      (requestHandler.getInstance() as any).request = jest
        .fn()
        .mockResolvedValue(responseMock);

      const response = await requestHandler.request(apiUrl, {
        method: 'put',
      });

      expect(response).toMatchObject(responseMock);
    });

    it('should handle deeply nested data if data flattening is on', async () => {
      const requestHandler = createRequestHandler({
        fetcher,
        flattenResponse: true,
      });

      (requestHandler.getInstance() as any).request = jest
        .fn()
        .mockResolvedValue({ data: responseMock });

      const { data } = await requestHandler.request(apiUrl, {
        method: 'patch',
      });

      expect(data).toMatchObject(responseMock.data);
      expect(data).not.toMatchObject(nestedDataMock);
    });

    it('should return null if there is no data', async () => {
      const requestHandler = createRequestHandler({
        fetcher,
        flattenResponse: true,
        defaultResponse: null,
      });

      (requestHandler.getInstance() as any).request = jest
        .fn()
        .mockResolvedValue({ data: null });

      expect(
        await requestHandler.request(apiUrl, { method: 'head' }),
      ).toMatchObject({ data: null });
    });
  });
});
