/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { useEffect, useState } from 'react';
import {
  clearMockResponses,
  mockFetchResponse,
} from '../../utils/mockFetchResponse';
import { useFetcher } from '../../../src/react/index';
import { fetchf } from 'fetchff/index';

describe('Authentication Integration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    clearMockResponses();
  });

  describe('Login Flow', () => {
    it('should handle successful login and token storage', async () => {
      mockFetchResponse('/api/auth/login', {
        body: {
          user: { id: 1, email: 'user@example.com' },
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-456',
        },
      });

      const LoginComponent = () => {
        const [credentials] = useState({
          email: 'user@example.com',
          password: 'password123',
        });
        const [token, setToken] = useState<string | null>(null);

        const { data, error, isLoading, refetch } = useFetcher<{
          user: { id: number; email: string };
          accessToken: string;
          refreshToken: string;
        }>('/api/auth/login', {
          method: 'POST',
          body: credentials,
          immediate: false,
        });

        useEffect(() => {
          if (data?.accessToken) {
            setToken(data.accessToken);
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
          }
        }, [data]);

        return (
          <div>
            <div data-testid="login-loading">
              {isLoading ? 'Logging in...' : 'Not Loading'}
            </div>
            <div data-testid="login-error">
              {error ? error.message : 'No Error'}
            </div>
            <div data-testid="user-data">
              {data?.user ? JSON.stringify(data.user) : 'No User'}
            </div>
            <div data-testid="access-token">{token || 'No Token'}</div>
            <button onClick={refetch} data-testid="login-button">
              Login
            </button>
          </div>
        );
      };

      render(<LoginComponent />);

      // Initially no user data
      expect(screen.getByTestId('user-data')).toHaveTextContent('No User');
      expect(screen.getByTestId('access-token')).toHaveTextContent('No Token');

      // Click login
      fireEvent.click(screen.getByTestId('login-button'));

      expect(screen.getByTestId('login-loading')).toHaveTextContent(
        'Logging in...',
      );

      // Should show user data after login
      await waitFor(() => {
        expect(screen.getByTestId('user-data')).toHaveTextContent(
          'user@example.com',
        );
        expect(screen.getByTestId('access-token')).toHaveTextContent(
          'access-token-123',
        );
        expect(screen.getByTestId('login-error')).toHaveTextContent('No Error');
      });

      // Should store tokens in localStorage
      expect(localStorage.getItem('accessToken')).toBe('access-token-123');
      expect(localStorage.getItem('refreshToken')).toBe('refresh-token-456');
    });

    it('should handle login failure and display error', async () => {
      mockFetchResponse('/api/auth/login', {
        status: 401,
        ok: false,
        body: { message: 'Invalid credentials' },
      });

      const LoginErrorComponent = () => {
        const { data, error, refetch } = useFetcher('/api/auth/login', {
          method: 'POST',
          body: { email: 'wrong@example.com', password: 'wrongpass' },
          immediate: false,
          strategy: 'softFail',
        });

        return (
          <div>
            <div data-testid="login-error">
              {error ? `Error: ${error.status}` : 'No Error'}
            </div>
            <div data-testid="login-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <button onClick={refetch} data-testid="login-button">
              Login
            </button>
          </div>
        );
      };

      render(<LoginErrorComponent />);

      fireEvent.click(screen.getByTestId('login-button'));

      expect(screen.getByTestId('login-data')).toHaveTextContent('No Data');

      await waitFor(() => {
        expect(screen.getByTestId('login-error')).toHaveTextContent(
          'Error: 401',
        );
        expect(screen.getByTestId('login-data')).toHaveTextContent(
          'Invalid credentials',
        );
      });
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token when access token expires', async () => {
      let requestCount = 0;

      global.fetch = jest.fn().mockImplementation((url) => {
        requestCount++;

        if (url.includes('/api/profile') && requestCount === 1) {
          // First request fails with 401
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
          });
        }

        if (url.includes('/api/auth/refresh') && requestCount === 2) {
          // Refresh token request
          return Promise.resolve({
            ok: true,
            status: 200,
            data: {
              accessToken: 'new-access-token-789',
              refreshToken: 'new-refresh-token-012',
            },
          });
        }

        if (url.includes('/api/profile') && requestCount > 2) {
          // Retry with new token succeeds
          return Promise.resolve({
            ok: true,
            status: 200,
            data: { id: 1, email: 'user@example.com', name: 'John Doe' },
          });
        }

        return Promise.reject(new Error('Unexpected request'));
      });

      const TokenRefreshComponent = () => {
        const [accessToken, setAccessToken] = useState('expired-token');

        const { data, error, refetch } = useFetcher('/api/profile', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          immediate: false,
          retry: {
            retries: 1,
            shouldRetry: async (response, attempt) => {
              if (response.status === 401 && attempt === 0) {
                // Refresh token
                const { data: refreshData } = await fetchf(
                  '/api/auth/refresh',
                  {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${localStorage.getItem('refreshToken')}`,
                    },
                  },
                );

                if (refreshData?.accessToken) {
                  setAccessToken(refreshData.accessToken);
                  localStorage.setItem('accessToken', refreshData.accessToken);

                  return true; // Retry with new token
                }
              }
              return false;
            },
          },
        });

        return (
          <div>
            <div data-testid="profile-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid="profile-error">
              {error ? `Error: ${error.status}` : 'No Error'}
            </div>
            <div data-testid="current-token">{accessToken}</div>
            <button onClick={refetch} data-testid="load-profile">
              Load Profile
            </button>
          </div>
        );
      };

      // Set initial refresh token
      localStorage.setItem('refreshToken', 'refresh-token-456');

      render(<TokenRefreshComponent />);

      fireEvent.click(screen.getByTestId('load-profile'));

      await act(async () => {
        jest.advanceTimersByTime(2000); // Simulate wait time between retries
      });

      // Should eventually show profile data with new token
      await waitFor(
        () => {
          expect(screen.getByTestId('profile-data')).toHaveTextContent(
            'John Doe',
          );
          expect(screen.getByTestId('current-token')).toHaveTextContent(
            'new-access-token-789',
          );
          expect(screen.getByTestId('profile-error')).toHaveTextContent(
            'No Error',
          );
        },
        { timeout: 2000 },
      );

      expect(requestCount).toBeGreaterThanOrEqual(3); // 401 + refresh + retry
    });
  });

  describe('Protected Routes', () => {
    it('should handle protected routes with authentication', async () => {
      mockFetchResponse('/api/admin/users', {
        body: {
          users: [
            { id: 1, email: 'admin@example.com', role: 'admin' },
            { id: 2, email: 'user@example.com', role: 'user' },
          ],
        },
      });

      const ProtectedComponent = ({
        isAuthenticated,
      }: {
        isAuthenticated: boolean;
      }) => {
        const token = isAuthenticated ? 'valid-admin-token' : null;

        const { data, error, isLoading } = useFetcher('/api/admin/users', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          immediate: !!token,
        });

        if (!isAuthenticated) {
          return <div data-testid="auth-required">Authentication Required</div>;
        }

        return (
          <div>
            <div data-testid="protected-loading">
              {isLoading ? 'Loading...' : 'Not Loading'}
            </div>
            <div data-testid="protected-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <div data-testid="protected-error">
              {error ? error.message : 'No Error'}
            </div>
          </div>
        );
      };

      // Test unauthenticated access
      const { rerender } = render(
        <ProtectedComponent isAuthenticated={false} />,
      );

      expect(screen.getByTestId('auth-required')).toHaveTextContent(
        'Authentication Required',
      );

      // Test authenticated access
      rerender(<ProtectedComponent isAuthenticated={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('protected-data')).toHaveTextContent(
          'admin@example.com',
        );
        expect(screen.getByTestId('protected-error')).toHaveTextContent(
          'No Error',
        );
      });
    });
  });

  describe('Logout Flow', () => {
    it('should handle logout and clear tokens', async () => {
      mockFetchResponse('/api/auth/logout', {
        body: { message: 'Logged out successfully' },
      });

      const LogoutComponent = () => {
        const [isLoggedIn, setIsLoggedIn] = useState(true);

        const { data, error, refetch } = useFetcher('/api/auth/logout', {
          method: 'POST',
          immediate: false,
        });

        const handleLogout = async () => {
          await refetch();
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setIsLoggedIn(false);
        };

        return (
          <div>
            <div data-testid="logout-status">
              {isLoggedIn ? 'Logged In' : 'Logged Out'}
            </div>
            <div data-testid="logout-response">
              {data ? JSON.stringify(data) : 'No Response'}
            </div>
            <div data-testid="logout-error">
              {error ? error.message : 'No Error'}
            </div>
            <button onClick={handleLogout} data-testid="logout-button">
              Logout
            </button>
          </div>
        );
      };

      // Set initial tokens
      localStorage.setItem('accessToken', 'access-token-123');
      localStorage.setItem('refreshToken', 'refresh-token-456');

      render(<LogoutComponent />);

      expect(screen.getByTestId('logout-status')).toHaveTextContent(
        'Logged In',
      );

      fireEvent.click(screen.getByTestId('logout-button'));

      await waitFor(() => {
        expect(screen.getByTestId('logout-status')).toHaveTextContent(
          'Logged Out',
        );
        expect(screen.getByTestId('logout-response')).toHaveTextContent(
          'Logged out successfully',
        );
      });

      // Should clear tokens from localStorage
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });
});
