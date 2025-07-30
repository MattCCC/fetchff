/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { useState } from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { mockFetchResponse } from '../../utils/mockFetchResponse';
import { useFetcher } from '../../../src/react/index';

describe('POST body cache key update and refetch', () => {
  it('should not update cache key but use new body when refetch is called after body changes and retries are active', async () => {
    mockFetchResponse('/api/user', {
      ok: true,
      status: 200,
      body: { echoed: { name: 'Alice' } },
    });

    function TestComponent() {
      const [name, setName] = useState('Alice');
      const { data, refetch, isLoading, isFetching, config } = useFetcher(
        '/api/user',
        {
          method: 'POST',
          body: { name },
          cacheKey: '/api/user',
          immediate: true,
          retry: { retries: 5, delay: 1000, backoff: 2 },
        },
      );

      return (
        <div>
          <div data-testid="result">{data?.echoed?.name}</div>
          <div data-testid="config">{JSON.stringify(config)}</div>
          <div data-testid="loading">{isLoading ? 'loading' : 'idle'}</div>
          <div data-testid="fetching">{isFetching ? 'fetching' : 'idle'}</div>
          <button onClick={() => setName('Bob')}>Change Name</button>
          <button onClick={() => refetch()}>Refetch</button>
        </div>
      );
    }

    render(<TestComponent />);

    // Initial fetch with name "Alice"
    await waitFor(() =>
      expect(screen.getByTestId('result').textContent).toBe('Alice'),
    );

    mockFetchResponse('/api/user', {
      ok: true,
      status: 200,
      body: { echoed: { name: 'Bob' } },
    });

    // Change name to "Bob"
    fireEvent.click(screen.getByText('Change Name'));

    // Refetch with new body
    fireEvent.click(screen.getByText('Refetch'));

    // Should show loading state
    expect(screen.getByTestId('loading').textContent).toBe('loading');
    expect(screen.getByTestId('fetching').textContent).toBe('fetching');

    // Wait for fetch to complete and check new body is used
    await waitFor(() =>
      expect(screen.getByTestId('result').textContent).toBe('Bob'),
    );

    // Should show idle state after fetch completes
    expect(screen.getByTestId('loading').textContent).toBe('idle');
    expect(screen.getByTestId('fetching').textContent).toBe('idle');

    // Check if the body used in fetch is updated
    expect(screen.getByTestId('config').textContent).toContain(
      '"body":"{\\"name\\":\\"Bob\\"}"',
    );

    // Check the cache key is updated
    expect(screen.getByTestId('config').textContent).toContain(
      '"cacheKey":"/api/user"',
    );
  });

  it('should regenerate cache key and use updated body when POST body changes and refetch is called', async () => {
    const testUrl = '/api/post-body-cache-key';
    const initialBody = { value: 'first' };
    const updatedBody = { value: 'second' };
    let currentBody = initialBody;

    // Mock fetch to echo back the request body
    global.fetch = jest.fn().mockImplementation((_url, config) => {
      const parsedBody =
        config && config.body ? JSON.parse(config.body) : undefined;
      return Promise.resolve({
        ok: true,
        status: 200,
        data: parsedBody,
        body: parsedBody,
        json: () => Promise.resolve(parsedBody),
      });
    });

    // React state simulation
    let setBody: (b: typeof initialBody) => void = () => {};
    function BodyComponent() {
      const [body, _setBody] = useState(currentBody);
      setBody = _setBody;
      const { data, refetch, isLoading } = useFetcher(testUrl, {
        method: 'POST',
        body,
      });
      return (
        <div>
          <div data-testid="data">
            {data ? JSON.stringify(data) : 'No Data'}
          </div>
          <div data-testid="loading">
            {isLoading ? 'Loading...' : 'Not Loading'}
          </div>
          <button data-testid="refetch-btn" onClick={() => refetch(true)}>
            Refetch
          </button>
        </div>
      );
    }

    render(<BodyComponent />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(screen.getByTestId('data')).toHaveTextContent('No Data');
    });

    // Act: update the body asynchronously
    act(() => {
      currentBody = updatedBody;
      setBody(updatedBody);
    });

    // Refetch with new body
    fireEvent.click(screen.getByTestId('refetch-btn'));

    // Assert: data should match updated body
    await waitFor(() => {
      expect(screen.getByTestId('data')).toHaveTextContent('second');
    });

    // Also check that fetch was called with the updated body
    expect(global.fetch).toHaveBeenLastCalledWith(
      testUrl,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(updatedBody),
      }),
    );
  });
});
