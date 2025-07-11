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
import { memo, useEffect, useState } from 'react';
import {
  clearMockResponses,
  mockFetchResponse,
} from '../../utils/mockFetchResponse';
import { useFetcher } from '../../../src/react/index';
import { clearAllTimeouts } from '../../../src/timeout-wheel';

describe('Performance & Caching Integration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    clearAllTimeouts();
    jest.clearAllTimers();
    clearMockResponses();
  });

  describe('Performance', () => {
    it('should handle many simultaneous different requests efficiently', async () => {
      jest.useRealTimers();
      const runs = 150;

      // Mock i different endpoints
      for (let i = 0; i < runs; i++) {
        mockFetchResponse(`/api/perf-${i}`, { body: { id: i } });
      }

      const startTime = performance.now();

      const ManyRequestsComponent = () => {
        const requests = Array.from({ length: runs }, (_, i) => {
          const response = useFetcher(`/api/perf-${i}`, {
            // cacheKey: 'key',
            // timeout: 0,
            // dedupeTime: 0,
          });
          return response;
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
          runs + ' loaded',
        );
      });

      const endTime = performance.now();
      // Should complete within reasonable time
      // It is a basic performance test, not a strict benchmark
      expect(endTime - startTime).toBeLessThan(130);
    });

    it('should not cause unnecessary rerenders with external store', async () => {
      jest.useRealTimers();

      let renderCount = 0;
      let dataChangeCount = 0;
      let previousData: unknown = null;

      mockFetchResponse('/api/stable-data', {
        body: { message: 'Stable data', timestamp: Date.now() },
      });

      const RenderTrackingComponent = memo(({ testId }: { testId: string }) => {
        renderCount++;

        const { data, isLoading, error } = useFetcher('/api/stable-data', {
          cacheTime: 30000, // Long cache time
          staleTime: 15000, // Long stale time
        });

        // Track actual data changes (not just rerenders)
        if (data !== previousData) {
          dataChangeCount++;
          previousData = data;
        }

        return (
          <div data-testid={testId}>
            <div data-testid={`${testId}-render-count`}>{renderCount}</div>
            <div data-testid={`${testId}-data-change-count`}>
              {dataChangeCount}
            </div>
            <div data-testid={`${testId}-data`}>
              {data ? JSON.stringify(data) : 'Loading...'}
            </div>
            <div data-testid={`${testId}-loading`}>
              {isLoading ? 'Loading' : 'Loaded'}
            </div>
            <div data-testid={`${testId}-error`}>
              {error ? 'Error' : 'No Error'}
            </div>
          </div>
        );
      });

      const TestContainer = () => {
        const [forceRerender, setForceRerender] = useState(0);
        const [unrelatedState, setUnrelatedState] = useState('initial');

        return (
          <div>
            <RenderTrackingComponent testId="stable-component" />

            <div data-testid="force-rerender-count">{forceRerender}</div>
            <div data-testid="unrelated-state">{unrelatedState}</div>

            <button
              data-testid="force-rerender-btn"
              onClick={() => setForceRerender((prev) => prev + 1)}
            >
              Force Parent Rerender
            </button>

            <button
              data-testid="change-unrelated-btn"
              onClick={() => setUnrelatedState('changed-' + Date.now())}
            >
              Change Unrelated State
            </button>
          </div>
        );
      };

      const { rerender } = render(<TestContainer />);

      // Wait for initial data load
      await waitFor(() => {
        expect(screen.getByTestId('stable-component-data')).toHaveTextContent(
          'Stable data',
        );
        expect(
          screen.getByTestId('stable-component-loading'),
        ).toHaveTextContent('Loaded');
      });

      // Get initial counts
      const initialRenderCount = parseInt(
        screen.getByTestId('stable-component-render-count').textContent || '0',
      );
      const initialDataChangeCount = parseInt(
        screen.getByTestId('stable-component-data-change-count').textContent ||
          '0',
      );

      // Test 1: Force parent rerenders should not cause child rerenders
      fireEvent.click(screen.getByTestId('force-rerender-btn'));
      fireEvent.click(screen.getByTestId('force-rerender-btn'));
      fireEvent.click(screen.getByTestId('force-rerender-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('force-rerender-count')).toHaveTextContent(
          '3',
        );
      });

      // useFetcher component should not have re-rendered due to parent rerenders
      expect(
        parseInt(
          screen.getByTestId('stable-component-render-count').textContent ||
            '0',
        ),
      ).toBe(initialRenderCount); // Should be same as initial

      // Test 2: Changing unrelated state should not cause rerenders
      fireEvent.click(screen.getByTestId('change-unrelated-btn'));
      fireEvent.click(screen.getByTestId('change-unrelated-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('unrelated-state')).toHaveTextContent(
          'changed-',
        );
      });

      // Still should not have re-rendered
      expect(
        parseInt(
          screen.getByTestId('stable-component-render-count').textContent ||
            '0',
        ),
      ).toBe(initialRenderCount);

      // Test 3: Manual rerender of entire tree should not cause unnecessary rerenders
      rerender(<TestContainer />);
      rerender(<TestContainer />);

      // Component should still not have re-rendered unnecessarily
      expect(
        parseInt(
          screen.getByTestId('stable-component-render-count').textContent ||
            '0',
        ),
      ).toBe(initialRenderCount);

      // Test 4: Data should not have changed (only one real data change - initial load)
      expect(
        parseInt(
          screen.getByTestId('stable-component-data-change-count')
            .textContent || '0',
        ),
      ).toBe(initialDataChangeCount); // Should be 1 (initial load only)

      // Assertions for optimal performance
      expect(
        parseInt(
          screen.getByTestId('stable-component-render-count').textContent ||
            '0',
        ),
      ).toBeLessThanOrEqual(initialRenderCount + 1); // Allow max 1 additional render

      expect(
        parseInt(
          screen.getByTestId('stable-component-data-change-count')
            .textContent || '0',
        ),
      ).toBe(1); // Should only have 1 data change (initial load)
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
      jest.advanceTimersByTime(2500);
      jest.runAllTimers();

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
          cacheTime: 1000, // Long cache time
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

    it('should handle multiple components with same cache key efficiently', async () => {
      jest.useRealTimers();

      const renderCounts = { comp1: 0, comp2: 0, comp3: 0 };
      let sharedFetchCount = 0;

      global.fetch = jest.fn().mockImplementation(() => {
        sharedFetchCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          data: {
            shared: 'data',
            fetchCount: sharedFetchCount,
            timestamp: Date.now(),
          },
        });
      });

      const SharedCacheComponent = ({
        id,
      }: {
        id: keyof typeof renderCounts;
      }) => {
        renderCounts[id]++;

        const { data, isLoading } = useFetcher('/api/shared-cache', {
          cacheTime: 100,
          dedupeTime: 5000,
        });

        return (
          <div data-testid={`shared-${id}`}>
            <div data-testid={`shared-${id}-renders`}>{renderCounts[id]}</div>
            <div data-testid={`shared-${id}-data`}>
              {data ? `${data.shared} (${data.fetchCount})` : 'Loading...'}
            </div>
            <div data-testid={`shared-${id}-loading`}>
              {isLoading ? 'Loading' : 'Loaded'}
            </div>
          </div>
        );
      };

      render(
        <div>
          <SharedCacheComponent id="comp1" />
          <SharedCacheComponent id="comp2" />
          <SharedCacheComponent id="comp3" />
        </div>,
      );

      // Wait for all components to load
      await waitFor(() => {
        expect(screen.getByTestId('shared-comp1-data')).toHaveTextContent(
          'data (1)',
        );
        expect(screen.getByTestId('shared-comp2-data')).toHaveTextContent(
          'data (1)',
        );
        expect(screen.getByTestId('shared-comp3-data')).toHaveTextContent(
          'data (1)',
        );
      });

      // Should have made only 1 fetch despite 3 components
      expect(sharedFetchCount).toBe(1);

      // Each component should have minimal renders
      const comp1Renders = parseInt(
        screen.getByTestId('shared-comp1-renders').textContent || '0',
      );
      const comp2Renders = parseInt(
        screen.getByTestId('shared-comp2-renders').textContent || '0',
      );
      const comp3Renders = parseInt(
        screen.getByTestId('shared-comp3-renders').textContent || '0',
      );

      // Each component should render minimally (initial + data update)
      expect(comp1Renders).toBeLessThanOrEqual(3);
      expect(comp2Renders).toBeLessThanOrEqual(3);
      expect(comp3Renders).toBeLessThanOrEqual(3);
      expect(sharedFetchCount).toBe(1);

      // All components should have same data
      expect(screen.getByTestId('shared-comp1-data').textContent).toBe(
        screen.getByTestId('shared-comp2-data').textContent,
      );
      expect(screen.getByTestId('shared-comp2-data').textContent).toBe(
        screen.getByTestId('shared-comp3-data').textContent,
      );
    });

    it('should only rerender when cache data actually changes', async () => {
      let renderCount = 0;
      let fetchCallCount = 0;

      // Mock different responses for each call
      global.fetch = jest.fn().mockImplementation(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          data: {
            message: `Response ${fetchCallCount}`,
            fetchNumber: fetchCallCount,
            timestamp: Date.now(),
          },
        });
      });

      const CacheChangeComponent = () => {
        renderCount++;

        const { data, refetch, mutate } = useFetcher('/api/cache-change-test', {
          cacheTime: 100,
          staleTime: 5000,
        });

        return (
          <div>
            <div data-testid="cache-render-count">{renderCount}</div>
            <div data-testid="cache-fetch-count">{fetchCallCount}</div>
            <div data-testid="cache-data">
              {data ? `${data.message} (${data.fetchNumber})` : 'Loading...'}
            </div>

            <button data-testid="refetch-btn" onClick={() => refetch(true)}>
              Refetch (Force)
            </button>

            <button
              data-testid="refetch-cached-btn"
              onClick={() => refetch(false)}
            >
              Refetch (Use Cache)
            </button>

            <button
              data-testid="mutate-btn"
              onClick={() =>
                mutate({ message: 'Mutated data', fetchNumber: 999 })
              }
            >
              Mutate Data
            </button>
          </div>
        );
      };

      render(<CacheChangeComponent />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('cache-data')).toHaveTextContent(
          'Response 1 (1)',
        );
      });

      const getCurrentRenderCount = () =>
        Number(screen.getByTestId('cache-render-count').textContent || '0');
      const getCurrentFetchCount = () =>
        Number(screen.getByTestId('cache-fetch-count').textContent || '0');

      let renderAfterInitialLoad = getCurrentRenderCount();

      // Test 1: Cached refetch should NOT cause rerender (no data change)
      fireEvent.click(screen.getByTestId('refetch-cached-btn'));

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      expect(getCurrentRenderCount()).toBe(renderAfterInitialLoad); // Same render count
      expect(getCurrentFetchCount()).toBe(1); // Same fetch count

      // Test 2: Force refetch SHOULD cause rerender (data changes)
      fireEvent.click(screen.getByTestId('refetch-btn'));

      renderAfterInitialLoad++; // isFetching will increment this

      expect(getCurrentRenderCount()).toBe(renderAfterInitialLoad);

      await waitFor(() => {
        expect(screen.getByTestId('cache-data')).toHaveTextContent(
          'Response 2 (2)',
        );
      });

      renderAfterInitialLoad++; // Data loaded will increment this

      expect(getCurrentRenderCount()).toBe(renderAfterInitialLoad);
      expect(getCurrentFetchCount()).toBe(2); // One additional fetch

      let renderAfterRefetch = getCurrentRenderCount();

      // Test 3: Mutate SHOULD cause rerender (data changes)
      fireEvent.click(screen.getByTestId('mutate-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('cache-data')).toHaveTextContent(
          'Mutated data (999)',
        );
      });

      renderAfterRefetch++; // Mutate will increment this

      expect(getCurrentRenderCount()).toBe(renderAfterRefetch); // One additional render
      expect(getCurrentFetchCount()).toBe(2); // Same fetch count (mutate doesn't fetch)

      // Final assertion: Renders should be minimal and only when data actually changes
      // 1. Initial mount and data load (first fetch resolves so "isFetching" is already true as "immediate" is false).
      // 2. isLoading state change (when refetch is triggered).
      // 3. Data update after forced refetch (second fetch resolves).
      // 4. Mutate call (local cache mutation triggers rerender).
      // 5. Any additional state transitions (such as isLoading toggling back to false).
      expect(getCurrentRenderCount()).toBeLessThanOrEqual(
        renderAfterInitialLoad + renderAfterRefetch,
      );
      expect(getCurrentRenderCount()).toBeLessThanOrEqual(5);
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
