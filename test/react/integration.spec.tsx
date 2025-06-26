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
import type { RequestConfig } from '../../src/types/request-handler';
import {
  clearMockResponses,
  mockFetchResponse,
} from '../utils/mockFetchResponse';

// Test interfaces
interface TestData {
  message?: string;
  count?: number;
  original?: boolean;
  updated?: boolean;
  id?: number;
  name?: string;
  shared?: string;
  timestamp?: number;
  deduped?: boolean;
  poll?: number;
  success?: boolean;
  suspense?: string;
  individual?: boolean;
  posts?: Array<{ id: number; title: string }>;
  focus?: number;
  headers?: string;
  created?: boolean;
  userId?: number;
  default?: string;
  overlap?: boolean;
}

// Test components
const BasicComponent = ({
  url,
  config = {},
}: {
  url: string | null;
  config?: RequestConfig<TestData>;
}) => {
  const {
    data,
    error,
    headers,
    isLoading,
    isValidating,
    mutate,
    refetch,
    config: requestConfig,
  } = useFetcher<TestData>(url, config);

  return (
    <div>
      <div data-testid="loading">
        {isLoading ? 'Loading...' : 'Not Loading'}
      </div>
      <div data-testid="validating">
        {isValidating ? 'Validating...' : 'Not Validating'}
      </div>
      <div data-testid="data">{data ? JSON.stringify(data) : 'No Data'}</div>
      <div data-testid="headers">
        {headers ? JSON.stringify(headers) : 'No headers'}
      </div>
      <div data-testid="error">{error ? error.message : 'No Error'}</div>
      <div data-testid="config">
        {requestConfig ? JSON.stringify(requestConfig) : 'No Config'}
      </div>
      <button onClick={() => refetch()} data-testid="refetch">
        Refetch
      </button>
      <button onClick={() => mutate({ updated: true })} data-testid="mutate">
        Mutate
      </button>
    </div>
  );
};

const SuspenseComponent = ({ url }: { url: string }) => {
  const { data, error, isLoading } = useFetcher<TestData>(url, {
    strategy: 'reject',
  });

  if (error) {
    return <div data-testid="error">Error: {error.message}</div>;
  }

  if (isLoading) {
    return <div data-testid="suspense-loading">Suspense Loading...</div>;
  }

  return <div data-testid="data">{JSON.stringify(data)}</div>;
};

const MultipleRequestsComponent = () => {
  const { data: data1 } = useFetcher<TestData>('/api/data-1');
  const { data: data2 } = useFetcher<TestData>('/api/data-2');
  const { data: data3, config: config3 } = useFetcher<TestData>('/api/data-3');

  return (
    <div>
      <div data-testid="data-1">
        {data1 ? JSON.stringify(data1) : 'No Data 1'}
      </div>
      <div data-testid="data-2">
        {data2 ? JSON.stringify(data2) : 'No Data 2'}
      </div>
      <div data-testid="data-3">
        {data3 ? JSON.stringify(data3) : 'No Data 3'}
      </div>
      <div data-testid="data-3-config">
        {config3 ? JSON.stringify(config3) : 'No Data 3 Config'}
      </div>
    </div>
  );
};

const ErrorHandlingComponent = ({ shouldError }: { shouldError: boolean }) => {
  const { data, error, refetch } = useFetcher<TestData>(
    shouldError ? '/api/error-endpoint' : '/api/success-endpoint',
    {
      retry: {
        retries: 2,
        delay: 100,
        backoff: 1.5,
      },
    },
  );

  return (
    <div>
      <div data-testid="result-data">
        {data ? JSON.stringify(data) : 'No Data'}
      </div>
      <div data-testid="result-error">{error ? error.message : 'No Error'}</div>
      <button onClick={() => refetch()} data-testid="retry">
        Retry
      </button>
    </div>
  );
};

const ConditionalComponent = ({ enabled }: { enabled: boolean }) => {
  const { data, isLoading } = useFetcher<TestData>(
    enabled ? '/api/conditional' : null,
  );

  return (
    <div>
      <div data-testid="conditional-data">
        {data ? JSON.stringify(data) : 'No Data'}
      </div>
      <div data-testid="conditional-loading">
        {isLoading ? 'Loading' : 'Not Loading'}
      </div>
    </div>
  );
};

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
});
