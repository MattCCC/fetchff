/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosInstance } from 'axios';
import PromiseAny from 'promise-any';
import { RequestHandler } from '../src/request-handler';

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

  describe('replaceUriParams()', () => {
    let requestHandler: RequestHandler = null;

    beforeAll(() => {
      requestHandler = new RequestHandler({});
    });

    it('should replace a single placeholder with a value from uriParams', () => {
      const url = '/users/:userId';
      const params = { userId: 123 };

      const result = requestHandler.replaceUriParams(url, params);

      expect(result).toBe('/users/123');
    });

    it('should replace multiple placeholders with corresponding values from uriParams', () => {
      const url = '/users/:userId/posts/:postId';
      const params = { userId: 123, postId: 456 };

      const result = requestHandler.replaceUriParams(url, params);

      expect(result).toBe('/users/123/posts/456');
    });

    it('should leave placeholders unchanged if no corresponding value is provided in uriParams', () => {
      const url = '/users/:userId/posts/:postId';
      const params = { userName: 'john' };

      const result = requestHandler.replaceUriParams(url, params);

      expect(result).toBe('/users/:userId/posts/:postId');
    });

    it('should handle placeholders with special characters', () => {
      const url = '/users/:userId/details/:detailId';
      const params = { userId: 123, detailId: 'abc' };

      const result = requestHandler.replaceUriParams(url, params);

      expect(result).toBe('/users/123/details/abc');
    });

    it('should handle empty uriParams object', () => {
      const url = '/users/:userId';
      const params = {};

      const result = requestHandler.replaceUriParams(url, params);

      expect(result).toBe('/users/:userId');
    });

    it('should replace placeholders even when URL contains query parameters', () => {
      const url = '/users/:userId?name=:name';
      const params = { userId: 123, name: 'john' };

      const result = requestHandler.replaceUriParams(url, params);

      expect(result).toBe('/users/123?name=john');
    });

    it('should handle URL with no placeholders', () => {
      const url = '/users/123';
      const params = { userId: 456 };

      const result = requestHandler.replaceUriParams(url, params);

      expect(result).toBe('/users/123');
    });
  });

  describe('buildRequestConfig() with native fetch()', () => {
    let requestHandler: RequestHandler = null;

    beforeAll(() => {
      requestHandler = new RequestHandler({});
    });

    const buildConfig = (method, url, data, config) =>
      (requestHandler as any).buildRequestConfig(url, data, {
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

  describe('handleRequest()', () => {
    it('should properly hang promise when using Silent strategy', async () => {
      const requestHandler = new RequestHandler({
        fetcher: axios,
        strategy: 'silent',
      });

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      const request = requestHandler.handleRequest(apiUrl);

      const timeout = new Promise((resolve) => {
        const wait = setTimeout(() => {
          clearTimeout(wait);

          resolve('timeout');
        }, 2000);
      });

      expect(typeof request.then).toBe('function');

      const response = await PromiseAny([request, timeout]);

      expect(response).toBe('timeout');
    });

    it('should reject promise when using rejection strategy', async () => {
      const requestHandler = new RequestHandler({
        fetcher: axios,
        strategy: 'reject',
      });

      (requestHandler.requestInstance as AxiosInstance).request = jest
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

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      try {
        await requestHandler.handleRequest(apiUrl, null, {
          strategy: 'reject',
        });
      } catch (error) {
        expect(typeof error).toBe('object');
      }
    });
  });

  describe('handleRequest() with native fetch()', () => {
    it('should properly hang promise when using Silent strategy', async () => {
      const requestHandler = new RequestHandler({
        strategy: 'silent',
      });

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      const request = requestHandler.handleRequest(apiUrl);

      const timeout = new Promise((resolve) => {
        const wait = setTimeout(() => {
          clearTimeout(wait);

          resolve('timeout');
        }, 2000);
      });

      expect(typeof request.then).toBe('function');

      const response = await PromiseAny([request, timeout]);

      expect(response).toBe('timeout');
    });

    it('should reject promise when using rejection strategy', async () => {
      const requestHandler = new RequestHandler({
        strategy: 'reject',
      });

      (requestHandler.requestInstance as AxiosInstance).request = jest
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

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      try {
        await requestHandler.handleRequest(apiUrl, null, {
          strategy: 'reject',
        });
      } catch (error) {
        expect(typeof error).toBe('object');
      }
    });
  });

  describe('handleCancellation()', () => {
    it('should not set cancel token if cancellation is globally disabled', async () => {
      const requestHandler = new RequestHandler({
        fetcher: axios,
        strategy: 'reject',
        cancellable: false,
      });

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn(
        requestHandler.requestInstance as AxiosInstance,
        'request',
      );

      await requestHandler.handleRequest(apiUrl);

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

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn(
        requestHandler.requestInstance as AxiosInstance,
        'request',
      );

      await requestHandler.handleRequest(
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

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn(
        requestHandler.requestInstance as AxiosInstance,
        'request',
      );

      await requestHandler.handleRequest(
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

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn(
        requestHandler.requestInstance as AxiosInstance,
        'request',
      );

      await requestHandler.handleRequest(
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

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockResolvedValue(responseMock);
      const spy = jest.spyOn(
        requestHandler.requestInstance as AxiosInstance,
        'request',
      );

      await requestHandler.handleRequest(apiUrl);

      expect(spy).not.toHaveBeenCalledWith({});
    });

    it('should cancel previous request when successive request is made', async () => {
      const requestHandler = new RequestHandler({
        fetcher: axios,
        strategy: 'silent',
        cancellable: true,
      });

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      const request = requestHandler.handleRequest(apiUrl);

      const spy = jest.spyOn(
        requestHandler.requestInstance as AxiosInstance,
        'request',
      );
      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockResolvedValue(responseMock);

      const request2 = requestHandler.handleRequest(apiUrl);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(Object),
        }),
      );

      const timeout = new Promise((resolve) => {
        const wait = setTimeout(() => {
          clearTimeout(wait);

          resolve('timeout');
        }, 2000);
      });

      expect(typeof request.then).toBe('function');

      const response = await PromiseAny([request, request2, timeout]);

      expect(response).toStrictEqual({ test: 'data' });
    });
  });

  describe('processResponseData()', () => {
    it('should show nested data object if flattening is off', async () => {
      const requestHandler = new RequestHandler({
        fetcher: axios,
        flattenResponse: false,
      });

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockResolvedValue(responseMock);

      const response = await requestHandler.handleRequest(apiUrl, null, {
        method: 'put',
      });

      expect(response).toMatchObject(responseMock);
    });

    it('should handle nested data if data flattening is on', async () => {
      const requestHandler = new RequestHandler({
        fetcher: axios,
        flattenResponse: true,
      });

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockResolvedValue(responseMock);

      const response = await requestHandler.handleRequest(apiUrl, null, {
        method: 'post',
      });

      expect(response).toMatchObject(responseMock.data);
    });

    it('should handle deeply nested data if data flattening is on', async () => {
      const requestHandler = new RequestHandler({
        fetcher: axios,
        flattenResponse: true,
      });

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockResolvedValue({ data: responseMock });

      const response = await requestHandler.handleRequest(apiUrl, null, {
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

      (requestHandler.requestInstance as AxiosInstance).request = jest
        .fn()
        .mockResolvedValue({});

      expect(
        await requestHandler.handleRequest(apiUrl, null, { method: 'head' }),
      ).toBe(null);
    });
  });
});
