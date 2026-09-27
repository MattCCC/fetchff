import { buildConfig, fetchf, generateCacheKey, getCache } from '../src';
import { pruneCache } from '../src/cache-manager';
import { clearAllTimeouts } from '../src/timeout-wheel';

const url = 'https://api.example.com/books';
const key = generateCacheKey(buildConfig(url, {}));
const initialData = [{ id: 1, title: 'Dune' }];
const books = [{ id: 2, title: 'Emma' }];

describe('initialData', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify(books), {
          headers: { 'Content-Type': 'application/json' },
        }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    pruneCache();
    clearAllTimeouts();
    jest.useRealTimers();
  });

  it('should cache the initial data as the response instead of sending the request', async () => {
    const response = await fetchf(url, { initialData, cacheTime: 60 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      data: initialData,
      status: 200,
      ok: true,
      error: null,
      isSuccess: true,
    });
    expect(getCache(key)!.data).toBe(response);

    // Later requests get it from the cache
    await expect(fetchf(url, { cacheTime: 60 })).resolves.toBe(response);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should revalidate the initial data once it is stale', async () => {
    await fetchf(url, { initialData, cacheTime: 60, staleTime: 1 });

    await jest.advanceTimersByTimeAsync(1000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCache(key)!.data.data).toEqual(books);
  });

  it('should not transform the initial data', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const select = jest.fn((): any => []);
    const { data } = await fetchf(url, {
      initialData,
      cacheTime: 60,
      select,
      flattenResponse: true,
    });

    expect(data).toBe(initialData);
    expect(select).not.toHaveBeenCalled();
  });

  it('should send the request when the cache is not used', async () => {
    const { data } = await fetchf(url, { initialData });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(data).toEqual(books);
  });

  it('should keep a cached response', async () => {
    await fetchf(url, { cacheTime: 60 });
    const { data } = await fetchf(url, { initialData, cacheTime: 60 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(data).toEqual(books);
  });

  it('should send the request when the cache is bypassed', async () => {
    const { data } = await fetchf(url, {
      initialData,
      cacheTime: 60,
      cacheBuster: () => true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(data).toEqual(books);
  });
});
