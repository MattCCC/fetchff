import axios from 'axios';
import { ApiHandler } from '../src/api-handler';
import { mockErrorCallbackClass } from './http-request-error-handler.spec';
import { endpoints, EndpointsList } from './mocks/endpoints';

type TestRequestHandler = Record<string, unknown>;

describe('API Handler', () => {
  const apiUrl = 'http://example.com/api/';
  const config = {
    axios,
    apiUrl,
    endpoints,
    onError: new mockErrorCallbackClass(),
  };
  const userDataMock = { name: 'Mark', age: 20 };

  console.warn = jest.fn();

  afterEach((done) => {
    done();
  });

  it('getInstance() - should obtain method of the API request provider', () => {
    const api = new ApiHandler(config) as ApiHandler & EndpointsList;

    expect(typeof api.getInstance().request).toBe('function');
  });

  describe('__get()', () => {
    it('should trigger request handler for an existent endpoint', async () => {
      const api = new ApiHandler(config) as ApiHandler & EndpointsList;

      api.handleRequest = jest.fn().mockResolvedValueOnce(userDataMock);

      const response = await api.getUserDetails({ userId: 1 });

      expect(api.handleRequest).toHaveBeenCalledTimes(1);
      expect(api.handleRequest).toHaveBeenCalledWith('getUserDetails', {
        userId: 1,
      });
      expect(response).toBe(userDataMock);
    });

    it('should not trigger request handler for non-existent endpoint', async () => {
      const api = new ApiHandler(config) as ApiHandler & EndpointsList;

      api.handleRequest = jest.fn().mockResolvedValueOnce(userDataMock);

      const response = await (api as any).getUserAddress({
        userId: 1,
      });

      expect(api.handleRequest).not.toHaveBeenCalled();
      expect(response).toBeNull();
    });
  });

  describe('handleRequest()', () => {
    it('should properly replace multiple URL params', async () => {
      const api = new ApiHandler(config) as ApiHandler & EndpointsList;

      (api.requestHandler as unknown as TestRequestHandler).get = jest
        .fn()
        .mockResolvedValueOnce(userDataMock);

      const response = await api.getUserDetailsByIdAndName(null, {
        id: 1,
        name: 'Mark',
      });

      expect(
        (api.requestHandler as unknown as TestRequestHandler).get,
      ).toHaveBeenCalledTimes(1);
      expect(
        (api.requestHandler as unknown as TestRequestHandler).get,
      ).toHaveBeenCalledWith('/user-details/1/Mark', {}, {});
      expect(response).toBe(userDataMock);
    });

    it('should properly fill Axios compatible config', async () => {
      const api = new ApiHandler(config) as ApiHandler & EndpointsList;
      const headers = {
        headers: {
          'Content-Type': 'application/json',
        },
      };

      (api.requestHandler as unknown as TestRequestHandler).get = jest
        .fn()
        .mockResolvedValueOnce(userDataMock);

      const response = await api.getUserDetailsByIdAndName(
        null,
        { id: 1, name: 'Mark' },
        headers,
      );

      expect(
        (api.requestHandler as unknown as TestRequestHandler).get,
      ).toHaveBeenCalledTimes(1);
      expect(
        (api.requestHandler as unknown as TestRequestHandler).get,
      ).toHaveBeenCalledWith('/user-details/1/Mark', {}, headers);
      expect(response).toBe(userDataMock);
    });
  });
});
