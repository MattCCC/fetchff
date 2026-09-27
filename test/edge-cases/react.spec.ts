/**
 * @jest-environment jsdom
 */
/**
 * Edge cases of the React hook: missing URLs and suspense fallbacks.
 */
import { renderHook } from '@testing-library/react';
import { useFetcher } from '../../src/react/index';
import { pruneCache, setCache } from '../../src/cache-manager';
import { clearAllTimeouts } from '../../src/timeout-wheel';

afterEach(() => {
  pruneCache();
  clearAllTimeouts();
});

describe('useFetcher() edge cases', () => {
  it('should resolve mutate() and refetch() to null when there is no URL', async () => {
    const { result } = renderHook(() => useFetcher(null));

    await expect(result.current.mutate(null)).resolves.toBeNull();
    await expect(result.current.refetch()).resolves.toBeNull();
  });

  it('should not suspend on a cached entry without data when nothing is in flight', () => {
    setCache('reject-key', { data: null, error: null, isFetching: false }, -1);

    const { result } = renderHook(() =>
      useFetcher('/resource', {
        cacheKey: 'reject-key',
        strategy: 'reject',
        immediate: false,
      }),
    );

    expect(result.current.data).toBeNull();
    expect(result.current.isFetching).toBe(false);
  });

  it('should not suspend or fetch in reject mode when the URL is empty', () => {
    const { result } = renderHook(() =>
      useFetcher('', { strategy: 'reject', immediate: false }),
    );

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isFetching).toBe(false);
  });
});
