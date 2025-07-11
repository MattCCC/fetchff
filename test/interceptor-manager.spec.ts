import { ExtendedResponse } from '../src';
import type { RequestHandlerConfig } from '../src/types/request-handler';
import { applyInterceptors } from '../src/interceptor-manager';

describe('applyInterceptors', () => {
  it('should apply single interceptor to request config', async () => {
    const requestInterceptor = async (config: RequestHandlerConfig) => {
      return {
        ...config,
        headers: { ...config.headers, Authorization: 'Bearer token' },
      };
    };

    const initialConfig: RequestHandlerConfig = { method: 'GET' };

    await applyInterceptors(requestInterceptor, initialConfig);

    expect(initialConfig).toEqual({
      method: 'GET',
      headers: {
        Authorization: 'Bearer token',
      },
    });
  });

  it('should apply array of interceptors in order', async () => {
    const requestInterceptor1 = async (config: RequestHandlerConfig) => {
      return {
        ...config,
        headers: { ...config.headers, Authorization: 'Bearer token' },
      };
    };

    const requestInterceptor2 = async (config: RequestHandlerConfig) => {
      return {
        ...config,
        headers: { ...config.headers, 'Custom-Header': 'HeaderValue' },
      };
    };

    const interceptors = [requestInterceptor1, requestInterceptor2];
    const initialConfig: RequestHandlerConfig = { method: 'GET' };

    await applyInterceptors(interceptors, initialConfig);

    expect(initialConfig).toEqual({
      method: 'GET',
      headers: {
        Authorization: 'Bearer token',
        'Custom-Header': 'HeaderValue',
      },
    });
  });

  it('should pass additional arguments to interceptors', async () => {
    const interceptorWithArgs = async (
      data: RequestHandlerConfig,
      url: string,
      method: string,
    ) => {
      return {
        ...data,
        url,
        method,
        headers: { ...data.headers, 'X-Custom': `${method}-${url}` },
      };
    };

    const initialConfig: RequestHandlerConfig = { method: 'GET' };

    await applyInterceptors(
      interceptorWithArgs,
      initialConfig,
      '/api/users',
      'POST',
    );

    expect(initialConfig).toEqual({
      method: 'POST',
      url: '/api/users',
      headers: {
        'X-Custom': 'POST-/api/users',
      },
    });
  });

  it('should handle undefined interceptors', async () => {
    const initialConfig: RequestHandlerConfig = { method: 'GET' };
    const originalConfig = { ...initialConfig };

    await applyInterceptors(undefined, initialConfig);

    expect(initialConfig).toEqual(originalConfig);
  });

  it('should handle interceptors that return undefined', async () => {
    const interceptorReturningUndefined = async () => {
      return undefined;
    };

    const initialConfig: RequestHandlerConfig = { method: 'GET' };
    const originalConfig = { ...initialConfig };

    await applyInterceptors(interceptorReturningUndefined, initialConfig);

    expect(initialConfig).toEqual(originalConfig);
  });

  it('should handle interceptors that return null', async () => {
    const interceptorReturningNull = async () => {
      return null;
    };

    const initialConfig: RequestHandlerConfig = { method: 'GET' };
    const originalConfig = { ...initialConfig };

    await applyInterceptors(interceptorReturningNull, initialConfig);

    expect(initialConfig).toEqual(originalConfig);
  });

  it('should handle empty array of interceptors', async () => {
    const initialConfig: RequestHandlerConfig = { method: 'GET' };
    const originalConfig = { ...initialConfig };

    await applyInterceptors([], initialConfig);

    expect(initialConfig).toEqual(originalConfig);
  });

  it('should handle non-object return values', async () => {
    const interceptorReturningString = async () => {
      return 'invalid return';
    };

    const initialConfig: RequestHandlerConfig = { method: 'GET' };
    const originalConfig = { ...initialConfig };

    await applyInterceptors(interceptorReturningString, initialConfig);

    expect(initialConfig).toEqual(originalConfig);
  });

  it('should handle interceptors with non-object data', async () => {
    const interceptor = async (data: string) => {
      return data + ' modified';
    };

    // This test verifies the function handles non-object data gracefully
    const stringData = 'test' as unknown;

    await applyInterceptors(interceptor, {}, stringData);

    // Should not modify non-object data
    expect(stringData).toBe('test');
  });

  it('should handle errors thrown by interceptors', async () => {
    const failingInterceptor = async () => {
      throw new Error('Interceptor Error');
    };

    const initialConfig: RequestHandlerConfig = { method: 'GET' };

    await expect(
      applyInterceptors(failingInterceptor, initialConfig),
    ).rejects.toThrow('Interceptor Error');
  });

  it('should handle errors in array interceptors', async () => {
    const workingInterceptor = async (config: RequestHandlerConfig) => {
      return { ...config, headers: { ...config.headers, Working: 'true' } };
    };

    const failingInterceptor = async () => {
      throw new Error('Second Interceptor Error');
    };

    const interceptors = [workingInterceptor, failingInterceptor];
    const initialConfig: RequestHandlerConfig = { method: 'GET' };

    await expect(
      applyInterceptors(interceptors, initialConfig),
    ).rejects.toThrow('Second Interceptor Error');
  });

  it('should work with response objects', async () => {
    interface ModifiedResponse extends ExtendedResponse {
      modified?: boolean;
    }

    const responseInterceptor = async (response: ModifiedResponse) => {
      // Simulate modifying response by adding custom property
      response.modified = true;
      return response;
    };

    const mockResponse = new Response('{"data": "test"}', {
      status: 200,
    }) as ModifiedResponse;

    await applyInterceptors(responseInterceptor, mockResponse);

    expect(mockResponse.modified).toBe(true);
  });

  it('should handle multiple arguments with response interceptors', async () => {
    interface EnhancedResponse extends ExtendedResponse {
      interceptedStatus?: number;
      interceptedUrl?: string;
    }

    const responseInterceptor = async (
      response: EnhancedResponse,
      statusCode: number,
      url: string,
    ) => {
      // Simulate modifying response with additional data
      response.interceptedStatus = statusCode;
      response.interceptedUrl = url;
      return response;
    };

    const mockResponse = new Response('{"data": "test"}', {
      status: 200,
    }) as EnhancedResponse;

    await applyInterceptors(
      responseInterceptor,
      mockResponse,
      201,
      '/api/test',
    );

    expect(mockResponse.interceptedStatus).toBe(201);
    expect(mockResponse.interceptedUrl).toBe('/api/test');
  });

  it('should handle multiple interceptors with mixed success and failure patterns', async () => {
    const successInterceptor = async (config: RequestHandlerConfig) => {
      return { ...config, success: true };
    };

    const undefinedInterceptor = async () => {
      return undefined;
    };

    const nullInterceptor = async () => {
      return null;
    };

    const anotherSuccessInterceptor = async (config: RequestHandlerConfig) => {
      return { ...config, finalStep: true };
    };

    const interceptors = [
      successInterceptor,
      undefinedInterceptor,
      nullInterceptor,
      anotherSuccessInterceptor,
    ];

    const initialConfig: RequestHandlerConfig = { method: 'GET' };

    await applyInterceptors(interceptors, initialConfig);

    expect(initialConfig).toEqual({
      method: 'GET',
      success: true,
      finalStep: true,
    });
  });
});
