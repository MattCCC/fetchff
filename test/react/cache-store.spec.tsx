/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import type { CacheEntry, StoredResponse } from '../../src';
import { useFetcher } from '../../src/react/index';
import { pruneCache } from '../../src/cache-manager';
import { clearAllTimeouts } from '../../src/timeout-wheel';
import {
  clearMockResponses,
  mockFetchResponse,
} from '../utils/mockFetchResponse';

describe('useFetcher() with a cache store', () => {
  afterEach(() => {
    pruneCache();
    clearAllTimeouts();
    clearMockResponses();
  });

  it('should show the stored response after a page reload without a request', async () => {
    const store = new Map<string, CacheEntry<StoredResponse>>();
    const fetchMock = mockFetchResponse('/api/user', { body: { name: 'Ada' } });

    const first = renderHook(() =>
      useFetcher('/api/user', { cacheStore: store }),
    );

    await waitFor(() =>
      expect(first.result.current.data).toEqual({ name: 'Ada' }),
    );
    first.unmount();

    // A page reload clears the in-memory cache, while the store keeps the response
    pruneCache();
    clearAllTimeouts();

    const second = renderHook(() =>
      useFetcher('/api/user', { cacheStore: store }),
    );

    await waitFor(() =>
      expect(second.result.current.data).toEqual({ name: 'Ada' }),
    );
    expect(second.result.current.isSuccess).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
