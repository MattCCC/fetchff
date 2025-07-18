/* eslint-disable @typescript-eslint/no-explicit-any */
import { endpoints } from './mocks/endpoints';
import { createApiFetcher } from '../src';
import fetchMock from 'fetch-mock';

describe('API Handler', () => {
  fetchMock.mockGlobal();

  const fetcher = jest.fn();
  const apiUrl = 'http://example.com/api/';
  const config = {
    fetcher,
    apiUrl,
    endpoints,
    onError: jest.fn(),
  };
  const userDataMock = { name: 'Mark', age: 20 };

  console.warn = jest.fn();
  console.error = jest.fn();

  afterEach((done) => {
    done();
  });

  describe('get()', () => {
    it('should trigger request handler for an existent endpoint', async () => {
      const api = createApiFetcher(config);

      jest.spyOn(api, 'request').mockResolvedValueOnce(userDataMock as any);

      const response = await api.getUser({ params: { userId: 1 } });

      expect(api.request).toHaveBeenCalledTimes(1);
      expect(api.request).toHaveBeenCalledWith('getUser', {
        params: { userId: 1 },
      });
      expect(response).toBe(userDataMock);
    });

    it('should not trigger request handler for non-existent endpoint', async () => {
      const api = createApiFetcher(config);

      api.request = jest.fn().mockResolvedValueOnce(userDataMock);

      const response = await (api as any).getUserAddress({
        userId: 1,
      });

      expect(api.request).not.toHaveBeenCalled();
      expect(response).toBeNull();
    });
  });

  describe('request()', () => {
    it('should properly dispatch request', async () => {
      const api = createApiFetcher(config);
      const urlPathParams = {
        id: 1,
        name: 'Mark',
      };

      jest.spyOn(api, 'request').mockResolvedValueOnce(userDataMock as any);

      const response = await api.getUserByIdAndName({ urlPathParams });

      expect(api.request).toHaveBeenCalledTimes(1);
      expect(api.request).toHaveBeenCalledWith('getUserByIdAndName', {
        urlPathParams,
      });
      expect(response).toBe(userDataMock);
    });

    it('should properly call an endpoint with custom headers', async () => {
      const api = createApiFetcher(config);
      const urlPathParams = {
        id: 1,
        name: 'Mark',
      };

      const headers = {
        'Content-Type': 'application/json',
      };

      jest.spyOn(api, 'request').mockResolvedValueOnce(userDataMock as any);

      const response = await api.getUserByIdAndName({
        urlPathParams,
        headers,
      });

      expect(api.request).toHaveBeenCalledTimes(1);
      expect(api.request).toHaveBeenCalledWith('getUserByIdAndName', {
        headers,
        urlPathParams,
      });
      expect(response).toBe(userDataMock);
    });

    it('should prevent potential Server-Side Request Forgery attack by not leaking auth header', async () => {
      const instanceAuthToken = 'Bearer token';
      const api = createApiFetcher({
        ...config,
        headers: {
          Authorization: instanceAuthToken,
        },
      });

      fetchMock.route('https://attackers-site.com', {
        status: 200,
        body: { data: userDataMock },
      });

      const response = await api.request('https://attackers-site.com');

      // @ts-expect-error Authorization header is not defined in the mock
      expect(response.config.headers['Authorization']).toBeUndefined();
    });

    it('should merge headers from config, endpoint, and request', async () => {
      fetchMock.getOnce('http://example.com/api/getHeaders', () => {
        return { status: 200, body: 'nothing' };
      });

      const handler = createApiFetcher({
        apiUrl: 'http://example.com/api',
        headers: { 'X-Global': 'global' },
        endpoints: {
          getHeaders: {
            url: '/getHeaders',
            headers: { 'X-Endpoint': 'endpoint' },
          },
        },
      });

      const result = await handler.request('getHeaders', {
        headers: { 'X-Request': 'request' },
      });

      const headers = result?.config?.headers as
        | Record<string, string>
        | undefined;
      expect(headers?.['X-Request']).toBe('request');
      expect(headers?.['X-Endpoint']).toBe('endpoint');
      expect(headers?.['X-Global']).toBe('global');
    });
  });
});
