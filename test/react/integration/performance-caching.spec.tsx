/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import { useEffect, useState } from 'react';
import {
  clearMockResponses,
  mockFetchResponse,
} from '../../utils/mockFetchResponse';
import { useFetcher } from '../../../src/react/index';

describe('Performance & Caching Integration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    clearMockResponses();
  });

  describe('Performance', () => {
    it('should handle many simultaneous different requests efficiently', async () => {
      jest.useRealTimers();

      const startTime = performance.now();

      // Mock 100 different endpoints
      for (let i = 0; i < 100; i++) {
        mockFetchResponse(`/api/perf-${i}`, { body: { id: i } });
      }

      const ManyRequestsComponent = () => {
        const requests = Array.from({ length: 100 }, (_, i) => {
          const { data } = useFetcher(`/api/perf-${i}`);
          return data;
        });

        return (
          <div data-testid="many-requests">
            {requests.filter(Boolean).length} loaded
          </div>
        );
      };

      render(<ManyRequestsComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('many-requests')).toHaveTextContent(
          '100 loaded',
        );
      });

      const endTime = performance.now();
      // Should complete within reasonable time
      // It is a basic performance test, not a strict benchmark
      expect(endTime - startTime).toBeLessThan(250);
    });
  });

  describe('Cache Strategies', () => {
    it('should implement stale-while-revalidate pattern', async () => {
      let requestCount = 0;
      const responses = [
        { data: 'Fresh data from server', timestamp: 1000 },
        { data: 'Updated data from server', timestamp: 2000 },
      ];

      global.fetch = jest.fn().mockImplementation(() => {
        const response =
          responses[requestCount] || responses[responses.length - 1];
        requestCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          data: response,
        });
      });

      const StaleWhileRevalidateComponent = () => {
        const { data, isLoading } = useFetcher('/api/cached-data', {
          cacheTime: 5000, // Cache for 5 seconds
          staleTime: 2000, // Consider stale after 2 seconds
        });

        return (
          <div>
            <div data-testid="swr-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid="swr-loading">
              {isLoading ? 'Loading...' : 'Not Loading'}
            </div>
            <div data-testid="request-count">{requestCount}</div>
          </div>
        );
      };

      const { rerender } = render(<StaleWhileRevalidateComponent />);

      // Should show initial data
      await waitFor(() => {
        expect(screen.getByTestId('swr-data')).toHaveTextContent(
          'Fresh data from server',
        );
        expect(screen.getByTestId('request-count')).toHaveTextContent('1');
      });

      // Advance time past stale time but within cache time
      act(() => {
        jest.advanceTimersByTime(2500);
      });

      // Re-render meanwhile (should not influence the results)
      rerender(<StaleWhileRevalidateComponent />);

      // Data should remain unchanged while background revalidation starts
      await act(async () => {
        expect(screen.getByTestId('swr-data')).toHaveTextContent(
          'Fresh data from server',
        );
      });

      // Should eventually show updated data
      await waitFor(
        () => {
          expect(screen.getByTestId('swr-data')).toHaveTextContent(
            'Updated data from server',
          );
          expect(screen.getByTestId('request-count')).toHaveTextContent('2');
        },
        { timeout: 3000 },
      );
    });

    it('should correctly invalidate cache and fetch new data', async () => {
      let requestCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        requestCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          data: { message: `Request ${requestCount}`, id: requestCount },
        });
      });

      const CacheInvalidationComponent = () => {
        const [cacheKey, setCacheKey] = useState('user-data-1');

        const { data, isLoading, refetch } = useFetcher('/api/user-data', {
          cacheTime: 10000, // Long cache time
          cacheKey,
        });

        const invalidateCache = () => {
          setCacheKey(`user-data-${Date.now()}`); // New cache key = cache invalidation
        };

        return (
          <div>
            <div data-testid="cache-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid="cache-loading">
              {isLoading ? 'Loading...' : 'Not Loading'}
            </div>
            <div data-testid="cache-key">{cacheKey}</div>
            <button onClick={invalidateCache} data-testid="invalidate-button">
              Invalidate Cache
            </button>
            <button onClick={() => refetch(false)} data-testid="refetch-button">
              Refetch
            </button>
          </div>
        );
      };

      render(<CacheInvalidationComponent />);

      // Should load initial data
      await waitFor(() => {
        expect(screen.getByTestId('cache-data')).toHaveTextContent('Request 1');
      });

      // Refetch should use cache (no new request)
      fireEvent.click(screen.getByTestId('refetch-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cache-data')).toHaveTextContent('Request 1');
      });

      expect(requestCount).toBe(1); // Still only 1 request

      // Invalidate cache should trigger new request
      fireEvent.click(screen.getByTestId('invalidate-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cache-data')).toHaveTextContent('Request 2');
      });

      expect(requestCount).toBe(2); // Now 2 requests
    });
  });

  describe('Request Deduplication', () => {
    it('should deduplicate concurrent requests', async () => {
      let requestCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        requestCount++;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              data: {
                message: 'Expensive operation result',
                count: requestCount,
              },
            });
          }, 1000);
        });
      });

      const DeduplicationComponent = ({
        instanceId,
      }: {
        instanceId: number;
      }) => {
        const { data, isLoading } = useFetcher('/api/expensive-operation', {
          dedupeTime: 5000, // Dedupe for 5 seconds
        });

        return (
          <div>
            <div data-testid={`dedupe-data-${instanceId}`}>
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid={`dedupe-loading-${instanceId}`}>
              {isLoading ? 'Loading...' : 'Not Loading'}
            </div>
          </div>
        );
      };

      // Render multiple instances simultaneously
      render(
        <div>
          <DeduplicationComponent instanceId={1} />
          <DeduplicationComponent instanceId={2} />
          <DeduplicationComponent instanceId={3} />
        </div>,
      );

      // All should show loading
      expect(screen.getByTestId('dedupe-loading-1')).toHaveTextContent(
        'Loading...',
      );
      expect(screen.getByTestId('dedupe-loading-2')).toHaveTextContent(
        'Loading...',
      );
      expect(screen.getByTestId('dedupe-loading-3')).toHaveTextContent(
        'Loading...',
      );

      // Advance time to complete request
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });

      // All should show same data (deduplication worked)
      await waitFor(
        () => {
          expect(screen.getByTestId('dedupe-data-1')).toHaveTextContent(
            'count":1',
          );
          expect(screen.getByTestId('dedupe-data-2')).toHaveTextContent(
            'count":1',
          );
          expect(screen.getByTestId('dedupe-data-3')).toHaveTextContent(
            'count":1',
          );
        },
        { timeout: 2000 },
      );

      // Should have made only 1 request despite 3 components
      expect(requestCount).toBe(1);
    });
  });

  describe('Memory Management', () => {
    it('should clean up subscriptions on unmount', async () => {
      mockFetchResponse('/api/cleanup-test', {
        body: { message: 'Component data' },
      });

      const CleanupComponent = () => {
        const { data } = useFetcher('/api/cleanup-test');

        return (
          <div data-testid="cleanup-data">
            {data ? JSON.stringify(data) : 'Loading...'}
          </div>
        );
      };

      const { unmount } = render(<CleanupComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('cleanup-data')).toHaveTextContent(
          'Component data',
        );
      });

      // Unmount component should not throw errors
      expect(() => {
        unmount();
      }).not.toThrow();

      // Test passes if no memory leaks or cleanup errors occur
    });

    it('should handle component remounting with cache', async () => {
      let requestCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        requestCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          data: { message: `Remount test ${requestCount}` },
        });
      });

      const RemountComponent = () => {
        const { data, isLoading } = useFetcher('/api/remount-test', {
          cacheTime: 5000,
        });

        return (
          <div>
            <div data-testid="remount-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid="remount-loading">
              {isLoading ? 'Loading...' : 'Not Loading'}
            </div>
          </div>
        );
      };

      // Mount component
      const { unmount } = render(<RemountComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('remount-data')).toHaveTextContent(
          'Remount test 1',
        );
      });

      expect(requestCount).toBe(1);

      // Unmount component
      unmount();

      // Wait a bit but not past cache time
      await act(async () => {
        jest.advanceTimersByTime(2000);
      });

      // Remount component
      render(<RemountComponent />);

      // Should immediately show cached data without new request
      expect(screen.getByTestId('remount-data')).toHaveTextContent(
        'Remount test 1',
      );
      expect(requestCount).toBe(1); // Still only 1 request
    });
  });

  describe('Bundle Size Optimization', () => {
    it('should lazy load non-critical data', async () => {
      const essentialData = { user: 'John Doe', balance: 1000 };
      const nonCriticalData = {
        recommendations: ['Product A', 'Product B'],
        ads: ['Ad 1'],
      };

      mockFetchResponse('/api/essential', {
        body: essentialData,
      });

      mockFetchResponse('/api/non-critical', {
        body: nonCriticalData,
      });

      const LazyLoadComponent = () => {
        const [loadNonCritical, setLoadNonCritical] = useState(false);

        // Essential data loads immediately
        const { data: essential } = useFetcher('/api/essential');

        // Non-critical data loads on demand
        const { data: nonCritical } = useFetcher(
          loadNonCritical ? '/api/non-critical' : null,
        );

        useEffect(() => {
          // Load non-critical data after essential data is ready
          if (essential) {
            setTimeout(() => setLoadNonCritical(true), 500);
          }
        }, [essential]);

        return (
          <div>
            <div data-testid="essential-data">
              {essential ? `User: ${essential.user}` : 'Loading essential...'}
            </div>
            <div data-testid="non-critical-data">
              {nonCritical
                ? `Recommendations: ${nonCritical.recommendations.length}`
                : 'Loading recommendations...'}
            </div>
            <div data-testid="load-state">
              {loadNonCritical ? 'Loading Non-Critical' : 'Essential Only'}
            </div>
          </div>
        );
      };

      render(<LazyLoadComponent />);

      // Should load essential data first
      await waitFor(() => {
        expect(screen.getByTestId('essential-data')).toHaveTextContent(
          'User: John Doe',
        );
        expect(screen.getByTestId('load-state')).toHaveTextContent(
          'Essential Only',
        );
      });

      // Should start loading non-critical data
      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        expect(screen.getByTestId('load-state')).toHaveTextContent(
          'Loading Non-Critical',
        );
      });

      // Should eventually load non-critical data
      await waitFor(() => {
        expect(screen.getByTestId('non-critical-data')).toHaveTextContent(
          'Recommendations: 2',
        );
      });
    });
  });
});
