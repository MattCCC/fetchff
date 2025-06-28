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
import { clearMockResponses } from '../../utils/mockFetchResponse';
import { useFetcher } from '../../../src/react/index';
import { removeFocusRevalidators } from 'fetchff/revalidator-manager';

describe('Real-time & WebSocket Integration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    clearMockResponses();
  });

  describe('Polling', () => {
    it('should handle automatic polling for real-time updates', async () => {
      let pollCount = 0;
      const mockResponses = [
        { notifications: [{ id: 1, message: 'First notification' }], count: 1 },
        {
          notifications: [
            { id: 1, message: 'First notification' },
            { id: 2, message: 'Second notification' },
          ],
          count: 2,
        },
        {
          notifications: [
            { id: 1, message: 'First notification' },
            { id: 2, message: 'Second notification' },
            { id: 3, message: 'Third notification' },
          ],
          count: 3,
        },
      ];

      global.fetch = jest.fn().mockImplementation(() => {
        const response =
          mockResponses[pollCount] || mockResponses[mockResponses.length - 1];
        pollCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          data: response,
        });
      });

      const PollingComponent = () => {
        const { data, isLoading } = useFetcher<{
          notifications: Array<{ id: number; message: string }>;
          count: number;
        }>('/api/notifications', {
          pollingInterval: 1000, // Poll every second
          cacheTime: 0, // Don't cache polling data
        });

        return (
          <div>
            <div data-testid="polling-loading">
              {isLoading ? 'Loading...' : 'Not Loading'}
            </div>
            <div data-testid="notification-count">
              Count: {data?.count || 0}
            </div>
            <div data-testid="notifications">
              {data?.notifications?.map((notification) => (
                <div
                  key={notification.id}
                  data-testid={`notification-${notification.id}`}
                >
                  {notification.message}
                </div>
              )) || 'No Notifications'}
            </div>
          </div>
        );
      };

      render(<PollingComponent />);

      // Should show initial data
      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toHaveTextContent(
          'Count: 1',
        );
        expect(screen.getByTestId('notification-1')).toHaveTextContent(
          'First notification',
        );
      });

      // Advance timer to trigger next poll
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should show updated data after poll
      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toHaveTextContent(
          'Count: 2',
        );
        expect(screen.getByTestId('notification-2')).toHaveTextContent(
          'Second notification',
        );
      });

      // Advance timer again
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should show third notification
      await waitFor(() => {
        expect(screen.getByTestId('notification-count')).toHaveTextContent(
          'Count: 3',
        );
        expect(screen.getByTestId('notification-3')).toHaveTextContent(
          'Third notification',
        );
      });

      expect(pollCount).toBeGreaterThanOrEqual(3);
    });

    it('should stop polling when component unmounts', async () => {
      let pollCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        pollCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          data: { timestamp: Date.now(), pollCount },
        });
      });

      const PollingComponent = () => {
        const { data } = useFetcher('/api/timestamp', {
          pollingInterval: 500,
          cacheTime: 0,
        });

        return (
          <div data-testid="timestamp">{data?.timestamp || 'No Timestamp'}</div>
        );
      };

      const { unmount } = render(<PollingComponent />);

      // Wait for initial poll
      await waitFor(() => {
        expect(screen.getByTestId('timestamp')).not.toHaveTextContent(
          'No Timestamp',
        );
      });

      const initialPollCount = pollCount;

      // Unmount component
      unmount();

      // Advance timers - should not trigger more polls
      act(() => {
        jest.advanceTimersByTime(2000); // 4 poll intervals
      });

      // Poll count should not increase after unmount
      expect(pollCount).toBeLessThanOrEqual(initialPollCount + 1);
    });
  });

  describe('Manual Refresh', () => {
    it('should handle manual refresh with revalidation', async () => {
      let requestCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        requestCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          data: {
            message: `Data updated ${requestCount} times`,
            timestamp: Date.now() + requestCount * 1000,
          },
        });
      });

      const RefreshComponent = () => {
        const { data, isLoading, refetch } = useFetcher<{
          message: string;
          timestamp: number;
        }>('/api/data', {
          cacheTime: 5000, // Cache for 5 seconds
        });

        return (
          <div>
            <div data-testid="refresh-data">{data?.message || 'No Data'}</div>
            <div data-testid="refresh-loading">
              {isLoading ? 'Loading...' : 'Not Loading'}
            </div>
            <button onClick={refetch} data-testid="refresh-button">
              Refresh
            </button>
          </div>
        );
      };

      render(<RefreshComponent />);

      // Should show initial data
      await waitFor(() => {
        expect(screen.getByTestId('refresh-data')).toHaveTextContent(
          'Data updated 1 times',
        );
      });

      // Click refresh
      fireEvent.click(screen.getByTestId('refresh-button'));

      expect(screen.getByTestId('refresh-loading')).toHaveTextContent(
        'Loading...',
      );

      // Should show updated data
      await waitFor(() => {
        expect(screen.getByTestId('refresh-data')).toHaveTextContent(
          'Data updated 2 times',
        );
        expect(screen.getByTestId('refresh-loading')).toHaveTextContent(
          'Not Loading',
        );
      });

      expect(requestCount).toBe(2);
    });
  });

  describe('Background Updates', () => {
    afterEach(() => {
      removeFocusRevalidators();
    });

    it('should handle revalidation on window focus', async () => {
      let requestCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        requestCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          data: {
            content: `Content refreshed ${requestCount} times`,
            lastUpdated: Date.now(),
          },
        });
      });

      const FocusRevalidationComponent = () => {
        const { data } = useFetcher('/api/content', {
          revalidateOnFocus: true,
          cacheTime: 1000,
        });

        return (
          <div data-testid="focus-content">{data?.content || 'No Content'}</div>
        );
      };

      render(<FocusRevalidationComponent />);

      // Should show initial data
      await waitFor(() => {
        expect(screen.getByTestId('focus-content')).toHaveTextContent(
          'Content refreshed 1 times',
        );
      });

      // Simulate window focus event
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      // Should revalidate on focus
      await waitFor(() => {
        expect(screen.getByTestId('focus-content')).toHaveTextContent(
          'Content refreshed 2 times',
        );
      });

      expect(requestCount).toBe(2);
    });

    it('should handle window focus revalidation', async () => {
      let requestCount = 0;

      global.fetch = jest.fn().mockImplementation((url) => {
        requestCount++;
        console.log(
          '🚀 ~ REQUEST COUNT global.fetch=jest.fn ~ url:',
          requestCount,
          url,
        );

        return Promise.resolve({
          ok: true,
          status: 200,
          data: {
            status: `Updated ${requestCount} times`,
            timestamp: Date.now(),
          },
        });
      });

      const FocusComponent = () => {
        const { data } = useFetcher('/api/status', {
          revalidateOnFocus: true,
          cacheTime: 500,
        });

        console.log('🚀 ~ FocusComponent ~ data:', data);
        return (
          <div data-testid="focus-status">{data?.status || 'No Status'}</div>
        );
      };

      render(<FocusComponent />);

      // Should show initial data
      await waitFor(() => {
        expect(screen.getByTestId('focus-status')).toHaveTextContent(
          'Updated 1 times',
        );
      });

      // Simulate window focus (user returns to tab)
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      // Should revalidate on focus
      await waitFor(() => {
        expect(screen.getByTestId('focus-status')).toHaveTextContent(
          'Updated 2 times',
        );
      });

      expect(requestCount).toBe(2);
    });
  });

  describe('Long Polling', () => {
    it('should handle long polling with timeout and retry', async () => {
      let pollAttempt = 0;
      const pollResponses = [
        { hasUpdate: false, data: 'No updates' },
        { hasUpdate: false, data: 'Still no updates' },
        { hasUpdate: true, data: 'New update available!' },
      ];

      global.fetch = jest.fn().mockImplementation(() => {
        const response =
          pollResponses[pollAttempt] || pollResponses[pollResponses.length - 1];
        pollAttempt++;

        return new Promise((resolve) => {
          // Simulate long polling with delay
          setTimeout(
            () => {
              resolve({
                ok: true,
                status: 200,
                data: response,
              });
            },
            response.hasUpdate ? 100 : 2000,
          ); // Quick response when update available
        });
      });

      const LongPollingComponent = () => {
        const [shouldPoll, setShouldPoll] = useState(true);
        const [updates, setUpdates] = useState<string[]>([]);

        const { data, isLoading } = useFetcher<{
          hasUpdate: boolean;
          data: string;
        }>('/api/long-poll', {
          immediate: shouldPoll,
          pollingInterval: 1000, // Poll every second
          cacheTime: 0,
        });

        useEffect(() => {
          if (data?.hasUpdate) {
            setUpdates((prev) => [...prev, data.data]);
            setShouldPoll(false); // Stop polling after getting update
          }
        }, [data]);

        return (
          <div>
            <div data-testid="long-poll-loading">
              {isLoading ? 'Polling...' : 'Not Polling'}
            </div>
            <div data-testid="long-poll-data">{data?.data || 'No Data'}</div>
            <div data-testid="updates-list">
              {updates.map((update, index) => (
                <div key={index} data-testid={`update-${index}`}>
                  {update}
                </div>
              )) || 'No Updates'}
            </div>
            <button
              onClick={() => setShouldPoll(true)}
              data-testid="start-polling"
            >
              Start Polling
            </button>
          </div>
        );
      };

      render(<LongPollingComponent />);

      // Should start polling
      expect(screen.getByTestId('long-poll-loading')).toHaveTextContent(
        'Polling...',
      );

      // Should eventually get the update
      await waitFor(
        () => {
          expect(screen.getByTestId('update-0')).toHaveTextContent(
            'New update available!',
          );
          expect(screen.getByTestId('long-poll-loading')).toHaveTextContent(
            'Not Polling',
          );
        },
        { timeout: 10000 },
      );

      expect(pollAttempt).toBeGreaterThanOrEqual(3);
    });
  });
});
