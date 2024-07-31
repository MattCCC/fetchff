import { ExtendedResponse } from '../src';
import {
  interceptRequest,
  interceptResponse,
} from '../src/interceptor-manager';

describe('Interceptor Functions', () => {
  let requestInterceptors = [];
  let responseInterceptors = [];

  beforeEach(() => {
    requestInterceptors = [];
    responseInterceptors = [];
  });

  it('should apply request interceptors in order', async () => {
    // Define request interceptors
    const requestInterceptor1 = async (config: RequestInit) => {
      config.headers = { ...config.headers, Authorization: 'Bearer token' };
      return config;
    };

    const requestInterceptor2 = async (config: RequestInit) => {
      config.headers = { ...config.headers, 'Custom-Header': 'HeaderValue' };
      return config;
    };

    // Register request interceptors directly
    requestInterceptors.push(requestInterceptor1);
    requestInterceptors.push(requestInterceptor2);

    // Prepare a request configuration
    const initialConfig = { method: 'GET' };
    const interceptedConfig = await interceptRequest(
      initialConfig,
      requestInterceptors,
    );

    // Validate the intercepted configuration
    expect(interceptedConfig).toEqual({
      method: 'GET',
      headers: {
        Authorization: 'Bearer token',
        'Custom-Header': 'HeaderValue',
      },
    });
  });

  it('should apply response interceptors in order', async () => {
    // Define response interceptors
    const responseInterceptor1 = async (response: Response) => {
      const data = await response.json();
      return new Response(JSON.stringify({ ...data, modified: true }), {
        status: response.status,
      });
    };

    const responseInterceptor2 = async (response: Response) => {
      const data = await response.json();
      return new Response(JSON.stringify({ ...data, furtherModified: true }), {
        status: response.status,
      });
    };

    // Register response interceptors directly
    responseInterceptors.push(responseInterceptor1);
    responseInterceptors.push(responseInterceptor2);

    // Mock response data
    const mockResponse = new Response('{"data": "test"}', {
      status: 200,
    }) as ExtendedResponse;

    // Apply response interceptors
    const finalResponse = await interceptResponse(
      mockResponse,
      responseInterceptors,
    );
    const data = await finalResponse.json();

    // Validate the final response data
    expect(data).toEqual({
      data: 'test',
      modified: true,
      furtherModified: true,
    });
  });

  it('should handle request errors', async () => {
    // Mock an error in interceptRequest
    const failingInterceptor = async () => {
      throw new Error('Interceptor Error');
    };

    // Register a failing request interceptor
    requestInterceptors.push(failingInterceptor);

    // Test interceptRequest handling of errors
    await expect(
      interceptRequest({ method: 'GET' }, requestInterceptors),
    ).rejects.toThrow('Interceptor Error');
  });

  it('should handle response errors', async () => {
    // Define a response interceptor that throws an error on non-OK response
    const responseInterceptor = async (response: Response) => {
      if (!response.ok) {
        throw new Error('Response Error');
      }
      return response;
    };

    // Register response interceptor directly
    responseInterceptors.push(responseInterceptor);

    // Mock response data with an error status
    const errorResponse = new Response('{"data": "test"}', {
      status: 500,
    }) as ExtendedResponse;

    // Test interceptResponse handling of errors
    await expect(
      interceptResponse(errorResponse, responseInterceptors),
    ).rejects.toThrow('Response Error');
  });
});
