import axios from 'axios';
import PromiseAny from 'promise-any';
import { HttpRequestHandler } from '../src/http-request-handler';

describe('API Handler', () => {
  const apiUrl = 'http://example.com/api/';
  const axiosResponseMock = {
    data: {
      test: 'data',
    },
  };

  console.warn = jest.fn();

  afterEach((done) => {
    done();
  });

  it('should get request instance', () => {
    const httpRequestHandler = new HttpRequestHandler({
      axios,
    });

    const response = httpRequestHandler.getInstance();

    expect(response).toBeTruthy();
  });

  describe('handleRequest()', () => {
    it('should properly hang promise when using Silent strategy', async () => {
      const httpRequestHandler = new HttpRequestHandler({
        axios,
        strategy: 'silent',
      });

      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      let response;
      const request = (httpRequestHandler as any).get(apiUrl);

      let timeout = new Promise((resolve) => {
        let wait = setTimeout(() => {
          clearTimeout(wait);

          resolve('timeout');
        }, 2000);
      });

      expect(typeof request.then).toBe('function');

      response = await PromiseAny([request, timeout]);

      expect(response).toBe('timeout');
    });

    it('should reject promise when using rejection strategy', async () => {
      const httpRequestHandler = new HttpRequestHandler({
        axios,
        strategy: 'reject',
      });

      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      let response;

      try {
        response = await (httpRequestHandler as any).delete(apiUrl);
      } catch (error) {
        expect(typeof error).toBe('object');
      }

      expect(response).toBe(undefined);
    });

    it('should reject promise when using reject strategy per endpoing', async () => {
      const httpRequestHandler = new HttpRequestHandler({
        axios,
        strategy: 'silent',
      });

      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      try {
        await (httpRequestHandler as any).delete(apiUrl, null, {
          strategy: 'throwError',
        });
      } catch (error) {
        expect(typeof error).toBe('object');
      }
    });
  });

  describe('handleCancellation()', () => {
    it('should not set cancel token if cancellation is globally disabled', async () => {
      const httpRequestHandler = new HttpRequestHandler({
        axios,
        strategy: 'reject',
        cancellable: false,
      });

      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockResolvedValue(axiosResponseMock);
      const spy = jest.spyOn(httpRequestHandler.requestInstance, 'request');

      await (httpRequestHandler as any).get(apiUrl);

      expect(spy).toHaveBeenCalledWith(
        expect.not.objectContaining({
          signal: expect.any(Object),
        })
      );
    });

    it('should not set cancel token if cancellation is disabled per route', async () => {
      const httpRequestHandler = new HttpRequestHandler({
        axios,
        strategy: 'reject',
        cancellable: true,
      });

      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockResolvedValue(axiosResponseMock);
      const spy = jest.spyOn(httpRequestHandler.requestInstance, 'request');

      await (httpRequestHandler as any).get(
        apiUrl,
        {},
        {
          cancellable: false,
        }
      );

      expect(spy).toHaveBeenCalledWith(
        expect.not.objectContaining({
          signal: expect.any(Object),
        })
      );
    });

    it('should set cancel token if cancellation is enabled per route', async () => {
      const httpRequestHandler = new HttpRequestHandler({
        axios,
        strategy: 'reject',
        cancellable: true,
      });

      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockResolvedValue(axiosResponseMock);
      const spy = jest.spyOn(httpRequestHandler.requestInstance, 'request');

      await (httpRequestHandler as any).get(
        apiUrl,
        {},
        {
          cancellable: true,
        }
      );

      expect(spy).not.toHaveBeenCalledWith({});
    });

    it('should set cancel token if cancellation is enabled per route but globally cancellation is disabled', async () => {
      const httpRequestHandler = new HttpRequestHandler({
        axios,
        strategy: 'reject',
        cancellable: false,
      });

      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockResolvedValue(axiosResponseMock);
      const spy = jest.spyOn(httpRequestHandler.requestInstance, 'request');

      await (httpRequestHandler as any).get(
        apiUrl,
        {},
        {
          cancellable: true,
        }
      );

      expect(spy).not.toHaveBeenCalledWith({});
    });

    it('should set cancel token if cancellation is not enabled per route but globally only', async () => {
      const httpRequestHandler = new HttpRequestHandler({
        axios,
        strategy: 'reject',
        cancellable: true,
      });

      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockResolvedValue(axiosResponseMock);
      const spy = jest.spyOn(httpRequestHandler.requestInstance, 'request');

      await (httpRequestHandler as any).get(apiUrl);

      expect(spy).not.toHaveBeenCalledWith({});
    });

    it('should cancel previous request when successive request is made', async () => {
      let response;

      const httpRequestHandler = new HttpRequestHandler({
        axios,
        strategy: 'silent',
        cancellable: true,
      });

      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockRejectedValue(new Error('Request Failed'));

      const request = (httpRequestHandler as any).get(apiUrl);

      const spy = jest.spyOn(httpRequestHandler.requestInstance, 'request');
      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockResolvedValue(axiosResponseMock);

      const request2 = (httpRequestHandler as any).get(apiUrl);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(Object),
        })
      );

      let timeout = new Promise((resolve) => {
        let wait = setTimeout(() => {
          clearTimeout(wait);

          resolve('timeout');
        }, 2000);
      });

      expect(typeof request.then).toBe('function');

      response = await PromiseAny([request, request2, timeout]);

      expect(response).toStrictEqual({ test: 'data' });
    });
  });

  describe('processResponseData()', () => {
    it('should show nested data object if flattening is off', async () => {
      const httpRequestHandler = new HttpRequestHandler({
        axios,
        flattenResponse: false,
      });

      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockResolvedValue(axiosResponseMock);

      const response = await (httpRequestHandler as any).put(apiUrl);

      expect(response).toMatchObject(axiosResponseMock);
    });

    it('should handle nested data if data flattening is on', async () => {
      const httpRequestHandler = new HttpRequestHandler({
        axios,
        flattenResponse: true,
      });

      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockResolvedValue(axiosResponseMock);

      const response = await (httpRequestHandler as any).post(apiUrl);

      expect(response).toMatchObject(axiosResponseMock.data);
    });

    it('should handle deeply nested data if data flattening is on', async () => {
      const httpRequestHandler = new HttpRequestHandler({
        axios,
        flattenResponse: true,
      });

      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockResolvedValue({ data: axiosResponseMock });

      const response = await (httpRequestHandler as any).patch(apiUrl);

      expect(response).toMatchObject(axiosResponseMock.data);
    });

    it('should return null if there is no data', async () => {
      const httpRequestHandler = new HttpRequestHandler({
        axios,
        flattenResponse: true,
        defaultResponse: null,
      });

      httpRequestHandler.requestInstance.request = jest
        .fn()
        .mockResolvedValue({});

      expect(await (httpRequestHandler as any).head(apiUrl)).toBe(null);
    });
  });
});
