import {
  buildConfig,
  deleteCache,
  fetchf,
  generateCacheKey,
  getCache,
  mutate,
  subscribe,
} from '../src';
import type { CacheEntry, CacheStore, StoredResponse } from '../src';
import { pruneCache, setCache } from '../src/cache-manager';
import { clearAllTimeouts } from '../src/timeout-wheel';

const url = 'https://api.example.com/books';
const key = generateCacheKey(buildConfig(url, {}));
const books = [{ id: 1, title: 'Dune' }];

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// The in-memory cache is gone after a page reload, while the store keeps its entries
const reload = () => {
  pruneCache();
  clearAllTimeouts();
};

const createStore = () => new Map<string, CacheEntry<StoredResponse>>();

describe('cacheStore', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async () => jsonResponse(books));
    global.fetch = fetchMock;
  });

  afterEach(() => {
    reload();
    jest.useRealTimers();
  });

  it('should save cached responses in the store', async () => {
    const store = createStore();

    await fetchf(url, { cacheTime: 60, staleTime: 30, cacheStore: store });

    const entry = store.get(key)!;

    expect(entry).toEqual({
      data: {
        data: books,
        status: 200,
        statusText: '',
        headers: { 'content-type': 'application/json' },
      },
      time: expect.any(Number),
      stale: entry.time + 30000,
      expiry: entry.time + 60000,
    });
  });

  it('should restore responses from the store, e.g. after a page reload', async () => {
    const store = createStore();
    const config = { cacheTime: 60, staleTime: 30, cacheStore: store };

    await fetchf(url, config);
    reload();

    const listener = jest.fn();
    const unsubscribe = subscribe(key, listener);
    const response = await fetchf(url, config);

    unsubscribe();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      data: books,
      error: null,
      status: 200,
      ok: true,
      isSuccess: true,
      isError: false,
      headers: { 'content-type': 'application/json' },
    });
    expect(response.config.cacheKey).toBe(key);
    await expect(response.json()).resolves.toEqual(books);
    expect(listener).toHaveBeenCalledWith(response);

    // From then on, the response is served from the in-memory cache
    await expect(fetchf(url, config)).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should not transform restored data again', async () => {
    const store = createStore();
    const config = {
      cacheTime: 60,
      cacheStore: store,
      select: (data: any) => data.map((book: any) => book.title),
    };

    const { data } = await fetchf(url, config);
    reload();

    expect(data).toEqual(['Dune']);
    await expect(fetchf(url, config)).resolves.toMatchObject({
      data: ['Dune'],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should support asynchronous stores', async () => {
    const entries = createStore();
    const store: CacheStore = {
      get: async (key) => entries.get(key),
      set: async (key, entry) => {
        entries.set(key, entry);
      },
      delete: async (key) => {
        entries.delete(key);
      },
    };

    await fetchf(url, { cacheTime: 60, cacheStore: store });
    reload();

    await expect(
      fetchf(url, { cacheTime: 60, cacheStore: store }),
    ).resolves.toMatchObject({ data: books });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should show a stale stored response until it is revalidated', async () => {
    const store = createStore();
    const config = { cacheTime: 60, staleTime: 30, cacheStore: store };
    const updatedBooks = [...books, { id: 2, title: 'Emma' }];

    await fetchf(url, config);
    store.get(key)!.stale = Date.now() - 1;
    reload();

    fetchMock.mockImplementation(async () => jsonResponse(updatedBooks));

    const updates: unknown[] = [];
    const unsubscribe = subscribe<{ data: unknown }>(key, ({ data }) =>
      updates.push(data),
    );
    const response = await fetchf(url, config);

    unsubscribe();

    expect(updates).toEqual([books, updatedBooks]);
    expect(response.data).toEqual(updatedBooks);
    expect(store.get(key)!.data.data).toEqual(updatedBooks);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should delete expired entries from the store and fetch again', async () => {
    const store = createStore();
    const deleteSpy = jest.spyOn(store, 'delete');

    await fetchf(url, { cacheTime: 60, cacheStore: store });
    store.get(key)!.expiry = Date.now() - 1;
    reload();

    await fetchf(url, { cacheTime: 60, cacheStore: store });

    expect(deleteSpy).toHaveBeenCalledWith(key);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.get(key)!.expiry).toBeGreaterThan(Date.now());
  });

  it('should expire restored responses at their original expiry time', async () => {
    jest.useFakeTimers();

    const store = createStore();

    await fetchf(url, { cacheTime: 60, cacheStore: store });
    jest.advanceTimersByTime(30000);
    reload();

    // Restored with 30 seconds left
    await fetchf(url, { cacheTime: 60, cacheStore: store });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(31000);

    await fetchf(url, { cacheTime: 60, cacheStore: store });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should keep restored responses without expiry', async () => {
    const store = createStore();

    await fetchf(url, { cacheTime: -1, cacheStore: store });
    reload();

    await fetchf(url, { cacheTime: -1, cacheStore: store });

    expect(store.get(key)!.expiry).toBeUndefined();
    expect(getCache(key)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a cache buster', { cacheBuster: () => true }],
    ["cache: 'reload'", { cache: 'reload' as const }],
  ])('should bypass the store with %s', async (_, bypass) => {
    const store = createStore();

    await fetchf(url, { cacheTime: 60, cacheStore: store });
    reload();

    const getSpy = jest.spyOn(store, 'get');

    await fetchf(url, { cacheTime: 60, cacheStore: store, ...bypass });

    expect(getSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should only cache error responses in memory', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ message: 'Server error' }, 500),
    );

    const store = createStore();
    const response = await fetchf(url, {
      cacheTime: 60,
      cacheErrors: true,
      cacheStore: store,
      strategy: 'softFail',
    });

    expect(response.error?.status).toBe(500);
    expect(getCache(key)).toBeTruthy();
    expect(store.size).toBe(0);
  });

  it('should update and delete stored entries with mutate() and deleteCache()', async () => {
    const store = createStore();

    await fetchf(url, { cacheTime: 60, cacheStore: store });

    await mutate(key, []);
    expect(store.get(key)!.data.data).toEqual([]);

    deleteCache(key);
    expect(store.has(key)).toBe(false);
  });

  it('should ignore errors of the store', async () => {
    const throwing: CacheStore = {
      get: () => {
        throw new Error('Store unavailable');
      },
      set: () => {
        throw new Error('Quota exceeded');
      },
      delete: () => Promise.reject(new Error('Store unavailable')),
    };

    await expect(
      fetchf(url, { cacheTime: 60, cacheStore: throwing }),
    ).resolves.toMatchObject({ data: books });

    deleteCache(key);
    reload();

    const rejecting: CacheStore = {
      get: () => Promise.reject(new Error('Store unavailable')),
      set: () => Promise.reject(new Error('Quota exceeded')),
      delete: () => undefined,
    };

    await expect(
      fetchf(url, { cacheTime: 60, cacheStore: rejecting }),
    ).resolves.toMatchObject({ data: books });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should ignore stored entries that are invalid', async () => {
    const store = createStore();

    store.set(key, { data: { data: 'Invalid', status: 0 }, time: Date.now() });

    await expect(
      fetchf(url, { cacheTime: 60, cacheStore: store }),
    ).resolves.toMatchObject({ data: books });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should ignore stored entries once the in-memory cache has one', async () => {
    let resolveGet: (entry: CacheEntry<StoredResponse>) => void = () => {};
    const store: CacheStore = {
      get: () => new Promise((resolve) => (resolveGet = resolve)),
      set: () => undefined,
      delete: () => undefined,
    };

    const promise = fetchf(url, { cacheTime: 60, cacheStore: store });

    // Another request caches a response while the store is being read
    setCache(key, { data: 'Newer' }, 60);
    resolveGet({ data: { data: 'Older' }, time: Date.now() });

    await expect(promise).resolves.toMatchObject({ data: books });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
