import { createApiFetcher } from 'fetchff/api-handler';
import { setDefaultConfig } from '../../src/config-handler';
import {
  clearMockResponses,
  mockFetchResponse,
} from '../utils/mockFetchResponse';

describe('Interceptor Execution Order', () => {
  const executionLog: string[] = [];

  beforeEach(() => {
    executionLog.length = 0; // Clear log
    clearMockResponses();

    // Reset default config
    setDefaultConfig({
      onRequest: undefined,
      onResponse: undefined,
      onError: undefined,
    });
  });

  afterEach(() => {
    clearMockResponses();
  });

  it('should execute interceptors in correct order: Request FIFO, Response LIFO', async () => {
    // Mock the API response
    mockFetchResponse('http://localhost/api/test', {
      body: { message: 'success' },
    });

    // 1. Global level (setDefaultConfig)
    setDefaultConfig({
      onRequest: (config) => {
        executionLog.push('Global-Request');
        return config;
      },
      onResponse: (response) => {
        executionLog.push('Global-Response');
        return response;
      },
    });

    // 2. Instance level (createApiFetcher config)
    const api = createApiFetcher({
      apiUrl: 'http://localhost',
      strategy: 'softFail',
      onRequest: (config) => {
        executionLog.push('Instance-Request');
        return config;
      },
      onResponse: (response) => {
        executionLog.push('Instance-Response');
        return response;
      },
      endpoints: {
        testEndpoint: {
          url: '/api/test',
          method: 'GET',
          // 3. Endpoint level
          onRequest: (config) => {
            executionLog.push('Endpoint-Request');
            return config;
          },
          onResponse: (response) => {
            executionLog.push('Endpoint-Response');
            return response;
          },
        },
      },
    });

    // 4. Request level (when calling the endpoint)
    await api.testEndpoint({
      onRequest: (config) => {
        executionLog.push('Request-Request');
        return config;
      },
      onResponse: (response) => {
        executionLog.push('Request-Response');
        return response;
      },
    });

    // Verify execution order
    expect(executionLog).toEqual([
      // Request interceptors: FIFO (First In, First Out)
      'Global-Request',
      'Instance-Request',
      'Endpoint-Request',
      'Request-Request',

      // Response interceptors: LIFO (Last In, First Out)
      'Request-Response',
      'Endpoint-Response',
      'Instance-Response',
      'Global-Response',
    ]);
  });

  it('should handle array interceptors in correct order', async () => {
    mockFetchResponse('http://localhost/api/array-test', {
      body: { data: 'array test' },
    });

    // Multiple interceptors at global level
    setDefaultConfig({
      onRequest: [
        (config) => {
          executionLog.push('Global-Request-1');
          return config;
        },
        (config) => {
          executionLog.push('Global-Request-2');
          return config;
        },
      ],
      onResponse: [
        (response) => {
          executionLog.push('Global-Response-1');
          return response;
        },
        (response) => {
          executionLog.push('Global-Response-2');
          return response;
        },
      ],
    });

    const api = createApiFetcher({
      apiUrl: 'http://localhost',
      strategy: 'softFail',
      endpoints: {
        arrayTest: {
          url: '/api/array-test',
          method: 'GET',
          onRequest: [
            (config) => {
              executionLog.push('Endpoint-Request-1');
              return config;
            },
            (config) => {
              executionLog.push('Endpoint-Request-2');
              return config;
            },
          ],
          onResponse: [
            (response) => {
              executionLog.push('Endpoint-Response-1');
              return response;
            },
            (response) => {
              executionLog.push('Endpoint-Response-2');
              return response;
            },
          ],
        },
      },
    });

    await api.arrayTest();

    expect(executionLog).toEqual([
      // Request: FIFO - arrays execute in order, then next level
      'Global-Request-1',
      'Global-Request-2',
      'Endpoint-Request-1',
      'Endpoint-Request-2',

      // Response: LIFO - reverse order of levels, arrays execute in order within level
      'Endpoint-Response-1',
      'Endpoint-Response-2',
      'Global-Response-1',
      'Global-Response-2',
    ]);
  });

  it('should work with direct api.request() calls', async () => {
    mockFetchResponse('http://localhost/api/direct', {
      body: { direct: true },
    });

    setDefaultConfig({
      onRequest: (config) => {
        executionLog.push('Global-Request');
        return config;
      },
      onResponse: (response) => {
        executionLog.push('Global-Response');
        return response;
      },
    });

    const api = createApiFetcher({
      apiUrl: 'http://localhost',
      strategy: 'softFail',
      onRequest: (config) => {
        executionLog.push('Instance-Request');
        return config;
      },
      onResponse: (response) => {
        executionLog.push('Instance-Response');
        return response;
      },
      endpoints: {},
    });

    // Direct request call with interceptors
    await api.request('/api/direct', {
      method: 'GET',
      onRequest: (config) => {
        executionLog.push('Request-Request');
        return config;
      },
      onResponse: (response) => {
        executionLog.push('Request-Response');
        return response;
      },
    });

    expect(executionLog).toEqual([
      // Request: FIFO
      'Global-Request',
      'Instance-Request',
      'Request-Request',

      // Response: LIFO
      'Request-Response',
      'Instance-Response',
      'Global-Response',
    ]);
  });

  it('should handle missing interceptors gracefully', async () => {
    mockFetchResponse('http://localhost/api/partial', {
      body: { partial: true },
    });

    // Only global request interceptor
    setDefaultConfig({
      onRequest: (config) => {
        executionLog.push('Global-Request');
        return config;
      },
    });

    const api = createApiFetcher({
      apiUrl: 'http://localhost',
      strategy: 'softFail',
      // Only instance response interceptor
      onResponse: (response) => {
        executionLog.push('Instance-Response');
        return response;
      },
      endpoints: {
        partialTest: {
          url: '/api/partial',
          method: 'GET',
          // No interceptors at endpoint level
        },
      },
    });

    await api.partialTest({
      // Only request-level response interceptor
      onResponse: (response) => {
        executionLog.push('Request-Response');
        return response;
      },
    });

    expect(executionLog).toEqual([
      'Global-Request',
      'Request-Response',
      'Instance-Response',
    ]);
  });
});
