/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { removeRevalidators } from '../../src';
import { useFetcher } from '../../src/react/index';
import { pruneCache } from '../../src/cache-manager';
import { clearAllTimeouts } from '../../src/timeout-wheel';

const books = [{ id: 1, title: 'Dune' }];

describe('useFetcher() with ETags', () => {
  let fetchMock: jest.Mock;

  // The server answers 304 Not Modified when a request has the ETag of the books, if it sends one
  const mockServer = (etag?: string) => {
    fetchMock = jest.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      const isNotModified = !!etag && headers['if-none-match'] === etag;

      return {
        ok: !isNotModified,
        status: isNotModified ? 304 : 200,
        headers: { 'Content-Type': 'application/json', ...(etag && { etag }) },
        data: isNotModified ? null : books,
      };
    });

    global.fetch = fetchMock;
  };

  // Renders the hook, and counts its renders
  const renderBooks = async () => {
    let renders = 0;
    const hook = renderHook(() => {
      renders++;

      return useFetcher('/api/books', { refetchOnFocus: true });
    });

    await waitFor(() => expect(hook.result.current.data).toEqual(books));

    return { hook, getRenders: () => renders };
  };

  const focusWindow = () =>
    act(async () => {
      window.dispatchEvent(new Event('focus'));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

  afterEach(() => {
    removeRevalidators('focus');
    pruneCache();
    clearAllTimeouts();
  });

  it('should not rerender when a revalidation is answered with 304 Not Modified', async () => {
    mockServer('"v1"');

    const { hook, getRenders } = await renderBooks();
    const renders = getRenders();
    const { data } = hook.result.current;

    await focusWindow();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers['if-none-match']).toBe('"v1"');
    expect(getRenders()).toBe(renders);
    expect(hook.result.current.data).toBe(data);
  });

  it('should rerender with the response of a revalidation without an ETag', async () => {
    mockServer();

    const { hook, getRenders } = await renderBooks();
    const renders = getRenders();

    await focusWindow();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].headers['if-none-match']).toBeUndefined();
    expect(getRenders()).toBeGreaterThan(renders);
    expect(hook.result.current.data).toEqual(books);
  });
});
