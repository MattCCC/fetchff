/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import PromiseAny from 'promise-any';
import { RequestHandler } from '../src/request-handler';
import fetchMock from 'fetch-mock';
import { fetchf } from '../src';

describe('Request Handler', () => {
  const apiUrl = 'http://example.com/api/';
  const responseMock = {
    data: {
      test: 'data',
    },
  };

  console.warn = jest.fn();

  afterEach((done) => {
    done();
  });

  it('should get request instance', () => {
    const requestHandler = new RequestHandler({
      fetcher: axios,
    });

    const response = requestHandler.getInstance();

    expect(response).toBeTruthy();
  });

  describe('isJSONSerializable()', () => {
    let requestHandler = null;

    beforeAll(() => {
      requestHandler = new RequestHandler({});
    });

    it('should return false for undefined', () => {
      expect(requestHandler.isJSONSerializable(undefined)).toBe(false);
    });

    it('should return false for null', () => {
      expect(requestHandler.isJSONSerializable(null)).toBe(false);
    });

    it('should return true for primitive types', () => {
      expect(requestHandler.isJSONSerializable('string')).toBe(true);
      expect(requestHandler.isJSONSerializable(123)).toBe(true);
      expect(requestHandler.isJSONSerializable(true)).toBe(true);
    });

    it('should return true for arrays', () => {
      expect(requestHandler.isJSONSerializable([1, 2, 3])).toBe(true);
    });

    it('should return false for non-plain objects', () => {
      expect(requestHandler.isJSONSerializable(new Date())).toBe(false);
      expect(requestHandler.isJSONSerializable(new Map())).toBe(false);
      expect(requestHandler.isJSONSerializable(new Set())).toBe(false);
      expect(requestHandler.isJSONSerializable(new WeakMap())).toBe(false);
      expect(requestHandler.isJSONSerializable(new WeakSet())).toBe(false);
    });

    it('should return false for buffers', () => {
      const buffer = Buffer.from('test');
      expect(requestHandler.isJSONSerializable(buffer)).toBe(false);
    });

    it('should return true for plain objects', () => {
      expect(requestHandler.isJSONSerializable({})).toBe(true);
    });

    it('should return true for objects with toJSON method', () => {
      const obj = {
        toJSON() {
          return { key: 'value' };
        },
      };
      expect(requestHandler.isJSONSerializable(obj)).toBe(true);
    });

    it('should return false for functions', () => {
      const func = function () {};
      expect(requestHandler.isJSONSerializable(func)).toBe(false);
    });

    it('should return false for symbols', () => {
      const symbol = Symbol('test');
      expect(requestHandler.isJSONSerializable(symbol)).toBe(false);
    });
  });

  describe('replaceUrlPathParams()', () => {
    let requestHandler: RequestHandler = null;

    beforeAll(() => {
      requestHandler = new RequestHandler({});
    });

    it('should replace a single placeholder with a value from urlPathParams', () => {
      const url = '/users/:userId';
      const params = { userId: 123 };

      const result = requestHandler.replaceUrlPathParams(url, params);

      expect(result).toBe('/users/123');
    });

    it('should replace multiple placeholders with corresponding values from urlPathParams', () => {
      const url = '/users/:userId/posts/:postId';
      const params = { userId: 123, postId: 456 };

      const result = requestHandler.replaceUrlPathParams(url, params);

      expect(result).toBe('/users/123/posts/456');
    });

    it('should leave placeholders unchanged if no corresponding value is provided in urlPathParams', () => {
      const url = '/users/:userId/posts/:postId';
      const params = { userName: 'john' };

      const result = requestHandler.replaceUrlPathParams(url, params);

      expect(result).toBe('/users/:userId/posts/:postId');
    });

    it('should handle placeholders with special characters', () => {
      const url = '/users/:userId/details/:detailId';
      const params = { userId: 123, detailId: 'abc' };

      const result = requestHandler.replaceUrlPathParams(url, params);

      expect(result).toBe('/users/123/details/abc');
    });

    it('should handle empty urlPathParams object', () => {
      const url = '/users/:userId';
      const params = {};

      const result = requestHandler.replaceUrlPathParams(url, params);

      expect(result).toBe('/users/:userId');
    });

    it('should replace placeholders even when URL contains query parameters', () => {
      const url = '/users/:userId?name=:name';
      const params = { userId: 123, name: 'john' };

      const result = requestHandler.replaceUrlPathParams(url, params);

      expect(result).toBe('/users/123?name=john');
    });

    it('should handle URL with no placeholders', () => {
      const url = '/users/123';
      const params = { userId: 456 };

      const result = requestHandler.replaceUrlPathParams(url, params);

      expect(result).toBe('/users/123');
    });
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

    it('should handle custom headers and config', () => {
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
        url: 'https://example.com/api',
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
      const result = buildConfig(
        'POST',
        'https://example.com/api',
        undefined,
        {},
      );

      expect(result).toEqual({
        url: 'https://example.com/api',
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        },
        body: undefined,
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
        'GET',
        'https://example.com/api',
        { foo: [1, 2] },
        {},
      );

      expect(result).toEqual({
        url: 'https://example.com/api?foo[]=1&foo[]=2',
        method: 'GET',
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
        url: 'https://example.com/api',
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        },
        body: JSON.stringify({ additional: 'info' }),
      });
    });
  });

  describe('appendQueryParams()', () => {
    let requestHandler = null;

    beforeAll(() => {
      requestHandler = new RequestHandler({});
    });

    it('should append single query parameter to URL without existing query string', () => {
      const url = 'https://api.example.com/resource';
      const params = { foo: 'bar' };
      const result = requestHandler.appendQueryParams(url, params);
      expect(result).toBe('https://api.example.com/resource?foo=bar');
    });

    it('should append multiple query parameters to URL without existing query string', () => {
      const url = 'https://api.example.com/resource';
      const params = { foo: 'bar', baz: 'qux' };
      const result = requestHandler.appendQueryParams(url, params);
      expect(result).toBe('https://api.example.com/resource?foo=bar&baz=qux');
    });

    it('should append array query parameters correctly', () => {
      const url = 'https://api.example.com/resource';
      const params = { foo: [1, 2], bar: 'baz' };
      const result = requestHandler.appendQueryParams(url, params);
      expect(result).toBe(
        'https://api.example.com/resource?foo[]=1&foo[]=2&bar=baz',
      );
    });

    it('should append parameters to URL with existing query string', () => {
      const url = 'https://api.example.com/resource?existing=param';
      const params = { foo: 'bar' };
      const result = requestHandler.appendQueryParams(url, params);
      expect(result).toBe(
        'https://api.example.com/resource?existing=param&foo=bar',
      );
    });

    it('should handle special characters in query parameters', () => {
      const url = 'https://api.example.com/resource';
      const params = { 'special key': 'special value' };
      const result = requestHandler.appendQueryParams(url, params);
      expect(result).toBe(
        'https://api.example.com/resource?special%20key=special%20value',
      );
    });

    it('should return the original URL if no params are provided', () => {
      const url = 'https://api.example.com/resource';
      const params = {};
      const result = requestHandler.appendQueryParams(url, params);
      expect(result).toBe('https://api.example.com/resource');
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
        fetcher: axios,
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
        fetcher: axios,
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
        fetcher: axios,
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
          json: jest.fn().mockResolvedValue({}),
        });
      });

      // Spy on delay method to avoid actual delays
      jest
        .spyOn(requestHandler, 'delay')
        .mockImplementation(() => Promise.resolve(true));

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
      expect(requestHandler.delay).toHaveBeenCalledTimes(retryConfig.retries);
      expect(requestHandler.delay).toHaveBeenCalledWith(retryConfig.delay);
      expect(requestHandler.delay).toHaveBeenCalledWith(
        retryConfig.delay * retryConfig.backoff,
      );

      expect(requestHandler.delay).toHaveBeenCalledWith(
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

      jest
        .spyOn(requestHandler, 'delay')
        .mockImplementation(jest.fn().mockResolvedValue(undefined));

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

      jest
        .spyOn(requestHandler, 'delay')
        .mockImplementation(jest.fn().mockResolvedValue(undefined));

      try {
        await requestHandler.request('/endpoint');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        //
      }

      // Advance time for the total delay
      jest.advanceTimersByTime(100 + 150 + 225);

      expect(requestHandler.delay).toHaveBeenCalledTimes(3);
      expect(requestHandler.delay).toHaveBeenCalledWith(100);
      expect(requestHandler.delay).toHaveBeenCalledWith(150);
      expect(requestHandler.delay).toHaveBeenCalledWith(225);
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
      jest.useFakeTimers();
      globalThis.fetch = jest.fn();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should not set cancel token if cancellation is globally disabled', async () => {
      const requestHandler = new RequestHandler({
        fetcher: axios,
        strategy: 'reject',
        cancellable: false,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn(requestHandler.requestInstance as any, 'request');

      await requestHandler.request(apiUrl);

      expect(spy).toHaveBeenCalledWith(
        expect.not.objectContaining({
          signal: expect.any(Object),
        }),
      );
    });

    it('should not set cancel token if cancellation is disabled per route', async () => {
      const requestHandler = new RequestHandler({
        fetcher: axios,
        strategy: 'reject',
        cancellable: true,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn(requestHandler.requestInstance as any, 'request');

      await requestHandler.request(
        apiUrl,
        {},
        {
          cancellable: false,
        },
      );

      expect(spy).toHaveBeenCalledWith(
        expect.not.objectContaining({
          signal: expect.any(Object),
        }),
      );
    });

    it('should set cancel token if cancellation is enabled per route', async () => {
      const requestHandler = new RequestHandler({
        fetcher: axios,
        strategy: 'reject',
        cancellable: true,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn(requestHandler.requestInstance as any, 'request');

      await requestHandler.request(
        apiUrl,
        {},
        {
          cancellable: true,
        },
      );

      expect(spy).not.toHaveBeenCalledWith({});
    });

    it('should set cancel token if cancellation is enabled per route but globally cancellation is disabled', async () => {
      const requestHandler = new RequestHandler({
        fetcher: axios,
        strategy: 'reject',
        cancellable: false,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn(requestHandler.requestInstance as any, 'request');

      await requestHandler.request(
        apiUrl,
        {},
        {
          cancellable: true,
        },
      );

      expect(spy).not.toHaveBeenCalledWith({});
    });

    it('should set cancel token if cancellation is not enabled per route but globally only', async () => {
      const requestHandler = new RequestHandler({
        fetcher: axios,
        strategy: 'reject',
        cancellable: true,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn(requestHandler.requestInstance as any, 'request');

      await requestHandler.request(apiUrl);

      expect(spy).not.toHaveBeenCalledWith({});
    });

    it('should cancel previous request when successive request is made', async () => {
      fetchMock.reset();

      const requestHandler = new RequestHandler({
        cancellable: true,
        rejectCancelled: true,
      });

      fetchMock.mock(
        'https://example.com/first',
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('Request was cancelled')), 1000);
        }),
      );

      fetchMock.mock('https://example.com/second', {
        status: 200,
        body: { data: 'response from second request' },
      });

      const firstRequest = requestHandler.request('https://example.com/first');
      const secondRequest = requestHandler.request(
        'https://example.com/second',
      );

      expect(secondRequest).resolves.toEqual('response from second request');

      expect(firstRequest).rejects.toThrow('Request was cancelled');
    });

    it('should cancel previous request when successive request is made through fetchf()', async () => {
      fetchMock.reset();

      fetchMock.mock(
        'https://example.com/first',
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('Request was cancelled')), 1000);
        }),
      );

      fetchMock.mock('https://example.com/second', {
        status: 200,
        body: { data: 'response from second request' },
      });

      const firstRequest = fetchf('https://example.com/first');
      const secondRequest = fetchf('https://example.com/second');

      expect(secondRequest).resolves.toEqual('response from second request');

      expect(firstRequest).rejects.toThrow('Request was cancelled');
    });
  });

  describe('processResponseData()', () => {
    it('should show nested data object if flattening is off', async () => {
      const requestHandler = new RequestHandler({
        fetcher: axios,
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
        fetcher: axios,
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
        fetcher: axios,
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
        fetcher: axios,
        flattenResponse: true,
        defaultResponse: null,
      });

      (requestHandler.requestInstance as any).request = jest
        .fn()
        .mockResolvedValue({});

      expect(
        await requestHandler.request(apiUrl, null, { method: 'head' }),
      ).toBe(null);
    });
  });
});
