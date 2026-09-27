import {
  buildConfig,
  fetchf,
  generateCacheKey,
  getCache,
  mutate,
  subscribe,
} from '../src';
import type { CacheEntry, CustomFetcher, StoredResponse } from '../src';
import { pruneCache } from '../src/cache-manager';
import { clearAllTimeouts } from '../src/timeout-wheel';

const url = 'https://api.example.com/books';
const key = generateCacheKey(buildConfig(url, {}));
const cacheBuster = () => true;

// A server that answers 304 Not Modified when a request has the ETag of the current version of the books
const server = {
  etag: null as string | null,
  books: [] as { id: number; title: string }[],
};

describe('etag', () => {
  let fetchMock: jest.SpyInstance;

  // The If-None-Match header of a request that was sent
  const ifNoneMatchOf = (call: number) =>
    new Headers(fetchMock.mock.calls[call][1].headers).get('If-None-Match');

  beforeEach(() => {
    server.etag = '"v1"';
    server.books = [{ id: 1, title: 'Dune' }];

    fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_url, init) => {
        const headers = new Headers({ 'Content-Type': 'application/json' });

        if (server.etag) {
          headers.set('ETag', server.etag);

          if (new Headers(init!.headers).get('If-None-Match') === server.etag) {
            return new Response(null, { status: 304, headers });
          }
        }

        return new Response(
          init!.method === 'HEAD' ? null : JSON.stringify(server.books),
          { status: 200, headers },
        );
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    pruneCache();
    clearAllTimeouts();
    jest.useRealTimers();
  });

  it('should revalidate a cached response with its ETag and reuse it when the server answers 304 Not Modified', async () => {
    const first = await fetchf(url, { cacheTime: 60 });
    const second = await fetchf(url, { cacheTime: 60, cacheBuster });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ifNoneMatchOf(0)).toBeNull();
    expect(ifNoneMatchOf(1)).toBe('"v1"');

    // The cached response is reused as it is, so its data keeps its identity
    expect(second).toBe(first);
    expect(second).toMatchObject({
      status: 200,
      ok: true,
      data: [{ id: 1, title: 'Dune' }],
      error: null,
    });
    expect(getCache(key)!.data).toBe(first);
  });

  it('should revalidate stale responses in the background with their ETag and keep them cached', async () => {
    jest.useFakeTimers();

    const first = await fetchf(url, { cacheTime: 60, staleTime: 1 });
    const { time } = getCache(key)!;
    const listener = jest.fn();
    const unsubscribe = subscribe(key, listener);

    await jest.advanceTimersByTimeAsync(1000);
    unsubscribe();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ifNoneMatchOf(1)).toBe('"v1"');
    expect(listener).toHaveBeenCalledWith(first);

    // The response is cached again, so it's fresh for another staleTime
    expect(getCache(key)!.data).toBe(first);
    expect(getCache(key)!.time).toBeGreaterThan(time);
  });

  it('should revalidate with the ETag while the cache is marked as fetching', async () => {
    const config = { cacheTime: 60, staleTime: 30 };
    const first = await fetchf(url, config);
    const second = await fetchf(url, { ...config, cacheBuster });

    expect(ifNoneMatchOf(1)).toBe('"v1"');
    expect(second).toBe(first);
    expect(getCache(key)!.data).toBe(first);
  });

  it('should not transform or intercept reused responses again', async () => {
    const onResponse = jest.fn();
    const config = {
      cacheTime: 60,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: (books: any) => books.map((book: any) => book.title),
      onResponse,
    };

    await fetchf(url, config);
    const response = await fetchf(url, { ...config, cacheBuster });

    expect(ifNoneMatchOf(1)).toBe('"v1"');
    expect(response.data).toEqual(['Dune']);
    expect(onResponse).toHaveBeenCalledTimes(1);
  });

  it('should replace the cached response when the server sends a new version', async () => {
    await fetchf(url, { cacheTime: 60 });

    server.etag = '"v2"';
    server.books = [{ id: 2, title: 'Emma' }];

    const response = await fetchf(url, { cacheTime: 60, cacheBuster });

    expect(ifNoneMatchOf(1)).toBe('"v1"');
    expect(response.data).toEqual([{ id: 2, title: 'Emma' }]);
    expect(response.headers.etag).toBe('"v2"');
    expect(getCache(key)!.data).toBe(response);
  });

  it('should revalidate responses restored from a cache store with their ETag', async () => {
    jest.useFakeTimers();

    const store = new Map<string, CacheEntry<StoredResponse>>();
    const config = { cacheTime: 60, staleTime: 1, cacheStore: store };

    await fetchf(url, config);

    // A page reload, after which the stored response is stale
    pruneCache();
    clearAllTimeouts();
    jest.setSystemTime(Date.now() + 2000);

    const response = await fetchf(url, config);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ifNoneMatchOf(1)).toBe('"v1"');
    expect(response.data).toEqual([{ id: 1, title: 'Dune' }]);
    expect(getCache(key)!.data).toBe(response);
  });

  it('should revalidate HEAD requests with the ETag', async () => {
    const config = { method: 'HEAD', cacheTime: 60 };
    const first = await fetchf(url, config);
    const second = await fetchf(url, { ...config, cacheBuster });

    expect(ifNoneMatchOf(1)).toBe('"v1"');
    expect(second).toBe(first);
  });

  it('should not send an ETag for requests other than GET and HEAD', async () => {
    const config = { method: 'POST', body: { page: 1 }, cacheTime: 60 };

    await fetchf(url, config);
    await fetchf(url, { ...config, cacheBuster });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ifNoneMatchOf(1)).toBeNull();
  });

  it('should not send an ETag when the cached response has none', async () => {
    server.etag = null;

    await fetchf(url, { cacheTime: 60 });
    await fetchf(url, { cacheTime: 60, cacheBuster });

    expect(ifNoneMatchOf(1)).toBeNull();
  });

  it('should only send the ETag when the request uses the cache', async () => {
    await fetchf(url, { cacheTime: 60 });
    const response = await fetchf(url, { timeout: 5000 });

    expect(ifNoneMatchOf(1)).toBeNull();
    expect(response.status).toBe(200);
  });

  it('should not send the ETag when it is disabled', async () => {
    await fetchf(url, { cacheTime: 60 });
    await fetchf(url, { cacheTime: 60, cacheBuster, etag: false });

    expect(ifNoneMatchOf(1)).toBeNull();
  });

  it('should keep the If-None-Match header of the request', async () => {
    await fetchf(url, { cacheTime: 60 });

    const response = await fetchf(url, {
      cacheTime: 60,
      cacheBuster,
      headers: { 'If-None-Match': '"v0"' },
    });

    expect(ifNoneMatchOf(1)).toBe('"v0"');
    expect(response.status).toBe(200);
  });

  it('should leave 304 responses to requests with an If-None-Match header of their own', async () => {
    await fetchf(url, { cacheTime: 60 });

    const response = await fetchf(url, {
      cacheTime: 60,
      cacheBuster,
      headers: { 'If-None-Match': '"v1"' },
      strategy: 'softFail',
    });

    expect(response.status).toBe(304);
    expect(response.error!.status).toBe(304);
  });

  it('should only send the ETag with a custom fetcher when it is enabled', async () => {
    const fetcher = jest.fn((url, config) =>
      fetch(url, config),
    ) as unknown as CustomFetcher;

    const first = await fetchf(url, { cacheTime: 60, fetcher });
    await fetchf(url, { cacheTime: 60, fetcher, cacheBuster });

    expect(ifNoneMatchOf(1)).toBeNull();

    const second = await fetchf(url, {
      cacheTime: 60,
      fetcher,
      cacheBuster,
      etag: true,
    });

    expect(ifNoneMatchOf(2)).toBe('"v1"');
    expect(second).toBe(getCache(key)!.data);
    expect(second.data).toEqual(first.data);
  });

  it('should not revalidate data changed by mutate() with the ETag', async () => {
    await fetchf(url, { cacheTime: 60 });
    await mutate(key, [{ id: 3, title: 'Local change' }]);

    expect(getCache(key)!.data.headers).toEqual({
      'content-type': 'application/json',
    });

    const response = await fetchf(url, { cacheTime: 60, cacheBuster });

    expect(ifNoneMatchOf(1)).toBeNull();
    expect(response.data).toEqual([{ id: 1, title: 'Dune' }]);
  });
});
