/* eslint-disable @typescript-eslint/no-explicit-any */
import { endpoints } from './mocks/endpoints';
import { createApiFetcher } from '../src';

describe('API Handler', () => {
  const fetcher = {
    create: jest.fn().mockReturnValue({ request: jest.fn() }),
  };

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

  it('getInstance() - should obtain method of the API request provider', () => {
    const api = createApiFetcher(config);

    expect(typeof (api.getInstance() as any).request).toBe('function');
  });

  describe('get()', () => {
    it('should trigger request handler for an existent endpoint', async () => {
      const api = createApiFetcher(config);

      jest.spyOn(api, 'request').mockResolvedValueOnce(userDataMock as any);

      const response = await api.getUser({ userId: 1 });

      expect(api.request).toHaveBeenCalledTimes(1);
      expect(api.request).toHaveBeenCalledWith('getUser', {
        userId: 1,
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

      jest
        .spyOn(api.requestHandler, 'request')
        .mockResolvedValueOnce(userDataMock as any);

      const response = await api.getUserByIdAndName(null, urlPathParams);

      expect(api.requestHandler.request).toHaveBeenCalledTimes(1);
      expect(api.requestHandler.request).toHaveBeenCalledWith(
        '/user-details/:id/:name',
        null,
        { url: '/user-details/:id/:name', urlPathParams },
      );
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

      jest
        .spyOn(api.requestHandler, 'request')
        .mockResolvedValueOnce(userDataMock as any);

      const response = await api.getUserByIdAndName(null, urlPathParams, {
        headers,
      });

      expect(api.requestHandler.request).toHaveBeenCalledTimes(1);
      expect(api.requestHandler.request).toHaveBeenCalledWith(
        '/user-details/:id/:name',
        null,
        { url: '/user-details/:id/:name', headers, urlPathParams },
      );
      expect(response).toBe(userDataMock);
    });
  });
});
