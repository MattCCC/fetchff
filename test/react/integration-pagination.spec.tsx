/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React, { act } from 'react';
import {
  clearMockResponses,
  mockFetchResponse,
} from '../utils/mockFetchResponse';
import { useFetcher } from '../../src/react/index';
import {
  ErrorPaginationComponent,
  InfiniteScrollComponent,
  PaginationComponent,
  SearchPaginationComponent,
} from '../mocks/test-components';

describe('React Pagination Integration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    clearMockResponses();
  });

  describe('Pagination', () => {
    it('should handle paginated data loading', async () => {
      // Mock paginated responses
      mockFetchResponse('/api/posts?page=1&limit=10', {
        body: {
          data: [
            { id: 1, title: 'Post 1' },
            { id: 2, title: 'Post 2' },
            { id: 3, title: 'Post 3' },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 25,
            totalPages: 3,
            hasNext: true,
            hasPrev: false,
          },
        },
      });

      mockFetchResponse('/api/posts?page=2&limit=10', {
        body: {
          data: [
            { id: 4, title: 'Post 4' },
            { id: 5, title: 'Post 5' },
            { id: 6, title: 'Post 6' },
          ],
          pagination: {
            page: 2,
            limit: 10,
            total: 25,
            totalPages: 3,
            hasNext: true,
            hasPrev: true,
          },
        },
      });

      render(<PaginationComponent />);

      // Should show loading initially
      expect(screen.getByTestId('pagination-loading')).toHaveTextContent(
        'Loading',
      );

      // Should load first page
      await waitFor(() => {
        expect(screen.getByTestId('pagination-data')).toHaveTextContent(
          'Post 1',
        );
        expect(screen.getByTestId('pagination-info')).toHaveTextContent(
          'Page 1 of 3',
        );
        expect(screen.getByTestId('pagination-loading')).toHaveTextContent(
          'Not Loading',
        );
      });

      // Previous button should be disabled on first page
      expect(screen.getByTestId('prev-page')).toBeDisabled();
      expect(screen.getByTestId('next-page')).not.toBeDisabled();

      // Navigate to next page
      fireEvent.click(screen.getByTestId('next-page'));

      // Should show loading for page 2
      expect(screen.getByTestId('pagination-loading')).toHaveTextContent(
        'Loading',
      );

      // Should load second page
      await waitFor(() => {
        expect(screen.getByTestId('pagination-data')).toHaveTextContent(
          'Post 4',
        );
        expect(screen.getByTestId('pagination-info')).toHaveTextContent(
          'Page 2 of 3',
        );
        expect(screen.getByTestId('current-page')).toHaveTextContent('2');
      });

      // Both buttons should be enabled on middle page
      expect(screen.getByTestId('prev-page')).not.toBeDisabled();
      expect(screen.getByTestId('next-page')).not.toBeDisabled();

      // Verify both requests were made
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1'),
        expect.any(Object),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
        expect.any(Object),
      );
    });

    it('should handle infinite scroll pagination', async () => {
      // Mock infinite scroll responses
      mockFetchResponse('/api/feed?offset=0&limit=5', {
        body: {
          items: [
            { id: 1, content: 'Item 1' },
            { id: 2, content: 'Item 2' },
            { id: 3, content: 'Item 3' },
            { id: 4, content: 'Item 4' },
            { id: 5, content: 'Item 5' },
          ],
          hasMore: true,
          nextOffset: 5,
        },
      });

      mockFetchResponse('/api/feed?offset=5&limit=5', {
        body: {
          items: [
            { id: 6, content: 'Item 6' },
            { id: 7, content: 'Item 7' },
            { id: 8, content: 'Item 8' },
          ],
          hasMore: false,
          nextOffset: null,
        },
      });

      render(<InfiniteScrollComponent />);

      // Should load initial items
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveTextContent('Item 1');
        expect(screen.getByTestId('item-5')).toHaveTextContent('Item 5');
        expect(screen.getByTestId('items-count')).toHaveTextContent('5');
        expect(screen.getByTestId('has-more')).toHaveTextContent('Has More');
      });

      // Load more items
      fireEvent.click(screen.getByTestId('load-more'));

      expect(screen.getByTestId('infinite-loading')).toHaveTextContent(
        'Loading More',
      );

      await waitFor(() => {
        expect(screen.getByTestId('item-6')).toHaveTextContent('Item 6');
        expect(screen.getByTestId('item-8')).toHaveTextContent('Item 8');
        expect(screen.getByTestId('items-count')).toHaveTextContent('8');
        expect(screen.getByTestId('has-more')).toHaveTextContent('No More');
      });

      // Load more button should be disabled when no more data
      expect(screen.getByTestId('load-more')).toBeDisabled();
    });

    it('should handle pagination with search and filtering', async () => {
      // Mock search responses
      mockFetchResponse('/api/users?search=john&status=active&page=1&limit=3', {
        body: {
          users: [
            { id: 1, name: 'John Doe', status: 'active' },
            { id: 2, name: 'John Smith', status: 'active' },
          ],
          pagination: {
            page: 1,
            limit: 3,
            total: 2,
            totalPages: 1,
          },
        },
      });

      mockFetchResponse('/api/users?search=jane&status=active&page=1&limit=3', {
        body: {
          users: [
            { id: 3, name: 'Jane Wilson', status: 'active' },
            { id: 4, name: 'Jane Brown', status: 'active' },
          ],
          pagination: {
            page: 1,
            limit: 3,
            total: 2,
            totalPages: 1,
          },
        },
      });

      render(<SearchPaginationComponent />);

      // Should search for "john" initially
      await waitFor(() => {
        expect(screen.getByTestId('user-1')).toHaveTextContent(
          'John Doe - active',
        );
        expect(screen.getByTestId('user-2')).toHaveTextContent(
          'John Smith - active',
        );
        expect(screen.getByTestId('search-total')).toHaveTextContent(
          'Total: 2',
        );
      });

      // Change search term
      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'jane' },
      });

      expect(screen.getByTestId('search-loading')).toHaveTextContent(
        'Searching',
      );

      // Should show new search results
      await waitFor(() => {
        expect(screen.getByTestId('user-3')).toHaveTextContent(
          'Jane Wilson - active',
        );
        expect(screen.getByTestId('user-4')).toHaveTextContent(
          'Jane Brown - active',
        );
        expect(screen.getByTestId('search-total')).toHaveTextContent(
          'Total: 2',
        );
        expect(screen.getByTestId('search-page')).toHaveTextContent('Page: 1');
      });

      // Verify both search queries were made
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=john'),
        expect.any(Object),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=jane'),
        expect.any(Object),
      );
    });

    it('should handle pagination errors and retries', async () => {
      let attemptCount = 0;
      global.fetch = jest.fn().mockImplementation((url) => {
        attemptCount++;

        if (url.includes('page=2') && attemptCount <= 2) {
          // Fail first 2 attempts to page 2
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Server Error',
          });
        }

        if (url.includes('page=2')) {
          // Succeed on 3rd attempt
          return Promise.resolve({
            ok: true,
            status: 200,
            body: {
              data: [{ id: 4, title: 'Post 4 (Retry Success)' }],
              pagination: {
                page: 2,
                totalPages: 3,
                hasNext: true,
                hasPrev: true,
              },
            },
            data: {
              data: [{ id: 4, title: 'Post 4 (Retry Success)' }],
              pagination: {
                page: 2,
                totalPages: 3,
                hasNext: true,
                hasPrev: true,
              },
            },
          });
        }

        // Page 1 always succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          body: {
            data: [{ id: 1, title: 'Post 1' }],
            pagination: {
              page: 1,
              totalPages: 3,
              hasNext: true,
              hasPrev: false,
            },
          },
          data: {
            data: [{ id: 1, title: 'Post 1' }],
            pagination: {
              page: 1,
              totalPages: 3,
              hasNext: true,
              hasPrev: false,
            },
          },
        });
      });

      render(<ErrorPaginationComponent attemptCount={attemptCount} />);

      // Should load page 1 successfully
      await waitFor(() => {
        expect(screen.getByTestId('error-pagination-data')).toHaveTextContent(
          'Post 1',
        );
        expect(screen.getByTestId('error-pagination-error')).toHaveTextContent(
          'No Error',
        );
      });

      // Go to page 2 (will fail and retry)
      fireEvent.click(screen.getByTestId('goto-page-2'));

      expect(screen.getByTestId('error-pagination-loading')).toHaveTextContent(
        'Loading',
      );

      // Should eventually succeed after retries
      await waitFor(
        () => {
          expect(screen.getByTestId('error-pagination-data')).toHaveTextContent(
            'Retry Success',
          );
          expect(
            screen.getByTestId('error-pagination-error'),
          ).toHaveTextContent('No Error');
        },
        { timeout: 5000 },
      );

      // Advance timers for retry delays
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should have made multiple attempts
      expect(attemptCount).toBeGreaterThanOrEqual(3); // 1 for page 1 + 2 for page 2
    });

    it('should cache different pages independently', async () => {
      mockFetchResponse('/api/cached-posts?page=1', {
        body: { data: [{ id: 1, title: 'Cached Post 1' }], page: 1 },
      });

      mockFetchResponse('/api/cached-posts?page=2', {
        body: { data: [{ id: 2, title: 'Cached Post 2' }], page: 2 },
      });

      const CachedPaginationComponent = () => {
        const [page, setPage] = React.useState(1);

        const { data } = useFetcher(`/api/cached-posts`, {
          params: { page },
          cacheTime: 3600, // Cache for 1 hour
          cacheKey: `cached-posts-page-${page}`,
        });

        return (
          <div>
            <div data-testid="cached-data">
              {data ? JSON.stringify(data) : 'No Data'}
            </div>
            <button onClick={() => setPage(1)} data-testid="go-page-1">
              Page 1
            </button>
            <button onClick={() => setPage(2)} data-testid="go-page-2">
              Page 2
            </button>
            <div data-testid="cached-page">{page}</div>
          </div>
        );
      };

      render(<CachedPaginationComponent />);

      // Load page 1
      await waitFor(() => {
        expect(screen.getByTestId('cached-data')).toHaveTextContent(
          'Cached Post 1',
        );
      });

      // Switch to page 2
      fireEvent.click(screen.getByTestId('go-page-2'));

      await waitFor(() => {
        expect(screen.getByTestId('cached-data')).toHaveTextContent(
          'Cached Post 2',
        );
        expect(screen.getByTestId('cached-page')).toHaveTextContent('2');
      });

      // Switch back to page 1 - should be cached (no additional fetch)
      const fetchCallsBefore = (global.fetch as jest.Mock).mock.calls.length;
      fireEvent.click(screen.getByTestId('go-page-1'));

      await waitFor(() => {
        expect(screen.getByTestId('cached-data')).toHaveTextContent(
          'Cached Post 1',
        );
        expect(screen.getByTestId('cached-page')).toHaveTextContent('1');
      });

      // Should not have made additional fetch call (cached)
      const fetchCallsAfter = (global.fetch as jest.Mock).mock.calls.length;
      expect(fetchCallsAfter).toBe(fetchCallsBefore);
    });
  });
});
