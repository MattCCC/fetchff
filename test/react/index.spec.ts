/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFetcher } from '../../src/react/index';
import { pruneCache } from '../../src/cache-manager';
import { removeRevalidators } from '../../src/revalidator-manager';
import {
  mockFetchResponse,
  clearMockResponses,
} from '../utils/mockFetchResponse';

describe('useFetcher', () => {
  const testUrl = 'https://api.example.com/data';
  const testData = { id: 1, name: 'Test' };

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetchResponse(testUrl, { body: testData });
  });

  afterEach(() => {
    pruneCache();
    removeRevalidators('focus'); // Clean up revalidators after each test
    removeRevalidators('online'); // Clean up revalidators after each test
    clearMockResponses();
    jest.runAllTimers(); // Advance timers to ensure all promises resolve
    jest.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('should initialize with loading state when no cached data exists', async () => {
      const { result } = renderHook(() => useFetcher(testUrl));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(true);
      expect(typeof result.current.refetch).toBe('function');
      expect(typeof result.current.mutate).toBe('function');

      await act(async () => {
        jest.runAllTimers();
      });
    });

    it('should fetch data when component mounts', async () => {
      const { result } = renderHook(() => useFetcher(testUrl));

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeNull();

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toEqual(testData);
        expect(result.current.error).toBeNull();
      });
    });

    it('should return cached data on subsequent renders', async () => {
      const { result: result1 } = renderHook(() => useFetcher(testUrl));

      await waitFor(() => {
        expect(result1.current.data).toEqual(testData);
      });

      // Second render - should use cache
      const { result: result2 } = renderHook(() => useFetcher(testUrl));

      // Should immediately have data from cache
      expect(result2.current.data).toEqual(testData);
      expect(result2.current.isLoading).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle error state', async () => {
      const errorUrl = 'https://api.example.com/error';
      mockFetchResponse(errorUrl, { status: 500 }, true);

      const { result } = renderHook(() => useFetcher(errorUrl));

      await waitFor(() => {
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeTruthy();
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('refetch & mutate Functions', () => {
    it('should refetch data when called', async () => {
      const updatedData = { id: 2, name: 'Updated' };

      // Initial response
      mockFetchResponse(testUrl, { body: testData });

      const { result, unmount } = renderHook(() => useFetcher(testUrl));

      // Wait for initial data
      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });

      // Update the mock for refetch
      mockFetchResponse(testUrl, { body: updatedData });

      // Call refetch
      await act(async () => {
        await result.current.refetch();
      });

      // Should have updated data
      expect(result.current.data).toEqual(updatedData);

      unmount();
    });

    it('should update data immediately when mutate is called', async () => {
      mockFetchResponse(testUrl, { body: testData });

      const { result, unmount } = renderHook(() => useFetcher(testUrl));

      // Wait for initial data
      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });

      const mutatedData = { id: 2, name: 'Mutated' };

      // Call mutate
      act(() => {
        result.current.mutate(mutatedData);
      });

      // Should immediately show mutated data
      await waitFor(() => {
        expect(result.current.data).toEqual(mutatedData);
        unmount();
      });
    });

    it('should support revalidate option', async () => {
      const revalidatedData = { id: 3, name: 'Revalidated' };

      mockFetchResponse(testUrl, { body: testData });

      const { result } = renderHook(() => useFetcher(testUrl));

      // Wait for initial data
      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });

      // Update mock for revalidation
      mockFetchResponse(testUrl, { body: revalidatedData });

      const mutatedData = { id: 2, name: 'Mutated' };

      // Call mutate with revalidate
      await act(async () => {
        await result.current.mutate(mutatedData, { refetch: true });
      });

      // Should show revalidated data
      await waitFor(() => {
        expect(result.current.data).toEqual(revalidatedData);
      });
    });
  });

  describe('Configuration Options', () => {
    it('should handle empty URL', () => {
      const { result } = renderHook(() => useFetcher(''));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle null URL (dependent queries)', () => {
      const { result } = renderHook(() => useFetcher(null));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle custom configuration', async () => {
      mockFetchResponse(testUrl, { body: testData });

      const { result } = renderHook(() =>
        useFetcher(testUrl, {
          method: 'POST',
          body: { test: true },
        }),
      );

      // Initially should not be loading (POST doesn't auto-trigger)
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull();

      // Manually trigger the POST request
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });

      // Verify request was made (we can't easily check method with mockFetchResponse)
      expect(result.current.data).toEqual(testData);
    });
  });

  describe('Dependency Changes', () => {
    it('should refetch when URL changes', async () => {
      const newUrl = 'https://api.example.com/new-data';
      const newData = { id: 2, name: 'New' };

      mockFetchResponse(testUrl, { body: testData });
      mockFetchResponse(newUrl, { body: newData });

      const { result, rerender } = renderHook(({ url }) => useFetcher(url), {
        initialProps: { url: testUrl },
      });

      // Wait for initial data
      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });

      // Change URL
      rerender({ url: newUrl });

      // Should fetch new data
      await waitFor(() => {
        expect(result.current.data).toEqual(newData);
      });
    });
  });

  describe('Performance', () => {
    it('should not recreate refetch function unnecessarily', () => {
      const { result, rerender, unmount } = renderHook(() =>
        useFetcher(testUrl),
      );

      const initialRefetch = result.current.refetch;
      rerender();

      expect(result.current.refetch).toBe(initialRefetch);
      unmount();
    });

    it('should not recreate mutate function unnecessarily', () => {
      const { result, rerender, unmount } = renderHook(() =>
        useFetcher(testUrl),
      );

      const initialMutate = result.current.mutate;
      rerender();

      expect(result.current.mutate).toBe(initialMutate);
      unmount();
    });
  });

  describe('Loading States', () => {
    it('should show loading when isFetching is true', async () => {
      mockFetchResponse(testUrl, { body: testData });

      const { result } = renderHook(() => useFetcher(testUrl));

      // Should initially be loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should show loading when no state and URL exists', async () => {
      const { result } = renderHook(() => useFetcher(testUrl));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });
    });

    it('should not show loading when no URL', () => {
      const { result } = renderHook(() => useFetcher(''));

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Cache Key Generation', () => {
    it('should use custom cache key when provided', async () => {
      const customCacheKey = 'custom-key';
      const customCacheKeyFn = jest.fn().mockReturnValue(customCacheKey);

      mockFetchResponse(testUrl, { body: testData });

      const { result } = renderHook(() =>
        useFetcher(testUrl, { cacheKey: customCacheKeyFn }),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });

      // The custom cache key function should have been used
      expect(customCacheKeyFn).toHaveBeenCalled();
    });

    it('should regenerate cache key when dependencies change', async () => {
      mockFetchResponse(testUrl, { body: testData });

      const { result, rerender } = renderHook(
        ({ method }: { method: 'GET' | 'POST' }) =>
          useFetcher(testUrl, { method }),
        { initialProps: { method: 'GET' } },
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });

      // Change method - should trigger new request
      rerender({ method: 'POST' });

      // Should clear data since cache key changed but POST doesn't auto-trigger
      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);

      // Manually trigger POST
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });
    });
  });

  describe('Subscription Management', () => {
    it('should handle subscription updates', async () => {
      mockFetchResponse(testUrl, { body: testData });

      const { result } = renderHook(() => useFetcher(testUrl));

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });

      const updatedData = { id: 2, name: 'Updated' };

      // Simulate cache update via mutate
      act(() => {
        result.current.mutate(updatedData);
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(updatedData);
      });
    });
  });

  describe('Advanced Configuration', () => {
    it('should handle timeout configuration', async () => {
      mockFetchResponse(testUrl, { body: testData });

      const { result } = renderHook(() =>
        useFetcher(testUrl, { timeout: 5000 }),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });
    });

    it('should handle dedupeTime configuration', async () => {
      mockFetchResponse(testUrl, { body: testData });

      const { result } = renderHook(() =>
        useFetcher(testUrl, { dedupeTime: 5000 }),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });
    });

    it('should handle cacheTime configuration', async () => {
      mockFetchResponse(testUrl, { body: testData });

      const { result } = renderHook(() =>
        useFetcher(testUrl, { cacheTime: 10000 }),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty cacheKey function', () => {
      const emptyCacheKeyFn = jest.fn().mockReturnValue('');

      renderHook(() => useFetcher(testUrl, { cacheKey: emptyCacheKeyFn }));

      // Should not break even with empty cache key
      expect(emptyCacheKeyFn).toHaveBeenCalled();
    });

    it('should handle config without cacheKey function', async () => {
      mockFetchResponse(testUrl, { body: testData });

      const { result } = renderHook(() =>
        // POST does not auto-trigger, so we use immediate: true
        useFetcher(testUrl, { method: 'POST', immediate: true }),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });
    });

    it('should handle rapid dependency changes', async () => {
      const url1 = 'https://api.example.com/data1';
      const url2 = 'https://api.example.com/data2';
      const data1 = { id: 1, name: 'Data1' };
      const data2 = { id: 2, name: 'Data2' };

      mockFetchResponse(url1, { body: data1 });
      mockFetchResponse(url2, { body: data2 });

      const { result, rerender } = renderHook(({ url }) => useFetcher(url), {
        initialProps: { url: url1 },
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(data1);
      });

      // Rapidly change URLs
      rerender({ url: url2 });
      rerender({ url: url1 });
      rerender({ url: url2 });

      // Should handle gracefully and show final URL's data
      await waitFor(() => {
        expect(result.current.data).toEqual(data2);
      });
    });

    it('should not refetch when config object reference changes but content is same', async () => {
      mockFetchResponse(testUrl, { body: testData });

      const config1 = { method: 'GET' as const };
      const config2 = { method: 'GET' as const };

      const { result, rerender } = renderHook(
        ({ config }) => useFetcher(testUrl, config),
        { initialProps: { config: config1 } },
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });

      const initialData = result.current.data;

      rerender({ config: config2 });

      // Should not trigger refetch since config content is the same
      expect(result.current.data).toBe(initialData);
    });
  });

  describe('Suspense Integration', () => {
    it('should throw promise when strategy is reject and pending promise exists', async () => {
      mockFetchResponse(testUrl, { body: testData });

      let thrown: unknown;
      function ThrowCatcher() {
        try {
          // This should throw the promise synchronously when strategy is reject
          useFetcher(testUrl, { strategy: 'reject' });
        } catch (e) {
          thrown = e;
        }
        return null;
      }

      renderHook(() => ThrowCatcher());

      // For suspense, we expect a promise to be thrown
      expect(thrown).toBeInstanceOf(Promise);
    });

    it('should not throw when strategy is not reject', async () => {
      mockFetchResponse(testUrl, { body: testData });

      expect(() => {
        renderHook(() => useFetcher(testUrl, { strategy: 'softFail' }));
      }).not.toThrow();

      await act(async () => {
        jest.runAllTimers();
      });
    });

    it('should not throw when cached data exists', async () => {
      mockFetchResponse(testUrl, { body: testData });

      // First, populate the cache
      const { result } = renderHook(() => useFetcher(testUrl));

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });

      // Then try with reject strategy - should not throw because data is cached
      expect(() => {
        renderHook(() => useFetcher(testUrl, { strategy: 'reject' }));
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should unsubscribe on unmount', async () => {
      mockFetchResponse(testUrl, { body: testData });

      const { result, unmount } = renderHook(() => useFetcher(testUrl));

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });

      // Unmount should not cause errors
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should handle multiple subscriptions and unsubscriptions', async () => {
      mockFetchResponse(testUrl, { body: testData });

      const hook1 = renderHook(() => useFetcher(testUrl));
      const hook2 = renderHook(() => useFetcher(testUrl));
      const hook3 = renderHook(() => useFetcher(testUrl));

      await waitFor(() => expect(hook1.result.current.data).toEqual(testData));
      await waitFor(() => expect(hook2.result.current.data).toEqual(testData));
      await waitFor(() => expect(hook3.result.current.data).toEqual(testData));

      // Unmount in different orders
      hook2.unmount();
      hook1.unmount();
      hook3.unmount();

      // Should not cause any errors
      expect(true).toBe(true);
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple components using same URL', async () => {
      // Use unique URL to avoid cache pollution
      const multipleUrl = 'https://api.example.com/concurrent-multiple';
      mockFetchResponse(multipleUrl, { body: testData });

      const hook1 = renderHook(() => useFetcher(multipleUrl));
      const hook2 = renderHook(() => useFetcher(multipleUrl));
      const hook3 = renderHook(() => useFetcher(multipleUrl));

      // All should eventually get the same data
      await waitFor(() => expect(hook1.result.current.data).toEqual(testData));
      await waitFor(() => expect(hook2.result.current.data).toEqual(testData));
      await waitFor(() => expect(hook3.result.current.data).toEqual(testData));

      // All should be in sync
      expect(hook1.result.current.data).toBe(hook2.result.current.data);
      expect(hook2.result.current.data).toBe(hook3.result.current.data);
    });

    it('should handle mutation from one component affecting others', async () => {
      // Use completely different unique URL
      const mutationUrl = 'https://api.example.com/concurrent-mutation';
      mockFetchResponse(mutationUrl, { body: testData });

      const hook1 = renderHook(() => useFetcher(mutationUrl));
      const hook2 = renderHook(() => useFetcher(mutationUrl));

      await waitFor(() => expect(hook2.result.current.data).toEqual(testData));
      await waitFor(() => expect(hook1.result.current.data).toEqual(testData));

      const mutatedData = { id: 99, name: 'Mutated' };

      // Mutate from hook1
      act(() => {
        hook1.result.current.mutate(mutatedData);
      });

      // Both hooks should reflect the mutation
      await Promise.all([
        waitFor(() => expect(hook1.result.current.data).toEqual(mutatedData)),
        waitFor(() => expect(hook2.result.current.data).toEqual(mutatedData)),
      ]);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from error state with successful refetch', async () => {
      const errorUrl = 'https://api.example.com/error-then-success';

      // First request fails
      mockFetchResponse(errorUrl, { ok: false, status: 500 });

      const { result } = renderHook(() => useFetcher(errorUrl));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.data).toBeNull();
      });

      // Update mock to succeed
      mockFetchResponse(errorUrl, { body: testData });

      // Refetch should succeed
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.data).toEqual(testData);
      });
    });

    it('should handle network errors gracefully', async () => {
      const networkErrorUrl = 'https://api.example.com/network-error';

      // Mock network error
      mockFetchResponse(networkErrorUrl, { ok: false, status: 0 });

      const { result } = renderHook(() => useFetcher(networkErrorUrl));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle rapid mount/unmount cycles', async () => {
      mockFetchResponse(testUrl, { body: testData });

      // Rapidly mount and unmount hooks
      for (let i = 0; i < 10; i++) {
        const { unmount } = renderHook(() => useFetcher(testUrl));
        unmount();
      }

      // Final hook should still work
      const { result } = renderHook(() => useFetcher(testUrl));

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });
    });

    it('should handle rapid configuration changes', async () => {
      mockFetchResponse(testUrl, { body: testData });

      const { result, rerender } = renderHook(
        ({ config }) => useFetcher(testUrl, config),
        { initialProps: { config: { method: 'GET' } } },
      );

      // Rapidly change config
      for (let i = 0; i < 5; i++) {
        rerender({ config: { method: i % 2 === 0 ? 'GET' : 'POST' } });
      }

      await waitFor(() => {
        expect(result.current.data).toEqual(testData);
      });
    });
  });
});
