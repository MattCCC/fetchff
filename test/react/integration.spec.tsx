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
});
