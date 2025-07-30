/**
 * @jest-environment jsdom
 */
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mockFetchResponse } from '../../utils/mockFetchResponse';
import { useFetcher } from '../../../src/react/index';

describe('POST body cache key update and refetch', () => {
  it('uses new body on refetch, keeps static cache key, and updates UI state', async () => {
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
    await waitFor(() =>
      expect(screen.getByTestId('result').textContent).toBe('Alice'),
    );

    mockFetchResponse('/api/user', {
      ok: true,
      status: 200,
      body: { echoed: { name: 'Bob' } },
    });
    fireEvent.click(screen.getByText('Change Name'));
    fireEvent.click(screen.getByText('Refetch'));
    expect(screen.getByTestId('loading').textContent).toBe('loading');
    expect(screen.getByTestId('fetching').textContent).toBe('fetching');
    await waitFor(() =>
      expect(screen.getByTestId('result').textContent).toBe('Bob'),
    );
    expect(screen.getByTestId('loading').textContent).toBe('idle');
    expect(screen.getByTestId('fetching').textContent).toBe('idle');
    expect(screen.getByTestId('config').textContent).toContain(
      '"body":"{\\"name\\":\\"Bob\\"}"',
    );
    expect(screen.getByTestId('config').textContent).toContain(
      '"cacheKey":"/api/user"',
    );
  });
});
