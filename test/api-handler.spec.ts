import { ApiHandler } from '../src/api-handler';
import { mockErrorCallbackClass } from './http-request-error-handler.spec';
import { endpoints, IEndpoints } from './mocks/endpoints';

describe('API Handler', () => {
  const apiUrl = 'http://example.com/api/';
  const config = {
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
    const api = new ApiHandler(config);

    expect(typeof api.getInstance().request).toBe('function');
  });

  describe('__get()', () => {
    it('should trigger request handler for an existent endpoint', async () => {
      const api = new ApiHandler(config);

      api.handleRequest = jest.fn().mockResolvedValueOnce(userDataMock);

      const endpoints = api as unknown as IEndpoints;
      const response = await endpoints.getUserDetails({ userId: 1 });

      expect(api.handleRequest).toHaveBeenCalledTimes(1);
      expect(api.handleRequest).toHaveBeenCalledWith('getUserDetails', {
        userId: 1,
      });
      expect(response).toBe(userDataMock);
    });

    it('should not trigger request handler for non-existent endpoint', async () => {
      const api = new ApiHandler(config);

      api.handleRequest = jest.fn().mockResolvedValueOnce(userDataMock);

      const response = await api.getUserAddress({ userId: 1 });

      expect(api.handleRequest).not.toHaveBeenCalled();
      expect(response).toBeNull();
    });
  });

  describe('handleRequest()', () => {
    it('should properly replace multiple URL params', async () => {
      const api = new ApiHandler(config);

      (api.httpRequestHandler as any).get = jest
        .fn()
        .mockResolvedValueOnce(userDataMock);

      const endpoints = api as unknown as IEndpoints;
      const response = await endpoints.getUserDetailsByIdAndName(null, {
        id: 1,
        name: 'Mark',
      });

      expect((api.httpRequestHandler as any).get).toHaveBeenCalledTimes(1);
      expect((api.httpRequestHandler as any).get).toHaveBeenCalledWith(
        '/user-details/get/1/Mark',
        {},
        {}
      );
      expect(response).toBe(userDataMock);
    });

    it('should properly fill Axios compatible config', async () => {
      const api = new ApiHandler(config);
      const headers = {
        headers: {
          'Content-Type': 'application/json',
        },
      };

      (api.httpRequestHandler as any).get = jest
        .fn()
        .mockResolvedValueOnce(userDataMock);

      const endpoints = api as unknown as IEndpoints;
      const response = await endpoints.getUserDetailsByIdAndName(
        null,
        { id: 1, name: 'Mark' },
        headers
      );

      expect((api.httpRequestHandler as any).get).toHaveBeenCalledTimes(1);
      expect((api.httpRequestHandler as any).get).toHaveBeenCalledWith(
        '/user-details/get/1/Mark',
        {},
        headers
      );
      expect(response).toBe(userDataMock);
    });
  });
});
