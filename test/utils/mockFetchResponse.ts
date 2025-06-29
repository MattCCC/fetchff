/**
 * When testing in browser env, the polyfills for fetch and streams like whatwg-fetch could be used. They are slow and give unexpected results with fetch-mock.
 * This mock implementation is used to simulate fetch responses in tests.
 * It allows you to specify the URL and configuration overrides for the mock response.
 * @param urlOverride - The URL to override the fetch request with.
 * @param configOverride - The configuration overrides for the mock response, such as body, status, headers, etc.
 * @returns A mocked fetch function that returns a response object with the specified overrides.
 */
// Store mock responses per URL
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockResponses = new Map<string, any>();

export const mockFetchResponse = (
  urlOverride: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configOverride: any = {},
) => {
  // Store the mock config for this URL
  mockResponses.set(urlOverride, configOverride);

  // Create or update the global fetch mock
  global.fetch = jest.fn().mockImplementation((url, config) => {
    // Find the mock config for this URL
    const mockConfig = mockResponses.get(url) || {};

    if (!mockResponses.has(url)) {
      console.warn('No mock response configured for URL: ' + url);

      return Promise.resolve({
        url,
        ok: false,
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        data: null,
        body: undefined,
        method: config?.method ?? 'GET',
      });
    }

    const response = {
      url: url || urlOverride,
      body: mockConfig.body ? JSON.stringify(mockConfig.body) : undefined,
      data: mockConfig.body ?? undefined,
      requestBody: config?.body ?? undefined,
      ok: mockConfig.ok ?? true,
      status: mockConfig.status ?? 200,
      headers: mockConfig.headers ??
        config?.headers ?? {
          'Content-Type': 'application/json',
        },
      method: mockConfig.method ?? config?.method ?? 'GET',
      json: () => Promise.resolve(mockConfig.body),
      text: () =>
        Promise.resolve(mockConfig.body ? JSON.stringify(mockConfig.body) : ''),
      ...config,
      ...mockConfig,
    };

    return Promise.resolve(response);
  });

  return global.fetch;
};

// Utility to clear all mock responses
export const clearMockResponses = () => {
  mockResponses.clear();
  if (global.fetch && typeof global.fetch === 'function') {
    (global.fetch as jest.Mock).mockClear?.();
  }
};

// Utility to get all registered mock URLs (useful for debugging)
export const getMockUrls = () => Array.from(mockResponses.keys());

// Utility to check if a URL has a mock configured
export const hasMockForUrl = (url: string) => mockResponses.has(url);

// Create a helper for AbortController-aware mocks
export const createAbortableFetchMock = (
  delay: number = 2000,
  shouldResolve: boolean = true,
  mockData: unknown = null,
) => {
  return jest.fn().mockImplementation((url, options) => {
    const signal = options?.signal as AbortSignal | null;

    return new Promise((resolve, reject) => {
      // Check if already aborted
      if (signal?.aborted) {
        reject(new DOMException('Request is already aborted', 'AbortError'));
        return;
      }

      // Set up abort handling
      const abortHandler = () => {
        reject(
          new DOMException(
            'Request was aborted: ' + signal?.reason.message,
            'AbortError',
          ),
        );
      };

      signal?.addEventListener('abort', abortHandler);

      // Simulate request
      const timeoutId = setTimeout(() => {
        signal?.removeEventListener('abort', abortHandler);

        if (shouldResolve) {
          resolve(
            mockData || {
              ok: true,
              status: 200,
              body: { url, completed: true },
              // Since it is not a Response object, we need to mock the response.data as well.
              data: { url, completed: true },
            },
          );
        } else {
          reject(new Error('Network Error due to timeout'));
        }
      }, delay);

      // Clean up on abort
      signal?.addEventListener('abort', () => {
        clearTimeout(timeoutId);
      });
    });
  });
};
