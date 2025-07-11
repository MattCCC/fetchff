/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  clearMockResponses,
  createAbortableFetchMock,
  mockFetchResponse,
} from '../../utils/mockFetchResponse';
import { useFetcher } from '../../../src/react/index';

describe('Error Handling Integration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    clearMockResponses();
  });

  describe('Network Errors', () => {
    it('should handle network timeouts', async () => {
      let abortSignal: AbortSignal | null = null;

      global.fetch = jest.fn().mockImplementation((url, options) => {
        abortSignal = options?.signal as AbortSignal | null;
        return createAbortableFetchMock(1000, true)(url, options);
      });

      const TimeoutComponent = () => {
        const { data, error, isLoading } = useFetcher('/api/slow-endpoint', {
          timeout: 1000, // 1 second timeout
        });

        return (
          <div>
            <div data-testid="timeout-loading">
              {isLoading ? 'Loading...' : 'Not Loading'}
            </div>
            <div data-testid="timeout-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid="timeout-error">
              {error ? error.message : 'No Error'}
            </div>
          </div>
        );
      };

      render(<TimeoutComponent />);

      // Wait for request to start
      await waitFor(() => {
        expect(abortSignal).not.toBeNull();
      });

      expect(screen.getByTestId('timeout-loading')).toHaveTextContent(
        'Loading...',
      );

      // Advance time to trigger timeout
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.getByTestId('timeout-error')).toHaveTextContent(
          'timeout',
        );
        expect(screen.getByTestId('timeout-loading')).toHaveTextContent(
          'Not Loading',
        );
        expect(screen.getByTestId('timeout-data')).toHaveTextContent('No Data');
      });
    });

    it('should handle connection refused errors', async () => {
      let abortSignal: AbortSignal | null = null;

      global.fetch = jest.fn().mockImplementation((url, options) => {
        abortSignal = options?.signal as AbortSignal | null;

        return createAbortableFetchMock(0, true, {
          ok: false,
          status: 500,
        })(url, options);
      });

      const ConnectionErrorComponent = () => {
        const { data, error, isLoading, refetch } = useFetcher(
          '/api/unreachable',
          {
            strategy: 'softFail',
            cacheTime: 0,
          },
        );

        return (
          <div>
            <div data-testid="connection-loading">
              {isLoading ? 'Loading...' : 'Not Loading'}
            </div>
            <div data-testid="connection-error">
              {error ? error.message : 'No Error'}
            </div>
            <div data-testid="connection-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <button onClick={refetch} data-testid="retry-button">
              Retry
            </button>
          </div>
        );
      };

      render(<ConnectionErrorComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('connection-error')).toHaveTextContent(
          'Status: 500',
        );
        expect(screen.getByTestId('connection-data')).toHaveTextContent(
          'No Data',
        );
      });

      // Test retry functionality
      fireEvent.click(screen.getByTestId('retry-button'));
      expect(screen.getByTestId('connection-loading')).toHaveTextContent(
        'Loading...',
      );
      jest.runAllTimers();

      await waitFor(() => {
        expect(abortSignal).not.toBeNull();
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-error')).toHaveTextContent(
          'Status: 500',
        );
      });
    });
  });

  describe('HTTP Status Errors', () => {
    it('should handle 404 Not Found errors', async () => {
      mockFetchResponse('/api/missing-resource', {
        status: 404,
        statusText: 'Not Found',
        ok: false,
      });

      const NotFoundComponent = () => {
        const { data, error, isLoading } = useFetcher('/api/missing-resource', {
          strategy: 'softFail',
        });

        return (
          <div>
            <div data-testid="not-found-loading">
              {isLoading ? 'Loading...' : 'Not Loading'}
            </div>
            <div data-testid="not-found-error">
              {error ? `${error.status}: ${error.statusText}` : 'No Error'}
            </div>
            <div data-testid="not-found-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
          </div>
        );
      };

      render(<NotFoundComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('not-found-error')).toHaveTextContent(
          '404: Not Found',
        );
        expect(screen.getByTestId('not-found-data')).toHaveTextContent(
          'No Data',
        );
        expect(screen.getByTestId('not-found-loading')).toHaveTextContent(
          'Not Loading',
        );
      });
    });

    it('should handle 500 Internal Server Error', async () => {
      mockFetchResponse('/api/server-error', {
        status: 500,
        ok: false,
      });

      const ServerErrorComponent = () => {
        const { data, error, isLoading } = useFetcher('/api/server-error', {
          strategy: 'softFail',
          retry: {
            retries: 2,
            delay: 100,
          },
        });

        return (
          <div>
            <div data-testid="server-error-loading">
              {isLoading ? 'Loading...' : 'Not Loading'}
            </div>
            <div data-testid="server-error-status">
              {error ? `Status: ${error.status}` : 'No Status'}
            </div>
            <div data-testid="server-error-message">
              {error ? error.message : 'No Error'}
            </div>
            <div data-testid="server-error-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
          </div>
        );
      };

      render(<ServerErrorComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('server-error-status')).toHaveTextContent(
          'Status: 500',
        );
        expect(screen.getByTestId('server-error-data')).toHaveTextContent(
          'No Data',
        );
      });
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary errors', async () => {
      let requestCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        requestCount++;

        if (requestCount <= 2) {
          // First 2 requests fail
          return Promise.resolve({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
          });
        }

        // Third request succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          data: { message: 'Service recovered', attempt: requestCount },
        });
      });

      const ErrorRecoveryComponent = () => {
        const { data, error, isLoading } = useFetcher(
          '/api/unreliable-service',
          {
            retry: {
              retries: 3,
              delay: 100,
              backoff: 1.5,
            },
            strategy: 'softFail',
          },
        );

        return (
          <div>
            <div data-testid="recovery-loading">
              {isLoading ? 'Loading...' : 'Not Loading'}
            </div>
            <div data-testid="recovery-error">
              {error ? `Error: ${error.status}` : 'No Error'}
            </div>
            <div data-testid="recovery-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid="request-count">{requestCount}</div>
          </div>
        );
      };

      render(<ErrorRecoveryComponent />);

      // Should eventually recover after retries
      await waitFor(
        () => {
          expect(screen.getByTestId('recovery-data')).toHaveTextContent(
            'Service recovered',
          );
          expect(screen.getByTestId('recovery-error')).toHaveTextContent(
            'No Error',
          );
        },
        { timeout: 5000 },
      );

      expect(requestCount).toBe(3);
    });

    it('should handle error boundaries with fetchf failures', async () => {
      const originalConsoleError = console.error;
      console.error = jest.fn();

      mockFetchResponse('/api/critical-error', {
        status: 500,
        ok: false,
        body: { message: 'Critical system failure' },
      });

      class ErrorBoundary extends React.Component<
        { children: React.ReactNode },
        { hasError: boolean; error?: Error }
      > {
        constructor(props: { children: React.ReactNode }) {
          super(props);
          this.state = { hasError: false };
        }

        static getDerivedStateFromError(error: Error) {
          return { hasError: true, error };
        }

        render() {
          if (this.state.hasError) {
            return (
              <div data-testid="error-boundary">
                Error Boundary Caught:{' '}
                {this.state.error?.message || 'Unknown error'}
              </div>
            );
          }

          return this.props.children;
        }
      }

      const CriticalErrorComponent = () => {
        const { data, error } = useFetcher('/api/critical-error', {
          strategy: 'reject', // This will throw on error
        });

        if (error) {
          throw new Error(`Critical API Error: ${error.message}`);
        }

        return (
          <div data-testid="critical-data">
            {data ? JSON.stringify(data) : 'Loading...'}
          </div>
        );
      };

      render(
        <ErrorBoundary>
          <CriticalErrorComponent />
        </ErrorBoundary>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-boundary')).toHaveTextContent(
          'Error Boundary Caught: Critical API Error',
        );
      });

      console.error = originalConsoleError;
    });
  });

  describe('Graceful Degradation', () => {
    it('should provide fallback UI for failed requests', async () => {
      mockFetchResponse('/api/user-profile', {
        status: 500,
        ok: false,
        body: { message: 'Profile service unavailable' },
      });

      const GracefulDegradationComponent = () => {
        const { data, error, isLoading } = useFetcher('/api/user-profile', {
          strategy: 'softFail',
        });

        const showFallback = error && !isLoading;

        return (
          <div>
            {isLoading && (
              <div data-testid="loading-skeleton">Loading profile...</div>
            )}

            {showFallback && (
              <div data-testid="fallback-ui">
                <h3>Profile Unavailable</h3>
                <p>We're having trouble loading your profile right now.</p>
                <p>Please try again later.</p>
              </div>
            )}

            {data && !error && (
              <div data-testid="profile-data">
                <h3>Welcome, {data.name}</h3>
                <p>{data.email}</p>
              </div>
            )}

            <div data-testid="error-details" style={{ display: 'none' }}>
              {error ? error.message : 'No Error'}
            </div>
          </div>
        );
      };

      render(<GracefulDegradationComponent />);

      // Should show loading first
      expect(screen.getByTestId('loading-skeleton')).toHaveTextContent(
        'Loading profile...',
      );

      // Should show fallback UI on error
      await waitFor(() => {
        expect(screen.getByTestId('fallback-ui')).toHaveTextContent(
          'Profile Unavailable',
        );
        expect(
          screen.queryByTestId('loading-skeleton'),
        ).not.toBeInTheDocument();
        expect(screen.queryByTestId('profile-data')).not.toBeInTheDocument();
      });
    });

    it('should handle partial data loading failures', async () => {
      // Mock successful main data but failed secondary data
      mockFetchResponse('/api/dashboard', {
        body: {
          user: { name: 'John Doe', id: 1 },
          stats: { views: 1234, likes: 567 },
        },
      });

      mockFetchResponse('/api/dashboard/notifications', {
        status: 503,
        ok: false,
        body: { message: 'Notification service down' },
      });

      const PartialLoadingComponent = () => {
        const { data: dashboardData, error: dashboardError } =
          useFetcher('/api/dashboard');

        const { data: notificationsData, error: notificationsError } =
          useFetcher('/api/dashboard/notifications', { strategy: 'softFail' });

        return (
          <div>
            <div data-testid="dashboard-data">
              {dashboardData ? (
                <div>
                  <h2>Welcome, {dashboardData.user.name}</h2>
                  <p>Views: {dashboardData.stats.views}</p>
                </div>
              ) : (
                'Loading dashboard...'
              )}
            </div>

            <div data-testid="notifications-section">
              {notificationsError ? (
                <div>
                  <h3>Notifications</h3>
                  <p>Notifications are temporarily unavailable</p>
                </div>
              ) : notificationsData ? (
                <div>
                  <h3>Notifications</h3>
                  <p>{notificationsData.count} new notifications</p>
                </div>
              ) : (
                'Loading notifications...'
              )}
            </div>

            <div data-testid="dashboard-error">
              {dashboardError ? dashboardError.message : 'No Dashboard Error'}
            </div>
            <div data-testid="notifications-error">
              {notificationsError
                ? notificationsError.message
                : 'No Notifications Error'}
            </div>
          </div>
        );
      };

      render(<PartialLoadingComponent />);

      // Should load main dashboard data successfully
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-data')).toHaveTextContent(
          'Welcome, John Doe',
        );
        expect(screen.getByTestId('dashboard-data')).toHaveTextContent(
          'Views: 1234',
        );
        expect(screen.getByTestId('dashboard-error')).toHaveTextContent(
          'No Dashboard Error',
        );
      });

      // Should show fallback for failed notifications
      await waitFor(() => {
        expect(screen.getByTestId('notifications-section')).toHaveTextContent(
          'Notifications are temporarily unavailable',
        );
      });
    });
  });
});
