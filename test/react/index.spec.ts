/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import * as fetchff from 'fetchff';
import * as cacheManager from 'fetchff/cache-manager';
import * as pubsubManager from 'fetchff/pubsub-manager';
import * as queueManager from 'fetchff/queue-manager';
import * as configHandler from 'fetchff/config-handler';
import { useFetcher } from '../../src/react/index';
import { FetchResponse } from '../../src/types/request-handler';

// Mock all dependencies
jest.mock('fetchff');
jest.mock('fetchff/cache-manager');
jest.mock('fetchff/pubsub-manager');
jest.mock('fetchff/queue-manager');
jest.mock('fetchff/config-handler');

const mockFetchf = fetchff.fetchf as jest.MockedFunction<typeof fetchff.fetchf>;
const mockGenerateCacheKey =
  cacheManager.generateCacheKey as jest.MockedFunction<
    typeof cacheManager.generateCacheKey
  >;
const mockGetCachedResponse =
  cacheManager.getCachedResponse as jest.MockedFunction<
    typeof cacheManager.getCachedResponse
  >;
const mockMutate = cacheManager.mutate as jest.MockedFunction<
  typeof cacheManager.mutate
>;
const mockSubscribe = pubsubManager.subscribe as jest.MockedFunction<
  typeof pubsubManager.subscribe
>;
const mockGetInFlightPromise =
  queueManager.getInFlightPromise as jest.MockedFunction<
    typeof queueManager.getInFlightPromise
  >;
const mockBuildConfig = configHandler.buildConfig as jest.MockedFunction<
  typeof configHandler.buildConfig
>;

