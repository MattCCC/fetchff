/* eslint-disable @typescript-eslint/no-explicit-any */
import PromiseAny from 'promise-any';
import { RequestHandler } from '../src/request-handler';
import fetchMock from 'fetch-mock';
import { fetchf, FetchResponse } from '../src';
import {
  interceptRequest,
  interceptResponse,
} from '../src/interceptor-manager';
import { delayInvocation } from '../src/utils';

jest.mock('../src/interceptor-manager', () => ({
  interceptRequest: jest.fn().mockImplementation(async (config) => config),
  interceptResponse: jest.fn().mockImplementation(async (response) => response),
}));

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

  console.warn = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach((done) => {
    done();
  });

  it('should get request instance', () => {
    const requestHandler = new RequestHandler({ fetcher });

    const response = requestHandler.getInstance();

    expect(response).toBeTruthy();
  });

  describe('buildConfig() with native fetch()', () => {
    let requestHandler: RequestHandler = null;

    beforeAll(() => {
      requestHandler = new RequestHandler({});
    });

    const buildConfig = (method, url, data, config) =>
      (requestHandler as any).buildConfig(url, data, {
        ...config,
        method,
      });

    it('should not differ when the same request is made', () => {
      const result = buildConfig(
        'GET',
        'https://example.com/api',
        { foo: 'bar' },
        { baseURL: 'abc' },
      );

      const result2 = buildConfig(
        'GET',
        'https://example.com/api',
        { foo: 'bar' },
        { baseURL: 'abc' },
      );

      expect(result).toEqual(result2);
    });

    it('should handle GET requests correctly', () => {
      const result = buildConfig(
        'GET',
        'https://example.com/api',
        { foo: 'bar' },
        {},
      );

      expect(result).toEqual({
        url: 'https://example.com/api?foo=bar',
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        },
      });
    });

    it('should handle POST requests correctly', () => {
      const result = buildConfig(
        'POST',
        'https://example.com/api',
        { foo: 'bar' },
        {},
      );

      expect(result).toEqual({
        url: 'https://example.com/api',
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        },
        body: JSON.stringify({ foo: 'bar' }),
      });
    });

    it('should handle PUT requests correctly', () => {
      const result = buildConfig(
        'PUT',
        'https://example.com/api',
        { foo: 'bar' },
        {},
      );

      expect(result).toEqual({
        url: 'https://example.com/api',
        method: 'PUT',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        },
        body: JSON.stringify({ foo: 'bar' }),
      });
    });

    it('should handle DELETE requests correctly', () => {
      const result = buildConfig(
        'DELETE',
        'https://example.com/api',
        { foo: 'bar' },
        {},
      );

      expect(result).toEqual({
        url: 'https://example.com/api',
        method: 'DELETE',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        },
        body: JSON.stringify({ foo: 'bar' }),
      });
    });

    it('should handle custom headers and config when both data and query params are passed', () => {
      const result = buildConfig(
        'POST',
        'https://example.com/api',
        { foo: 'bar' },
        {
          headers: { Authorization: 'Bearer token' },
          data: { additional: 'info' },
        },
      );

      expect(result).toEqual({
        url: 'https://example.com/api?foo=bar',
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
          Authorization: 'Bearer token',
        },
        body: JSON.stringify({ additional: 'info' }),
      });
    });

    it('should handle empty data and config', () => {
      const result = buildConfig('POST', 'https://example.com/api', null, {});

      expect(result).toEqual({
        url: 'https://example.com/api',
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        },
        body: null,
      });
    });

    it('should handle data as string', () => {
      const result = buildConfig(
        'POST',
        'https://example.com/api',
        'rawData',
        {},
      );

      expect(result).toEqual({
        url: 'https://example.com/api',
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        },
        body: 'rawData',
      });
    });

    it('should correctly append query params for GET-alike methods', () => {
      const result = buildConfig(
        'head',
        'https://example.com/api',
        { foo: [1, 2] },
        {},
      );

      expect(result).toEqual({
        url: 'https://example.com/api?foo[]=1&foo[]=2',
        method: 'HEAD',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        },
      });
    });

    it('should handle POST with query params in config', () => {
      const result = buildConfig(
        'POST',
        'https://example.com/api',
        { foo: 'bar' },
        { data: { additional: 'info' } },
      );

      expect(result).toEqual({
        url: 'https://example.com/api?foo=bar',
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        },
        body: JSON.stringify({ additional: 'info' }),
      });
    });

    it('should append credentials if flag is used', () => {
      const result = buildConfig('POST', 'https://example.com/api', null, {
        withCredentials: true,
      });

      expect(result).toEqual({
        url: 'https://example.com/api',
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        },
        credentials: 'include',
        body: null,
      });
    });

    it('should not append query params to POST requests if body is set as data', () => {
      const result = buildConfig(
        'POST',
        'https://example.com/api',
        {
          foo: 'bar',
        },
        {},
      );

      expect(result).toEqual({
        url: 'https://example.com/api',
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        },
        body: JSON.stringify({ foo: 'bar' }),
      });
    });

    it('should not append body nor data to GET requests', () => {
      const result = buildConfig(
        'GET',
        'https://example.com/api',
        { foo: 'bar' },
        { body: { additional: 'info' }, data: { additional: 'info' } },
      );

      expect(result).toEqual({
        url: 'https://example.com/api?foo=bar',
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        },
      });
    });
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
      const requestHandler = new RequestHandler({
        fetcher,
        strategy: 'silent',
      });

      (requestHandler.requestInstance as any).request = jest
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

      const response = await PromiseAny([request, timeout]);

      expect(response).toBe('timeout');
    });

    it('should reject promise when using rejection strategy', async () => {
      const requestHandler = new RequestHandler({
        fetcher,
        strategy: 'reject',
      });

      (requestHandler.requestInstance as any).request = jest
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
      const requestHandler = new RequestHandler({
        fetcher,
        strategy: 'silent',
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      try {
        await requestHandler.request(apiUrl, null, {
          strategy: 'reject',
        });
      } catch (error) {
        expect(typeof error).toBe('object');
      }
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
        shouldRetry: jest.fn(() => Promise.resolve(true)), // Always retry
      };

      // Initialize RequestHandler with mock configuration
      const requestHandler = new RequestHandler({
        baseURL,
        retry: retryConfig,
        logger: mockLogger,
        onError: jest.fn(),
      });

      // Mock fetch to fail twice and then succeed
      let callCount = 0;
      (globalThis.fetch as any).mockImplementation(() => {
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
      const requestHandler = new RequestHandler({
        baseURL,
        retry: retryConfig,
        logger: mockLogger,
        onError: jest.fn(),
      });

      (globalThis.fetch as any).mockRejectedValue({
        status: 500,
        json: jest.fn().mockResolvedValue({}),
      });

      const mockDelayInvocation = delayInvocation as jest.MockedFunction<
        typeof delayInvocation
      >;

      mockDelayInvocation.mockResolvedValue(undefined);

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
        'Attempt 1 failed. Retrying in 100ms...',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempt 2 failed. Retrying in 150ms...',
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempt 3 failed. Retrying in 225ms...',
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
      const requestHandler = new RequestHandler({
        baseURL,
        retry: retryConfig,
        logger: mockLogger,
        onError: jest.fn(),
      });

      (globalThis.fetch as any).mockRejectedValue({
        status: 400,
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(requestHandler.request('/endpoint')).rejects.toEqual({
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
      const requestHandler = new RequestHandler({
        baseURL,
        retry: retryConfig,
        logger: mockLogger,
        onError: jest.fn(),
      });

      (globalThis.fetch as any).mockRejectedValue({
        status: 500,
        json: jest.fn().mockResolvedValue({}),
      });

      const mockDelayInvocation = delayInvocation as jest.MockedFunction<
        typeof delayInvocation
      >;

      mockDelayInvocation.mockResolvedValue(undefined);

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
      const requestHandler = new RequestHandler({
        baseURL,
        retry: retryConfig,
        logger: mockLogger,
        onError: jest.fn(),
      });

      (globalThis.fetch as any).mockRejectedValue({
        status: 500,
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(requestHandler.request('/endpoint')).rejects.toEqual({
        status: 500,
        json: expect.any(Function),
      });

      expect(globalThis.fetch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('request() with interceptors', () => {
    let requestHandler: RequestHandler;

    beforeEach(() => {
      requestHandler = new RequestHandler({
        baseURL: 'https://api.example.com',
        timeout: 5000,
        cancellable: true,
        rejectCancelled: true,
        strategy: 'reject',
        flattenResponse: true,
        defaultResponse: null,
        onError: () => {},
      });

      jest.useFakeTimers();
      fetchMock.reset();
    });

    afterEach(() => {
      jest.useRealTimers();
      (interceptRequest as jest.Mock).mockReset();
      (interceptResponse as jest.Mock).mockReset();
      (interceptRequest as jest.Mock).mockImplementation(
        async (config) => config,
      );
      (interceptResponse as jest.Mock).mockImplementation(
        async (response) => response,
      );
    });

    it('should apply interceptors correctly', async () => {
      // Set up mock implementations if needed
      (interceptRequest as jest.Mock).mockImplementation(
        async (config) => config,
      );
      (interceptResponse as jest.Mock).mockImplementation(
        async (response) => response,
      );

      fetchMock.mock('https://api.example.com/test-endpoint?key=value', {
        status: 200,
        body: { data: 'response from second request' },
      });

      const url = '/test-endpoint';
      const data = { key: 'value' };
      const config = {};

      // Call the request method
      await requestHandler.request(url, data, config);

      // Verify that interceptRequest and interceptResponse were called
      expect(interceptRequest).toHaveBeenCalled();
      expect(interceptResponse).toHaveBeenCalled();
    });

    it('should handle modified config in interceptRequest', async () => {
      (interceptRequest as jest.Mock).mockImplementation(async (config) => ({
        ...config,
        headers: { 'Modified-Header': 'ModifiedValue' },
      }));
      (interceptResponse as jest.Mock).mockImplementation(
        async (response) => response,
      );

      fetchMock.mock('https://api.example.com/test-endpoint?key=value', {
        status: 200,
        body: { data: 'response with modified config' },
      });

      const url = '/test-endpoint';
      const data = { key: 'value' };
      const config = {};

      await requestHandler.request(url, data, config);

      expect(interceptRequest).toHaveBeenCalled();
      expect(interceptResponse).toHaveBeenCalled();
      // Verify that fetch was called with modified headers
      expect(fetchMock.lastOptions()).toMatchObject({
        headers: { 'Modified-Header': 'ModifiedValue' },
      });
    });

    it('should handle modified response in interceptResponse', async () => {
      (interceptRequest as jest.Mock).mockImplementation(
        async (config) => config,
      );
      (interceptResponse as jest.Mock).mockImplementation(async (response) => ({
        ...response,
        data: { username: 'modified response' },
      }));

      fetchMock.mock('https://api.example.com/test-endpoint?key=value', {
        status: 200,
        data: { username: 'original response' },
      });

      const url = '/test-endpoint';
      const data = { key: 'value' };
      const config = {};

      const response = await requestHandler.request(url, data, config);

      expect(interceptRequest).toHaveBeenCalled();
      expect(interceptResponse).toHaveBeenCalled();
      expect(response).toMatchObject({ username: 'modified response' });
    });

    it('should handle request failure with interceptors', async () => {
      (interceptRequest as jest.Mock).mockImplementation(
        async (config) => config,
      );
      (interceptResponse as jest.Mock).mockImplementation(
        async (response) => response,
      );

      fetchMock.mock('https://api.example.com/test-endpoint?key=value', {
        status: 500,
        body: { error: 'Server error' },
      });

      const url = '/test-endpoint';
      const data = { key: 'value' };
      const config = {};

      await expect(requestHandler.request(url, data, config)).rejects.toThrow(
        'https://api.example.com/test-endpoint?key=value failed! Status: 500',
      );

      expect(interceptRequest).toHaveBeenCalled();
      expect(interceptResponse).not.toHaveBeenCalled();
    });

    it('should handle request with different response status', async () => {
      (interceptRequest as jest.Mock).mockImplementation(
        async (config) => config,
      );
      (interceptResponse as jest.Mock).mockImplementation(
        async (response) => response,
      );

      fetchMock.mock('https://api.example.com/test-endpoint?key=value', {
        status: 404,
        body: { error: 'Not found' },
      });

      const url = '/test-endpoint';
      const data = { key: 'value' };
      const config = {};

      await expect(requestHandler.request(url, data, config)).rejects.toThrow(
        'https://api.example.com/test-endpoint?key=value failed! Status: 404',
      );

      expect(interceptRequest).toHaveBeenCalled();
      expect(interceptResponse).not.toHaveBeenCalled();
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
      const requestHandler = new RequestHandler({
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

      const response = await PromiseAny([request, timeout]);

      expect(response).toBe('timeout');
    });

    it('should reject promise when using rejection strategy', async () => {
      const requestHandler = new RequestHandler({
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
      const requestHandler = new RequestHandler({
        strategy: 'silent',
      });

      globalThis.fetch = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      try {
        await requestHandler.request(apiUrl, null, {
          strategy: 'reject',
        });
      } catch (error) {
        expect(typeof error).toBe('object');
      }
    });
  });

  describe('handleCancellation()', () => {
    beforeEach(() => {
      globalThis.fetch = jest.fn();
    });

    it('should not add request to the queue if cancellation is globally disabled', async () => {
      const requestHandler = new RequestHandler({
        fetcher,
        strategy: 'reject',
        cancellable: false,
        timeout: 0,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn((requestHandler as any).requestsQueue, 'get');

      await requestHandler.request(apiUrl);

      expect(spy).not.toHaveBeenCalled();
    });

    it('should not add request to the queue if cancellation is disabled per route', async () => {
      const requestHandler = new RequestHandler({
        fetcher,
        strategy: 'reject',
        cancellable: true,
        timeout: 0,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn((requestHandler as any).requestsQueue, 'get');

      await requestHandler.request(
        apiUrl,
        {},
        {
          cancellable: false,
        },
      );

      expect(spy).not.toHaveBeenCalled();
    });

    it('should add request to the queue if cancellation is enabled per route', async () => {
      const requestHandler = new RequestHandler({
        fetcher,
        strategy: 'reject',
        cancellable: true,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn((requestHandler as any).requestsQueue, 'get');

      await requestHandler.request(
        apiUrl,
        {},
        {
          cancellable: true,
        },
      );

      expect(spy).toHaveBeenCalled();
    });

    it('should add request to the queue if cancellation is enabled per route but globally cancellation is disabled', async () => {
      const requestHandler = new RequestHandler({
        fetcher,
        strategy: 'reject',
        cancellable: false,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn((requestHandler as any).requestsQueue, 'get');

      await requestHandler.request(
        apiUrl,
        {},
        {
          cancellable: true,
        },
      );

      expect(spy).toHaveBeenCalled();
    });

    it('should add request to the queue if cancellation is not specified per route but globally only', async () => {
      const requestHandler = new RequestHandler({
        fetcher,
        strategy: 'reject',
        cancellable: true,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn((requestHandler as any).requestsQueue, 'get');

      await requestHandler.request(apiUrl);

      expect(spy).toHaveBeenCalled();
    });

    it('should cancel previous request when successive request is made', async () => {
      fetchMock.reset();

      const requestHandler = new RequestHandler({
        cancellable: true,
        rejectCancelled: true,
        flattenResponse: true,
      });

      fetchMock.mock(
        'https://example.com/first',
        new Promise((_resolve, reject) => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
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
        username: 'response from second request',
      });
      expect(firstRequest).rejects.toThrow('The operation was aborted.');
    });

    it('should cancel previous request when successive request is made through fetchf() and rejectCancelled is false', async () => {
      fetchMock.reset();

      const abortedError = new DOMException(
        'The operation was aborted.',
        'AbortError',
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
      });
      const secondRequest = fetchf('https://example.com/second', {
        flattenResponse: true,
      });

      expect(secondRequest).resolves.toEqual({
        username: 'response from second request',
      });
      expect(firstRequest).resolves.toEqual({});
    });
  });

  describe('parseData()', () => {
    let mockResponse: FetchResponse;
    const requestHandler = new RequestHandler({ fetcher });

    beforeEach(() => {
      mockResponse = {
        headers: {
          get: jest.fn(),
        },
        clone: jest.fn(),
        json: jest.fn(),
        formData: jest.fn(),
        blob: jest.fn(),
        text: jest.fn(),
        body: 'something',
      } as unknown as FetchResponse;
    });

    it('should parse JSON response when Content-Type is application/json', async () => {
      (mockResponse.headers.get as jest.Mock).mockReturnValue(
        'application/json',
      );
      const expectedData = { key: 'value' };
      (mockResponse.json as jest.Mock).mockResolvedValue(expectedData);

      const data = await requestHandler.parseData(mockResponse);
      expect(data).toEqual(expectedData);
    });

    it('should parse JSON response when Content-Type is application/vnd.api+json', async () => {
      (mockResponse.headers.get as jest.Mock).mockReturnValue(
        'application/vnd.api+json',
      );
      const expectedData = { key: 'value' };
      (mockResponse.json as jest.Mock).mockResolvedValue(expectedData);

      const data = await requestHandler.parseData(mockResponse);
      expect(data).toEqual(expectedData);
    });

    it('should parse FormData when Content-Type is multipart/form-data', async () => {
      (mockResponse.headers.get as jest.Mock).mockReturnValue(
        'multipart/form-data',
      );
      const expectedData = new FormData();
      (mockResponse.formData as jest.Mock).mockResolvedValue(expectedData);

      const data = await requestHandler.parseData(mockResponse);
      expect(data).toEqual(expectedData);
    });

    it('should parse Blob when Content-Type is application/octet-stream', async () => {
      (mockResponse.headers.get as jest.Mock).mockReturnValue(
        'application/octet-stream',
      );
      const expectedData = new Blob(['test']);
      (mockResponse.blob as jest.Mock).mockResolvedValue(expectedData);

      const data = await requestHandler.parseData(mockResponse);
      expect(data).toEqual(expectedData);
    });

    it('should parse FormData when Content-Type is application/x-www-form-urlencoded', async () => {
      (mockResponse.headers.get as jest.Mock).mockReturnValue(
        'application/x-www-form-urlencoded',
      );
      const expectedData = new FormData();
      (mockResponse.formData as jest.Mock).mockResolvedValue(expectedData);

      const data = await requestHandler.parseData(mockResponse);
      expect(data).toEqual(expectedData);
    });

    it('should parse text when Content-Type is text/plain', async () => {
      (mockResponse.headers.get as jest.Mock).mockReturnValue('text/plain');
      const expectedData = 'Some plain text';
      (mockResponse.text as jest.Mock).mockResolvedValue(expectedData);

      const data = await requestHandler.parseData(mockResponse);
      expect(data).toEqual(expectedData);
    });

    it('should return plain text when Content-Type is missing and JSON parsing fails', async () => {
      (mockResponse.headers.get as jest.Mock).mockReturnValue('');
      const responseClone = {
        json: jest.fn().mockRejectedValue(new Error('JSON parsing error')),
      };
      (mockResponse.clone as jest.Mock).mockReturnValue(responseClone);

      const expectedData = 'Some plain text';
      (mockResponse.text as jest.Mock).mockResolvedValue(expectedData);

      const data = await requestHandler.parseData(mockResponse);

      expect(data).toBe('Some plain text');
    });

    it('should return null when content type is not recognized and response parsing fails', async () => {
      (mockResponse.headers.get as jest.Mock).mockReturnValue(
        'application/unknown-type',
      );
      (mockResponse.text as jest.Mock).mockRejectedValue(
        new Error('Text parsing error'),
      );

      const data = await requestHandler.parseData(mockResponse);
      expect(data).toBeNull();
    });

    it('should handle streams and return body or data when Content-Type is not recognized', async () => {
      (mockResponse.headers.get as jest.Mock).mockReturnValue(
        'application/unknown-type',
      );

      // Mock the `text` method to simulate stream content
      const streamContent = 'stream content';
      (mockResponse.text as jest.Mock).mockResolvedValue(streamContent);

      const data = await requestHandler.parseData(mockResponse);
      expect(data).toEqual(streamContent);
    });
  });

  describe('processHeaders()', () => {
    const requestHandler = new RequestHandler({ fetcher });

    // Test when headers is null or undefined
    it('should return an empty object if headers are null or undefined', () => {
      const response = { headers: null } as FetchResponse;
      const result = requestHandler.processHeaders(response);
      expect(result).toEqual({});

      const responseUndefined = { headers: undefined } as FetchResponse;
      const resultUndefined = requestHandler.processHeaders(responseUndefined);
      expect(resultUndefined).toEqual({});
    });

    // Test when headers is an instance of Headers
    it('should convert Headers object to a plain object', () => {
      const headers = new Headers();
      headers.append('Content-Type', 'application/json');
      headers.append('Authorization', 'Bearer token');

      const response = { headers } as FetchResponse;
      const result = requestHandler.processHeaders(response);

      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      });
    });

    // Test when headers is a plain object
    it('should handle plain object headers', () => {
      const response = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
      } as unknown as FetchResponse;

      const result = requestHandler.processHeaders(response);

      expect(result).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      });
    });

    // Test when headers is an empty Headers object
    it('should handle an empty Headers object', () => {
      const headers = new Headers(); // Empty Headers
      const response = { headers } as FetchResponse;
      const result = requestHandler.processHeaders(response);

      expect(result).toEqual({});
    });
  });

  describe('outputResponse()', () => {
    it('should show nested data object if flattening is off', async () => {
      const requestHandler = new RequestHandler({
        fetcher,
        flattenResponse: false,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue(responseMock);

      const response = await requestHandler.request(apiUrl, null, {
        method: 'put',
      });

      expect(response).toMatchObject(responseMock);
    });

    it('should handle nested data if data flattening is on', async () => {
      const requestHandler = new RequestHandler({
        fetcher,
        flattenResponse: true,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue(responseMock);

      const response = await requestHandler.request(apiUrl, null, {
        method: 'post',
      });

      expect(response).toMatchObject(responseMock.data);
    });

    it('should handle deeply nested data if data flattening is on', async () => {
      const requestHandler = new RequestHandler({
        fetcher,
        flattenResponse: true,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue({ data: responseMock });

      const response = await requestHandler.request(apiUrl, null, {
        method: 'patch',
      });

      expect(response).toMatchObject(responseMock.data);
    });

    it('should return null if there is no data', async () => {
      const requestHandler = new RequestHandler({
        fetcher,
        flattenResponse: true,
        defaultResponse: null,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue({ data: null });

      expect(
        await requestHandler.request(apiUrl, null, { method: 'head' }),
      ).toBe(null);
    });
  });
});
