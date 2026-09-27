import {
  fetchf,
  removeRevalidators,
  revalidateAll,
  setEventProvider,
} from '../src';
import { pruneCache } from '../src/cache-manager';
import { clearAllTimeouts } from '../src/timeout-wheel';

const url = 'https://api.example.com/books';

describe('focusThrottleInterval', () => {
  let fetchMock: jest.SpyInstance;
  let focus: () => void;
  let reconnect: () => void;

  // Lets the revalidations that were triggered send their requests
  const flush = () => jest.advanceTimersByTimeAsync(0);

  beforeAll(() => {
    setEventProvider('focus', (handler) => {
      focus = handler;

      return () => {};
    });
    setEventProvider('online', (handler) => {
      reconnect = handler;

      return () => {};
    });
  });

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('[]'));
  });

  afterEach(() => {
    removeRevalidators('focus');
    removeRevalidators('online');
    jest.restoreAllMocks();
    pruneCache();
    clearAllTimeouts();
    jest.useRealTimers();
  });

  it('should not revalidate on focus within 5 seconds after the request by default', async () => {
    await fetchf(url, { refetchOnFocus: true });

    await jest.advanceTimersByTimeAsync(4999);
    focus();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    focus();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The revalidation starts the next interval
    focus();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should use the focusThrottleInterval of the request', async () => {
    await fetchf(url, { refetchOnFocus: true, focusThrottleInterval: 10000 });

    await jest.advanceTimersByTimeAsync(9999);
    focus();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    focus();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should revalidate on every focus with 0', async () => {
    await fetchf(url, { refetchOnFocus: true, focusThrottleInterval: 0 });

    focus();
    await flush();
    focus();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should not throttle revalidateAll() calls', async () => {
    await fetchf(url, { refetchOnFocus: true });

    revalidateAll('focus');
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should not throttle revalidations on reconnect', async () => {
    await fetchf(url, { refetchOnReconnect: true });

    reconnect();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