describe('useFetcher', () => {
  const testUrl = 'https://api.example.com/data';
  const testData = { id: 1, name: 'Test' };
  const testError = new Error('Fetch failed');
  const testCacheKey = 'test-cache-key';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockBuildConfig.mockReturnValue({ url: testUrl });
    mockGenerateCacheKey.mockReturnValue(testCacheKey);
    mockGetCachedResponse.mockReturnValue(null);
    mockSubscribe.mockReturnValue(jest.fn());
    mockGetInFlightPromise.mockReturnValue(null);
    mockFetchf.mockResolvedValue({
      data: testData,
      error: null,
      isFetching: false,
      status: 200,
      headers: new Headers(),
    } as FetchResponse);
  });

  describe('Basic Functionality', () => {
    it('should initialize with loading state when no cached data exists', () => {
      const { result } = renderHook(() => useFetcher(testUrl));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(true);
      expect(typeof result.current.refetch).toBe('function');
      expect(typeof result.current.mutate).toBe('function');
    });

    it('should return cached data when available', () => {
      const cachedResponse = {
        data: testData,
        error: null,
        isFetching: false,
        status: 200,
        headers: new Headers(),
      } as FetchResponse;
      mockGetCachedResponse.mockReturnValue(cachedResponse);

      const { result } = renderHook(() => useFetcher(testUrl));

      expect(result.current.data).toEqual(testData);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should call fetchf when no cached data exists', async () => {
      renderHook(() => useFetcher(testUrl));

      await waitFor(() => {
        expect(mockFetchf).toHaveBeenCalledWith(testUrl, {
          dedupeTime: 2000,
          cacheKey: testCacheKey,
          strategy: 'softFail',
        });
      });
    });
  });

  describe('Cache Key Generation', () => {
    it('should use custom cache key when provided', () => {
      const customCacheKey = 'custom-key';
      const customCacheKeyFn = jest.fn().mockReturnValue(customCacheKey);

      renderHook(() => useFetcher(testUrl, { cacheKey: customCacheKeyFn }));

      expect(mockGenerateCacheKey).toHaveBeenCalledWith(
        expect.objectContaining({
          url: testUrl,
        }),
      );
    });

    it('should generate cache key when no custom key provided', () => {
      renderHook(() => useFetcher(testUrl));

      expect(mockGenerateCacheKey).toHaveBeenCalledWith({ url: testUrl });
    });

    it('should regenerate cache key when dependencies change', () => {
      const { rerender } = renderHook(
        ({ url, method }: { url: string; method: 'GET' | 'POST' }) =>
          useFetcher(url, { method }),
        { initialProps: { url: testUrl, method: 'GET' } },
      );

      expect(mockBuildConfig).toHaveBeenCalledWith(testUrl, { method: 'GET' });

      rerender({ url: testUrl, method: 'POST' });

      expect(mockBuildConfig).toHaveBeenCalledWith(testUrl, { method: 'POST' });
    });
  });

  describe('Subscription Management', () => {
    it('should subscribe to cache updates', () => {
      renderHook(() => useFetcher(testUrl));

      expect(mockSubscribe).toHaveBeenCalledWith(
        testCacheKey,
        expect.any(Function),
      );
    });

    it('should unsubscribe on unmount', () => {
      const unsubscribeMock = jest.fn();
      mockSubscribe.mockReturnValue(unsubscribeMock);

      const { unmount } = renderHook(() => useFetcher(testUrl));
      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('should handle subscription updates', () => {
      let subscriptionCallback: (data?: unknown) => void;
      mockSubscribe.mockImplementation((_key, cb) => {
        subscriptionCallback = cb;
        return jest.fn();
      });

      const { result } = renderHook(() => useFetcher(testUrl));

      // Simulate cache update
      const updatedResponse = {
        data: { id: 2, name: 'Updated' },
        error: null,
        isFetching: false,
        status: 200,
        headers: new Headers(),
      } as FetchResponse;
      mockGetCachedResponse.mockReturnValue(updatedResponse);

      act(() => {
        subscriptionCallback!();
      });

      expect(result.current.data).toEqual(updatedResponse.data);
    });
  });

  describe('Error Handling', () => {
    it('should handle error state', () => {
      const errorResponse = {
        data: null,
        error: testError,
        isFetching: false,
        status: 500,
        headers: new Headers(),
      } as FetchResponse;
      mockGetCachedResponse.mockReturnValue(errorResponse);

      const { result } = renderHook(() => useFetcher(testUrl));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(testError);
      expect(result.current.isLoading).toBe(false);
    });

    it('should not refetch when error exists', async () => {
      const errorResponse = {
        data: null,
        error: testError,
        isFetching: false,
        status: 500,
        headers: new Headers(),
      } as FetchResponse;
      mockGetCachedResponse.mockReturnValue(errorResponse);

      renderHook(() => useFetcher(testUrl));

      await waitFor(() => {
        expect(mockFetchf).not.toHaveBeenCalled();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading when isFetching is true', () => {
      const fetchingResponse = {
        data: null,
        error: null,
        isFetching: true,
        status: 0,
        headers: new Headers(),
      } as FetchResponse;
      mockGetCachedResponse.mockReturnValue(fetchingResponse);

      const { result } = renderHook(() => useFetcher(testUrl));

      expect(result.current.isLoading).toBe(true);
    });

    it('should show loading when no state and URL exists', () => {
      mockGetCachedResponse.mockReturnValue(null);

      const { result } = renderHook(() => useFetcher(testUrl));

      expect(result.current.isLoading).toBe(true);
    });

    it('should not show loading when no URL', () => {
      const { result } = renderHook(() => useFetcher(''));

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Suspense Integration', () => {
    it('should throw promise when strategy is reject and pending promise exists', () => {
      const pendingPromise = Promise.resolve();
      mockGetInFlightPromise.mockReturnValue(pendingPromise);
      mockGetCachedResponse.mockReturnValue(null);

      let thrown: unknown;
      function ThrowCatcher() {
        try {
          // This will throw the promise synchronously
          useFetcher(testUrl, { strategy: 'reject' });
        } catch (e) {
          thrown = e;
        }
        return null;
      }

      renderHook(() => ThrowCatcher());
      expect(thrown).toBe(pendingPromise);
    });

    it('should not throw when strategy is not reject', () => {
      const pendingPromise = Promise.resolve();
      mockGetInFlightPromise.mockReturnValue(pendingPromise);
      mockGetCachedResponse.mockReturnValue(null);

      expect(() => {
        renderHook(() => useFetcher(testUrl, { strategy: 'softFail' }));
      }).not.toThrow();
    });

    it('should not throw when cached data exists', () => {
      const pendingPromise = Promise.resolve();
      mockGetInFlightPromise.mockReturnValue(pendingPromise);
      mockGetCachedResponse.mockReturnValue({
        data: testData,
        error: null,
        isFetching: false,
        status: 200,
        headers: new Headers(),
      } as FetchResponse);

      expect(() => {
        renderHook(() => useFetcher(testUrl, { strategy: 'reject' }));
      }).not.toThrow();
    });
  });

  describe('refetch Function', () => {
    it('should call fetchf with correct parameters', async () => {
      const { result } = renderHook(() =>
        useFetcher(testUrl, {
          method: 'POST',
          body: { test: true },
          dedupeTime: 5000,
        }),
      );

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockFetchf).toHaveBeenCalledWith(testUrl, {
        method: 'POST',
        body: { test: true },
        dedupeTime: 5000,
        cacheKey: testCacheKey,
        strategy: 'softFail',
      });
    });

    it('should return promise from fetchf', async () => {
      const expectedResponse = {
        data: testData,
        error: null,
        isFetching: false,
        status: 200,
        headers: new Headers(),
      } as FetchResponse;
      mockFetchf.mockResolvedValue(expectedResponse);

      const { result } = renderHook(() => useFetcher(testUrl));

      const response = await act(async () => {
        return result.current.refetch();
      });

      expect(response).toEqual(expectedResponse);
    });

    it('should use default dedupeTime when not provided', async () => {
      const { result } = renderHook(() => useFetcher(testUrl));

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockFetchf).toHaveBeenCalledWith(testUrl, {
        dedupeTime: 2000,
        cacheKey: testCacheKey,
        strategy: 'softFail',
      });
    });
  });

  describe('mutate Function', () => {
    it('should call globalMutate with correct parameters', () => {
      const { result } = renderHook(() => useFetcher(testUrl));

      act(() => {
        result.current.mutate(testData);
      });

      expect(mockMutate).toHaveBeenCalledWith(
        testCacheKey,
        testData,
        undefined,
      );
    });

    it('should call globalMutate with revalidate option', () => {
      const { result } = renderHook(() => useFetcher(testUrl));

      act(() => {
        result.current.mutate(testData, { revalidate: true });
      });

      expect(mockMutate).toHaveBeenCalledWith(testCacheKey, testData, {
        revalidate: true,
      });
    });
  });

  describe('Configuration Options', () => {
    it('should ensure that initial cache fetched is independent from the cacheTime configuration', () => {
      const cacheTime = 10;
      renderHook(() => useFetcher(testUrl, { cacheTime }));

      expect(mockGetCachedResponse).toHaveBeenCalledWith(
        testCacheKey,
        0, // 0 means no cache time for initial fetch
        expect.objectContaining({ cacheTime }),
      );
    });

    it('should handle dedupeTime configuration', () => {
      const dedupeTime = 5000;
      renderHook(() => useFetcher(testUrl, { dedupeTime }));

      expect(mockGetInFlightPromise).toHaveBeenCalledWith(
        testCacheKey,
        dedupeTime,
      );
    });

    it('should handle empty URL', () => {
      const { result } = renderHook(() => useFetcher(''));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(mockFetchf).not.toHaveBeenCalled();
    });

    it('should handle dependent queries by not fetching when url is null', () => {
      const { result } = renderHook(() => useFetcher(null));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(mockFetchf).not.toHaveBeenCalled();
    });
  });

  describe('Dependency Changes', () => {
    it('should refetch when URL changes', async () => {
      const { rerender } = renderHook(({ url }) => useFetcher(url), {
        initialProps: { url: testUrl },
      });

      await waitFor(() => {
        expect(mockFetchf).toHaveBeenCalledTimes(1);
      });

      const newUrl = 'https://api.example.com/new-data';
      rerender({ url: newUrl });

      await waitFor(() => {
        expect(mockFetchf).toHaveBeenCalledTimes(2);
        expect(mockFetchf).toHaveBeenLastCalledWith(newUrl, expect.any(Object));
      });
    });

    it('should not refetch when config object reference changes but content is same', () => {
      const config1 = { method: 'GET' as const };
      const config2 = { method: 'GET' as const };

      const { rerender } = renderHook(
        ({ config }) => useFetcher(testUrl, config),
        { initialProps: { config: config1 } },
      );

      rerender({ config: config2 });

      // Should only be called once during initial render
      expect(mockFetchf).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined unsubscribe function', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockSubscribe.mockReturnValue(undefined as any);

      expect(() => {
        const { unmount } = renderHook(() => useFetcher(testUrl));
        unmount();
      }).not.toThrow();
    });

    it('should handle empty cacheKey function', () => {
      const emptyCacheKeyFn = jest.fn().mockReturnValue('');

      renderHook(() => useFetcher(testUrl, { cacheKey: emptyCacheKeyFn }));

      expect(emptyCacheKeyFn).not.toHaveBeenCalled();
      expect(mockGenerateCacheKey).toHaveBeenCalledTimes(1);
    });

    it('should handle config without cacheKey function', () => {
      renderHook(() => useFetcher(testUrl, { method: 'POST' }));

      expect(mockGenerateCacheKey).toHaveBeenCalledWith({ url: testUrl });
    });
  });

  describe('Performance', () => {
    it('should not recreate refetch function unnecessarily', () => {
      const { result, rerender } = renderHook(() => useFetcher(testUrl));

      const initialRefetch = result.current.refetch;

      rerender();

      expect(result.current.refetch).toBe(initialRefetch);
    });

    it('should not recreate mutate function unnecessarily', () => {
      const { result, rerender } = renderHook(() => useFetcher(testUrl));

      const initialMutate = result.current.mutate;

      rerender();

      expect(result.current.mutate).toBe(initialMutate);
    });
  });
});
