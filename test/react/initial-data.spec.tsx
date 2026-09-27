/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useFetcher } from '../../src/react/index';
import { pruneCache } from '../../src/cache-manager';
import { clearAllTimeouts } from '../../src/timeout-wheel';

const initialData = [{ id: 1, title: 'Dune' }];
const books = [{ id: 2, title: 'Emma' }];

describe('useFetcher() with initialData', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async () => ({ ok: true, status: 200, data: books }));
    global.fetch = fetchMock;
  });

  afterEach(() => {
    pruneCache();
    clearAllTimeouts();
  });

  it('should show the initial data right away without a request', async () => {
    const { result } = renderHook(() =>
      useFetcher('/api/books', { initialData }),
    );

    expect(result.current).toMatchObject({
      data: initialData,
      isLoading: false,
      error: null,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(initialData);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should fetch fresh data on refetch', async () => {
    const { result } = renderHook(() =>
      useFetcher('/api/books', { initialData }),
    );

    await act(() => result.current.refetch());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(books);
  });
});
