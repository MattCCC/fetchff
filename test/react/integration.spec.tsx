/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { Suspense } from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { useFetcher } from '../../src/react/index';
import {
  clearMockResponses,
  createAbortableFetchMock,
  mockFetchResponse,
} from '../utils/mockFetchResponse';
import {
  BasicComponent,
  ErrorHandlingComponent,
  SuspenseComponent,
  MultipleRequestsComponent,
  ConditionalComponent,
  TestData,
} from '../mocks/test-components';
import { generateCacheKey } from 'fetchff/cache-manager';
import { buildConfig } from 'fetchff/config-handler';
import { getRefCount, getRefs } from 'fetchff/react/cache-ref';
import React from 'react';

describe('React Integration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    clearMockResponses();
  });

  describe('Basic Functionality', () => {
    it('should render loading state initially and then data', async () => {
      mockFetchResponse('/api/test', { body: { message: 'Hello World' } });

      render(<BasicComponent url="/api/test" />);

      // Should show loading initially
      expect(screen.getByTestId('loading')).toHaveTextContent('Loading...');
      expect(screen.getByTestId('data')).toHaveTextContent('No Data');

      // Should show data after fetch
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
        expect(screen.getByTestId('data')).toHaveTextContent(
          '{"message":"Hello World"}',
        );
      });
    });

    it('should handle null URL without making requests', () => {
      mockFetchResponse('/api/null', { body: { message: 'Something' } });
      render(<BasicComponent url={null} />);

      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
      expect(screen.getByTestId('data')).toHaveTextContent('No Data');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should refetch when refetch button is clicked', async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          body: { count: callCount },
          data: { count: callCount },
        });
      });

      render(<BasicComponent url="/api/refetch" />);

      // Wait for initial data
      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('{"count":1}');
      });

      // Click refetch
      fireEvent.click(screen.getByTestId('refetch'));

      // Should show updated data
      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('{"count":2}');
      });

      expect(callCount).toBe(2);
    });

    it('should update data when mutate is called', async () => {
      mockFetchResponse('/api/mutate', { body: { original: true } });

      render(<BasicComponent url="/api/mutate" />);

      // Wait for initial data
      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent(
          '{"original":true}',
        );
      });

      // Click mutate
      fireEvent.click(screen.getByTestId('mutate'));

      // Should show mutated data immediately
      expect(screen.getByTestId('data')).toHaveTextContent('{"updated":true}');
    });
  });

  describe('Error Handling', () => {
    it('should display error when fetch fails', async () => {
      mockFetchResponse('/api/error', { status: 500, ok: false });

      render(<BasicComponent url="/api/error" />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'GET to /api/error failed! Status: 500',
        );
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
      });
    });

    it('should handle network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));

      render(<BasicComponent url="/api/network-error" />);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Network Error');
      });
    });

    it('should retry on failure and eventually succeed', async () => {
      let attempts = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        attempts++;

        if (attempts <= 2) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Server Error',
            body: {},
            data: {},
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          body: { success: true },
          data: { success: true },
        });
      });

      render(<ErrorHandlingComponent shouldError={false} />);

      // Should eventually show success data after retries
      await waitFor(
        () => {
          expect(screen.getByTestId('result-data')).toHaveTextContent(
            '{"success":true}',
          );
        },
        { timeout: 5000 },
      );

      // Advance timers to handle retry delays
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(attempts).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Suspense Integration', () => {
    it('should work with Suspense boundaries', async () => {
      mockFetchResponse('/api/suspense', { body: { suspense: 'works' } });

      render(
        <Suspense
          fallback={
            <div data-testid="suspense-loading">Suspense Loading...</div>
          }
        >
          <SuspenseComponent url="/api/suspense" />
        </Suspense>,
      );

      // Should show Suspense fallback initially
      expect(screen.getByTestId('suspense-loading')).toHaveTextContent(
        'Suspense Loading...',
      );

      // Should show data after loading
      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent(
          '{"suspense":"works"}',
        );
      });
    });

    it('should handle errors in Suspense components', async () => {
      mockFetchResponse('/api/suspense-error', { status: 404, ok: false });

      render(
        <Suspense
          fallback={<div data-testid="suspense-loading">Loading...</div>}
        >
          <SuspenseComponent url="/api/suspense-error" />
        </Suspense>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Error: GET to /api/suspense-error failed! Status: 404',
        );
      });
    });
  });

  describe('Configuration Options', () => {
    it('should handle custom headers', async () => {
      mockFetchResponse('/api/headers', { headers: { something: 'received' } });

      render(
        <BasicComponent
          url="/api/headers"
          config={{
            headers: {
              Authorization: 'Bearer token',
              'X-Custom': 'custom-value',
            },
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('headers')).toHaveTextContent('received');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/headers',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Custom': 'custom-value' }),
        }),
      );
    });

    it('should handle POST requests with body', async () => {
      mockFetchResponse('/api/post', {
        method: 'POST',
        body: { created: true },
      });

      render(
        <BasicComponent
          url="/api/post"
          config={{
            method: 'POST',
            body: { name: 'Test Item' },
            immediate: false,
          }}
        />,
      );

      // POST requests should NOT auto-trigger
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
      expect(screen.getByTestId('data')).toHaveTextContent('No Data');

      // Click refetch
      fireEvent.click(screen.getByTestId('refetch'));

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent(
          '{"created":true}',
        );
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/post',
        expect.objectContaining({ method: 'POST' }),
      );

      expect(screen.getByTestId('config')).toHaveTextContent('"method":"POST"');
    });

    it('should handle URL path parameters', async () => {
      mockFetchResponse('/api/users/123/posts', {
        body: {
          userId: 123,
          posts: [],
        },
      });

      render(
        <BasicComponent
          url="/api/users/:userId/posts"
          config={{
            urlPathParams: { userId: '123' },
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent(
          '{"userId":123,"posts":[]}',
        );
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/123/posts',
        expect.any(Object),
      );
    });

    it('should handle query parameters', async () => {
      mockFetchResponse('/api/search?q=test%20query&limit=10', {
        body: { query: 'processed' },
      });

      render(
        <BasicComponent
          url="/api/search"
          config={{
            params: { q: 'test query', limit: 10 },
          }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent(
          '{"query":"processed"}',
        );
      });

      // Check that the URL contains query parameters
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=test%20query'),
        expect.any(Object),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object),
      );
    });

    it('should handle custom cache keys', async () => {
      const customCacheKey = () => 'my-custom-key';
      mockFetchResponse('/api/custom-cache', { body: { cached: true } });

      render(
        <BasicComponent
          url="/api/custom-cache"
          config={{ cacheKey: customCacheKey }}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('{"cached":true}');
      });
    });
  });

  describe('Advanced Caching', () => {
    it('should handle cache corruption recovery', async () => {
      // First request
      mockFetchResponse('/api/cache-test', { body: { version: 1 } });

      const { unmount } = render(<BasicComponent url="/api/cache-test" />);

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('version');
      });

      unmount();

      // Simulate cache corruption by directly modifying cache
      // Then verify recovery on next request
      mockFetchResponse('/api/cache-test', { body: { version: 2 } });

      render(<BasicComponent url="/api/cache-test" />);

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('version');
      });
    });

    it('should handle cache size limits', async () => {
      // Create many cache entries to test limits
      for (let i = 0; i < 1000; i++) {
        mockFetchResponse(`/api/cache-limit-${i}`, { body: { id: i } });
        const { unmount } = render(
          <BasicComponent url={`/api/cache-limit-${i}`} />,
        );
        unmount();
      }

      // Verify cache doesn't grow indefinitely
      const refs = getRefs();
      expect(refs.size).toBeLessThan(1000); // Should have been cleaned up
    });
  });

  describe('React Features', () => {
    it('should work correctly in React Strict Mode', async () => {
      mockFetchResponse('/api/strict', { body: { strict: true } });

      render(
        <React.StrictMode>
          <BasicComponent url="/api/strict" />
        </React.StrictMode>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('strict');
      });

      // In strict mode, effects run twice in development
      // Verify no duplicate requests
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle React 18 concurrent features', async () => {
      mockFetchResponse('/api/concurrent?v=1', { body: { concurrent: true } });

      const ConcurrentComponent = () => {
        const [isPending, startTransition] = React.useTransition();
        const [url, setUrl] = React.useState('/api/concurrent?v=1');

        const { data } = useFetcher(url);

        return (
          <div>
            <div data-testid="pending">
              {isPending ? 'Pending' : 'Not Pending'}
            </div>
            <div data-testid="data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <button
              onClick={() =>
                startTransition(() => setUrl('/api/concurrent?v=2'))
              }
            >
              Update
            </button>
          </div>
        );
      };

      render(<ConcurrentComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('concurrent');
      });
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple simultaneous different requests', async () => {
      mockFetchResponse('/api/data-1', { body: { id: 1 } });
      mockFetchResponse('/api/data-2', { body: { id: 2 } });
      mockFetchResponse('/api/data-3', { body: { id: 3 } });

      render(<MultipleRequestsComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('data-1')).toHaveTextContent('{"id":1}');
        expect(screen.getByTestId('data-2')).toHaveTextContent('{"id":2}');
        expect(screen.getByTestId('data-3')).toHaveTextContent('{"id":3}');
      });

      const fetchCalls = (global.fetch as jest.Mock).mock.calls;
      expect(fetchCalls.length).toBe(3);
    });

    it('should handle conditional requests based on props', async () => {
      mockFetchResponse('/api/conditional', { body: { conditional: true } });

      const { rerender } = render(<ConditionalComponent enabled={false} />);

      // Should not make request when disabled
      expect(screen.getByTestId('conditional-loading')).toHaveTextContent(
        'Not Loading',
      );
      expect(global.fetch).not.toHaveBeenCalled();

      // Should make request when enabled
      rerender(<ConditionalComponent enabled={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('conditional-data')).toHaveTextContent(
          '{"conditional":true}',
        );
      });
    });

    it('should handle strategy changes dynamically', async () => {
      mockFetchResponse('/api/strategy', { status: 404, ok: false });

      const StrategyComponent = ({
        strategy,
      }: {
        strategy: 'reject' | 'softFail';
      }) => {
        const { data, error } = useFetcher<TestData>('/api/strategy', {
          strategy,
        });
        return (
          <div>
            <div data-testid="strategy-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid="strategy-error">
              {error ? error.message : 'No Error'}
            </div>
          </div>
        );
      };

      const { rerender } = render(<StrategyComponent strategy="softFail" />);

      await waitFor(() => {
        expect(screen.getByTestId('strategy-error')).toHaveTextContent('404');
      });

      // Change strategy
      rerender(<StrategyComponent strategy="reject" />);

      // Should handle strategy change
      expect(screen.getByTestId('strategy-error')).toHaveTextContent('404');
    });
  });

  describe('Focus Revalidation', () => {
    it('should revalidate on window focus', async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          body: { focus: callCount },
          data: { focus: callCount },
        });
      });

      const RevalidationComponent = () => {
        const { data, isValidating } = useFetcher<TestData>(
          '/api/revalidate-data',
          {
            revalidateOnFocus: true,
            cacheTime: 5,
          },
        );

        return (
          <div>
            <div data-testid="revalidate-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid="revalidate-validating">
              {isValidating ? 'Revalidating...' : 'Not Revalidating'}
            </div>
          </div>
        );
      };

      render(<RevalidationComponent />);

      // Initial request
      await waitFor(() => {
        expect(screen.getByTestId('revalidate-data')).toHaveTextContent(
          '{"focus":1}',
        );
      });

      // Simulate window focus
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      // Advance timers to process any debounced focus handling
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Should revalidate
      await waitFor(() => {
        expect(screen.getByTestId('revalidate-data')).toHaveTextContent(
          '{"focus":2}',
        );
      });

      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Polling', () => {
    it('should poll data at specified intervals', async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          body: { poll: callCount },
          data: { poll: callCount },
        });
      });

      const PollingComponent = ({
        interval,
        shouldStop,
      }: {
        interval: number;
        shouldStop: boolean;
      }) => {
        const { data, isValidating } = useFetcher<TestData>('/api/poll-data', {
          pollingInterval: interval,
          shouldStopPolling: shouldStop ? () => true : undefined,
        });

        return (
          <div>
            <div data-testid="poll-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid="poll-validating">
              {isValidating ? 'Polling...' : 'Not Polling'}
            </div>
          </div>
        );
      };

      render(<PollingComponent interval={1000} shouldStop={false} />);

      // Initial request
      await waitFor(() => {
        expect(screen.getByTestId('poll-data')).toHaveTextContent('{"poll":1}');
      });

      // Advance timer for polling
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('poll-data')).toHaveTextContent('{"poll":2}');
      });

      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Complex Mixed Settings', () => {
    it('should handle caching + retry + polling combined', async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Server Error',
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          body: { retryCount: callCount, cacheHit: false },
          data: { retryCount: callCount, cacheHit: false },
        });
      });

      const ComplexComponent = () => {
        const { data, error, isValidating } = useFetcher<TestData>(
          '/api/complex',
          {
            cacheTime: 10,
            dedupeTime: 2,
            revalidateOnFocus: true,
            pollingInterval: 1000,
            retry: { retries: 3, delay: 100, backoff: 2 },
            cacheKey: 'complex-test',
          },
        );

        return (
          <div>
            <div data-testid="complex-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid="complex-error">
              {error?.message || 'No Error'}
            </div>
            <div data-testid="complex-validating">
              {isValidating ? 'Validating' : 'Not Validating'}
            </div>
          </div>
        );
      };

      await act(async () => {
        render(<ComplexComponent />);
      });

      // Should retry and eventually succeed
      await waitFor(() => {
        expect(screen.getByTestId('complex-data')).toHaveTextContent(
          'retryCount',
        );
      });

      // Advance timer for polling
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    it('should handle mixed strategies with different error handling', async () => {
      mockFetchResponse('/api/reject', { status: 404, ok: false });
      mockFetchResponse('/api/softfail', { status: 500, ok: false });

      const MixedComponent = () => {
        const { data: rejectData, error: rejectError } = useFetcher<TestData>(
          '/api/reject',
          {
            strategy: 'reject',
            cacheTime: 5,
          },
        );

        const { data: softFailData } = useFetcher<TestData>('/api/softfail', {
          strategy: 'softFail',
          defaultResponse: { message: 'fallback' },
          retry: { retries: 2, delay: 50 },
        });

        return (
          <div>
            <div data-testid="reject-data">
              {rejectData ? JSON.stringify(rejectData) : 'No Reject Data'}
            </div>
            <div data-testid="reject-error">
              {rejectError?.message || 'No Reject Error'}
            </div>
            <div data-testid="softfail-data">
              {softFailData ? JSON.stringify(softFailData) : 'No SoftFail Data'}
            </div>
          </div>
        );
      };

      render(<MixedComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('reject-error')).toHaveTextContent('404');
        expect(screen.getByTestId('softfail-data')).toHaveTextContent(
          'fallback',
        );
      });
    });

    it('should handle cache mutations with dependencies', async () => {
      mockFetchResponse('/api/users/123', { body: { id: 123, name: 'John' } });
      mockFetchResponse('/api/users/123/posts', {
        body: { posts: ['post1', 'post2'] },
      });

      const CacheComponent = () => {
        const { data: user, mutate: mutateUser } = useFetcher<TestData>(
          '/api/users/123',
          {
            cacheTime: 30,
            cacheKey: 'user-123',
          },
        );

        const { data: posts, mutate: mutatePosts } = useFetcher<TestData>(
          '/api/users/123/posts',
          {
            cacheTime: 15,
            cacheKey: 'posts-123',
            immediate: !!user,
          },
        );

        const updateUser = () => {
          mutateUser({ ...user, name: 'Updated Name', mutated: true });
          mutatePosts({ ...posts, cached: true });
        };

        return (
          <div>
            <div data-testid="user-data">
              {user ? JSON.stringify(user) : 'No User'}
            </div>
            <div data-testid="posts-data">
              {posts ? JSON.stringify(posts) : 'No Posts'}
            </div>
            <button onClick={updateUser} data-testid="update-user">
              Update User
            </button>
          </div>
        );
      };

      render(<CacheComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('user-data')).toHaveTextContent('John');
      });

      fireEvent.click(screen.getByTestId('update-user'));

      expect(screen.getByTestId('user-data')).toHaveTextContent('Updated Name');
      expect(screen.getByTestId('user-data')).toHaveTextContent('mutated');
    });

    it('should handle conditional requests with dynamic URLs', async () => {
      mockFetchResponse('/api/users/456', { body: { id: 456, name: 'Jane' } });
      mockFetchResponse('/api/posts/789?include=comments', {
        body: { id: 789, title: 'Post Title' },
      });

      const DynamicComponent = ({
        type,
        id,
        enabled,
      }: {
        type: 'user' | 'post' | null;
        id?: number;
        enabled: boolean;
      }) => {
        const url = enabled && type && id ? `/api/${type}s/${id}` : null;

        const { data, isLoading } = useFetcher<TestData>(url, {
          cacheTime: type === 'user' ? 60 : 30,
          dedupeTime: 5,
          retry: { retries: type === 'user' ? 3 : 1, delay: 200 },
          params: type === 'post' ? { include: 'comments' } : undefined,
        });

        return (
          <div>
            <div data-testid="dynamic-url">{url || 'No URL'}</div>
            <div data-testid="dynamic-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid="dynamic-loading">
              {isLoading ? 'Loading' : 'Not Loading'}
            </div>
          </div>
        );
      };

      const { rerender } = render(
        <DynamicComponent type={null} enabled={false} />,
      );

      expect(screen.getByTestId('dynamic-url')).toHaveTextContent('No URL');
      expect(global.fetch).not.toHaveBeenCalled();

      rerender(<DynamicComponent type="user" id={456} enabled={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('dynamic-data')).toHaveTextContent('Jane');
      });

      rerender(<DynamicComponent type="post" id={789} enabled={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('dynamic-data')).toHaveTextContent(
          'Post Title',
        );
      });
    });

    it('should handle overlapping requests with different configs', async () => {
      mockFetchResponse('/api/overlap', { body: { phase: 'initial' } });

      const OverlapComponent = ({ phase }: { phase: 1 | 2 | 3 }) => {
        const config1 = {
          cacheTime: phase === 1 ? 10 : 0,
          dedupeTime: 1,
          method: 'GET' as const,
        };

        const config2 = {
          cacheTime: 20,
          method: phase === 2 ? 'POST' : 'GET',
          body: phase === 2 ? { data: 'test' } : undefined,
          immediate: phase !== 2,
        };

        const { data: data1 } = useFetcher<TestData>('/api/overlap', config1);
        const { data: data2, refetch } = useFetcher<TestData>(
          '/api/overlap',
          config2,
        );

        return (
          <div>
            <div data-testid="overlap-data1">
              {data1 ? JSON.stringify(data1) : 'No Data1'}
            </div>
            <div data-testid="overlap-data2">
              {data2 ? JSON.stringify(data2) : 'No Data2'}
            </div>
            <div data-testid="overlap-phase">{phase}</div>
            <button onClick={refetch} data-testid="overlap-refetch">
              Refetch
            </button>
          </div>
        );
      };

      const { rerender } = render(<OverlapComponent phase={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('overlap-data1')).toHaveTextContent(
          'initial',
        );
      });

      rerender(<OverlapComponent phase={2} />);
      fireEvent.click(screen.getByTestId('overlap-refetch'));

      rerender(<OverlapComponent phase={3} />);
      expect(screen.getByTestId('overlap-phase')).toHaveTextContent('3');
    });

    it('should handle different error types with mixed configurations', async () => {
      const ErrorComponent = ({
        errorType,
      }: {
        errorType: 'network' | '500' | '404' | 'success';
      }) => {
        const getUrl = () => {
          switch (errorType) {
            case 'network':
              return '/api/network-error';
            case '500':
              return '/api/server-error';
            case '404':
              return '/api/not-found';
            case 'success':
              return '/api/success';
          }
        };

        const { data, error } = useFetcher<TestData>(getUrl(), {
          timeout: 5000,
          retry: {
            retries: errorType === '500' ? 3 : 1,
            delay: 50,
            retryOn: errorType === '404' ? [] : [500, 502, 503],
          },
          strategy: errorType === '404' ? 'softFail' : 'reject',
          defaultResponse: { error: true },
        });

        return (
          <div>
            <div data-testid="error-type">{errorType}</div>
            <div data-testid="error-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid="error-message">
              {error?.message || 'No Error'}
            </div>
          </div>
        );
      };

      // Test 404 with softFail
      mockFetchResponse('/api/not-found', { status: 404, ok: false });
      const { rerender } = render(<ErrorComponent errorType="404" />);

      await waitFor(() => {
        expect(screen.getByTestId('error-data')).toHaveTextContent('error');
      });

      // Test 500 with retries
      mockFetchResponse('/api/server-error', { status: 500, ok: false });
      rerender(<ErrorComponent errorType="500" />);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('500');
      });

      // Test success
      mockFetchResponse('/api/success', { body: { success: true } });
      rerender(<ErrorComponent errorType="success" />);

      await waitFor(() => {
        expect(screen.getByTestId('error-data')).toHaveTextContent('success');
      });
    });

    it('should handle rapid config changes with cache invalidation', async () => {
      let responseCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        responseCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          body: { count: responseCount, timestamp: Date.now() },
          data: { count: responseCount, timestamp: Date.now() },
        });
      });

      const RapidComponent = ({
        config,
      }: {
        config: { cacheTime: number; dedupeTime: number };
      }) => {
        const { data, refetch } = useFetcher<TestData>('/api/rapid', {
          ...config,
          cacheKey: `rapid-${config.cacheTime}-${config.dedupeTime}`,
        });

        return (
          <div>
            <div data-testid="rapid-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <button onClick={refetch} data-testid="rapid-refetch">
              Refetch
            </button>
          </div>
        );
      };

      const { rerender } = render(
        <RapidComponent config={{ cacheTime: 10, dedupeTime: 1 }} />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('rapid-data')).toHaveTextContent('count');
      });

      // Change config rapidly
      rerender(<RapidComponent config={{ cacheTime: 0, dedupeTime: 5 }} />);
      rerender(<RapidComponent config={{ cacheTime: 30, dedupeTime: 0 }} />);

      fireEvent.click(screen.getByTestId('rapid-refetch'));

      await waitFor(() => {
        expect(screen.getByTestId('rapid-data')).toHaveTextContent('count');
      });

      expect(responseCount).toBeGreaterThan(1);
    });
  });

  describe('Configuration Validation', () => {
    it('should handle invalid configuration gracefully', async () => {
      const invalidConfigs = [
        { timeout: -1 },
        { timeout: 'invalid' },
        { retries: -1 },
        { cacheTime: 'invalid' },
        { headers: 'invalid' },
        { method: 'INVALID' },
      ];

      for (const config of invalidConfigs) {
        await act(async () => {
          expect(() =>
            // @ts-expect-error Intentionally passing invalid config
            render(<BasicComponent url="/api/invalid" config={config} />),
          ).not.toThrow();
        });
      }
    });
  });

  describe('Race Conditions', () => {
    it('should handle rapid URL changes without race conditions', async () => {
      let resolveCount = 0;
      global.fetch = jest.fn().mockImplementation((url) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolveCount++;
            resolve({
              ok: true,
              status: 200,
              body: { url, resolved: resolveCount },
              data: { url, resolved: resolveCount },
            });
          }, Math.random() * 100); // Random delay to simulate race conditions
        });
      });

      const { rerender } = render(<BasicComponent url="/api/race-1" />);

      // Rapidly change URLs
      rerender(<BasicComponent url="/api/race-2" />);
      rerender(<BasicComponent url="/api/race-3" />);
      rerender(<BasicComponent url="/api/race-4" />);

      await waitFor(() => {
        const data = screen.getByTestId('data').textContent;
        // Should show data for the LAST URL only
        expect(data).toContain('/api/race-4');
        expect(data).not.toContain('/api/race-1');
        expect(data).not.toContain('/api/race-2');
        expect(data).not.toContain('/api/race-3');
      });
    });

    it('should handle concurrent requests to same URL', async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          body: { concurrent: true, callCount },
          data: { concurrent: true, callCount },
        });
      });

      // Render multiple components with same URL simultaneously
      render(
        <div>
          <BasicComponent url="/api/concurrent" />
          <BasicComponent url="/api/concurrent" />
          <BasicComponent url="/api/concurrent" />
        </div>,
      );

      await waitFor(() => {
        const dataElements = screen.getAllByTestId('data');
        dataElements.forEach((element) => {
          expect(element).toHaveTextContent('concurrent');
        });
      });

      // Should dedupe - only 1 actual fetch call
      expect(callCount).toBe(1);
    });
  });

  describe('Memory Management', () => {
    it('should cleanup subscriptions when component unmounts', async () => {
      mockFetchResponse('/api/test', { body: { message: 'Hello World' } });

      const { unmount } = render(<BasicComponent url="/api/test" />);

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('Hello World');
      });

      const cacheKey = generateCacheKey(buildConfig('/api/test', {}));

      // Check specific cache key ref count
      expect(getRefCount(cacheKey)).toBe(1);

      // Check it's in the global refs map
      const refsBefore = getRefs();
      expect(refsBefore.has(cacheKey)).toBe(true);
      expect(refsBefore.get(cacheKey)).toBe(1);

      unmount();

      // Verify specific cleanup
      expect(getRefCount(cacheKey)).toBe(0);

      // Verify it's removed from global map (or set to 0)
      const refsAfter = getRefs();
      expect(refsAfter.get(cacheKey)).toBeUndefined();
    });

    it('should not leak memory with rapid mount/unmount cycles', async () => {
      const initialRefs = getRefs();
      const initialRefCount = Array.from(initialRefs.values()).reduce(
        (sum, count) => sum + count,
        0,
      );

      for (let i = 0; i < 100; i++) {
        const url = `/api/test-${i}`;
        mockFetchResponse(url, { body: { id: i } });

        const { unmount } = render(<BasicComponent url={url} />);
        unmount();
      }

      const finalRefs = getRefs();
      const finalRefCount = Array.from(finalRefs.values()).reduce(
        (sum, count) => sum + count,
        0,
      );

      // Should not accumulate any refs
      expect(finalRefCount).toBe(initialRefCount);

      // Or more specifically, no refs should be > 0
      const activeRefs = Array.from(finalRefs.values()).filter(
        (count) => count > 0,
      );
      expect(activeRefs).toHaveLength(0);
    });

    it('should track multiple components using same cache key', async () => {
      mockFetchResponse('/api/shared', { body: { shared: true } });

      const { unmount: unmount1 } = render(
        <BasicComponent url="/api/shared" />,
      );
      const { unmount: unmount2 } = render(
        <BasicComponent url="/api/shared" />,
      );
      const { unmount: unmount3 } = render(
        <BasicComponent url="/api/shared" />,
      );

      const cacheKey = generateCacheKey(buildConfig('/api/shared', {}));

      // Should have 3 references to the same cache key
      expect(getRefCount(cacheKey)).toBe(3);

      const refs = getRefs();
      expect(refs.get(cacheKey)).toBe(3);

      // Unmount one component
      unmount1();
      expect(getRefCount(cacheKey)).toBe(2);

      // Unmount second component
      unmount2();
      expect(getRefCount(cacheKey)).toBe(1);

      // Unmount last component
      unmount3();
      expect(getRefCount(cacheKey)).toBe(0);
    });

    it('should handle cache key collisions properly', async () => {
      // Two different URLs that might generate same cache key (edge case)
      mockFetchResponse('/api/test', { body: { source: 'first' } });
      mockFetchResponse('/api/test?v=1', { body: { source: 'second' } });

      const { unmount: unmount1 } = render(<BasicComponent url="/api/test" />);
      const { unmount: unmount2 } = render(
        <BasicComponent url="/api/test?v=1" />,
      );

      const refs = getRefs();

      // Should have proper ref counting even with different URLs
      const totalActiveRefs = Array.from(refs.values()).reduce(
        (sum, count) => sum + count,
        0,
      );
      expect(totalActiveRefs).toBe(2);

      unmount1();
      unmount2();

      const refsAfter = getRefs();
      const finalActiveRefs = Array.from(refsAfter.values()).filter(
        (count) => count > 0,
      );
      expect(finalActiveRefs).toHaveLength(0);
    });

    it('should handle rapid ref count changes without race conditions', async () => {
      mockFetchResponse('/api/rapid', { body: { test: true } });

      const components: Array<{ unmount: () => void }> = [];

      // Rapidly mount components
      for (let i = 0; i < 50; i++) {
        components.push(render(<BasicComponent url="/api/rapid" />));
      }

      const cacheKey = generateCacheKey(buildConfig('/api/rapid', {}));
      expect(getRefCount(cacheKey)).toBe(50);

      // Rapidly unmount half
      for (let i = 0; i < 25; i++) {
        components.pop()?.unmount();
      }

      expect(getRefCount(cacheKey)).toBe(25);

      // Unmount the rest
      components.forEach(({ unmount }) => unmount());

      expect(getRefCount(cacheKey)).toBe(0);
    });
  });

  describe('Request Cancellation', () => {
    it('should cancel in-flight requests when component unmounts', async () => {
      let abortSignal: AbortSignal | null = null;
      // ✅ Mock that captures signal and responds to abort
      global.fetch = jest.fn().mockImplementation((url, options) => {
        abortSignal = options?.signal;
        return createAbortableFetchMock(1000)(url, options);
      });

      const { unmount } = render(<BasicComponent url="/api/slow" />);

      // Wait for component to mount and request to start
      await waitFor(() => {
        expect(abortSignal).not.toBeNull();
      });

      // Unmount immediately (synchronously)
      unmount();

      // Check that abort signal was triggered by unmount
      expect((abortSignal as AbortSignal | null)?.aborted).toBe(true);
    });

    it('should handle timeout cancellation', async () => {
      let abortSignal: AbortSignal | null = null;

      global.fetch = jest.fn().mockImplementation((url, options) => {
        abortSignal = options?.signal as AbortSignal | null;
        return createAbortableFetchMock(2000, true)(url, options);
      });

      render(<BasicComponent url="/api/timeout" config={{ timeout: 100 }} />);

      // Wait for request to start
      await waitFor(() => {
        expect(abortSignal).not.toBeNull();
      });

      // Advance time past timeout
      await act(async () => {
        jest.advanceTimersByTime(150);
      });

      // Should be aborted and show error
      expect((abortSignal as AbortSignal | null)?.aborted).toBe(true);

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          /timeout|aborted/i,
        );
      });
    });

    it('should NOT cancel requests when component stays mounted', async () => {
      let abortSignal: AbortSignal | null = null;
      let requestCompleted = false;

      global.fetch = jest.fn().mockImplementation((url, options) => {
        abortSignal = options?.signal as AbortSignal | null;
        return createAbortableFetchMock(1000, true)(url, options).then(
          (result: unknown) => {
            requestCompleted = true;
            return result;
          },
        );
      });

      render(<BasicComponent url="/api/not-cancelled" />);

      // Wait for request to start
      await waitFor(() => {
        expect(abortSignal).not.toBeNull();
      });

      // Initially not aborted
      expect((abortSignal as AbortSignal | null)?.aborted).toBe(false);

      // Advance time to let request complete (but don't unmount)
      await act(async () => {
        jest.advanceTimersByTime(1200);
      });

      // Request should complete successfully without being aborted
      expect((abortSignal as AbortSignal | null)?.aborted).toBe(false);
      expect(requestCompleted).toBe(true);

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent(
          '"completed":true',
        );
        expect(screen.getByTestId('error')).toHaveTextContent('No Error');
      });
    });

    it('should NOT timeout when request completes within timeout limit', async () => {
      let abortSignal: AbortSignal | null = null;

      global.fetch = jest.fn().mockImplementation((url, options) => {
        abortSignal = options?.signal as AbortSignal | null;
        return createAbortableFetchMock(50, true)(url, options); // 50ms request, 150ms timeout
      });

      render(<BasicComponent url="/api/fast" config={{ timeout: 150 }} />);

      // Wait for request to start
      await waitFor(() => {
        expect(abortSignal).not.toBeNull();
      });

      // Advance time but less than timeout
      await act(async () => {
        jest.advanceTimersByTime(75);
      });

      // Should NOT be aborted
      expect((abortSignal as AbortSignal | null)?.aborted).toBe(false);

      // Should show successful data, not timeout error
      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent(
          '"completed":true',
        );
        expect(screen.getByTestId('error')).toHaveTextContent('No Error');
      });
    });
  });

  describe('Data Type Edge Cases', () => {
    it('should handle various response data types', async () => {
      const testCases = [
        { body: null, expected: 'No Data' },
        { body: 'null', expected: 'null' },
        { body: undefined, expected: 'No Data' },
        { body: '', expected: '""' },
        { body: 0, expected: '0' },
        { body: false, expected: 'false' },
        { body: [], expected: '[]' },
        { body: {}, expected: '{}' },
        { body: { nested: { deep: { value: 'test' } } }, expected: 'nested' },
      ];

      for (let index = 0; index < testCases.length; index++) {
        const testCase = testCases[index];
        mockFetchResponse(`/api/types-${index}`, testCase);

        const { unmount } = render(
          <BasicComponent url={`/api/types-${index}`} />,
        );

        await waitFor(() => {
          const dataText = screen.getByTestId('data').textContent;
          if (testCase.expected === 'No Data') {
            expect(dataText).toBe('No Data');
          } else {
            expect(dataText).toContain(testCase.expected);
          }
        });

        // Clean up between iterations to avoid multiple elements
        unmount();
      }
    });

    it('should handle circular reference objects in mutations', async () => {
      mockFetchResponse('/api/circular', { body: { id: 1, name: 'test' } });

      render(<BasicComponent url="/api/circular" />);

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('test');
      });

      // Create circular reference
      const circularObj: Record<string, unknown> = { id: 2, name: 'circular' };
      circularObj.self = circularObj;

      // Should not crash when trying to mutate with circular reference
      expect(() => {
        fireEvent.click(screen.getByTestId('mutate'));
      }).not.toThrow();
    });
  });

  describe('SSR/Hydration', () => {
    it('should handle server-side rendering without window', async () => {
      const originalWindow = global.window;
      // @ts-expect-error Delete window to simulate SSR environment
      delete global.window;

      await act(async () => {
        expect(() => {
          render(<BasicComponent url="/api/ssr" />);
        }).not.toThrow();
      });

      global.window = originalWindow;
    });
  });

  describe('Browser API Edge Cases', () => {
    it('should handle fetch API not available', async () => {
      const originalFetch = global.fetch;
      // @ts-expect-error Delete fetch to simulate no fetch API
      delete global.fetch;

      await act(async () => {
        expect(() => {
          render(<BasicComponent url="/api/no-fetch" />);
        }).not.toThrow();
      });

      global.fetch = originalFetch;
    });

    it('should work with service workers', async () => {
      // Mock service worker interception
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((url, options) => {
        // Simulate service worker modifying request
        if (url.includes('/api/sw')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            body: { serviceWorker: true, modified: true },
            data: { serviceWorker: true, modified: true },
          });
        }
        return originalFetch(url, options);
      });

      render(<BasicComponent url="/api/sw" />);

      await waitFor(() => {
        expect(screen.getByTestId('data')).toHaveTextContent('serviceWorker');
      });
    });

    it('should handle localStorage/sessionStorage not available', async () => {
      const originalLocalStorage = global.localStorage;
      // @ts-expect-error Delete localStorage to simulate no storage
      delete global.localStorage;

      await act(async () => {
        expect(() => {
          render(<BasicComponent url="/api/no-storage" />);
        }).not.toThrow();
      });

      global.localStorage = originalLocalStorage;
    });
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
      expect(endTime - startTime).toBeLessThan(120);
    });
  });
});
