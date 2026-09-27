/**
 * @jest-environment jsdom
 */
import { fetchf } from '../src';

describe('Polling in browsers', () => {
  let visibilityState: DocumentVisibilityState = 'visible';
  let onLine = true;

  beforeAll(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => onLine,
    });
  });

  afterAll(() => {
    // Removing the overrides restores the getters of the prototypes
    delete (document as { visibilityState?: unknown }).visibilityState;
    delete (navigator as { onLine?: unknown }).onLine;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    visibilityState = 'visible';
    onLine = true;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const poll = (fetcher: jest.Mock) =>
    fetchf('/status', {
      pollingInterval: 1000,
      maxPollingAttempts: 3,
      timeout: 0,
      fetcher,
    });

  it('should pause polling while the tab is hidden', async () => {
    const fetcher = jest.fn(async () => ({ data: 'ok' }));
    const promise = poll(fetcher);

    await jest.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);

    visibilityState = 'hidden';
    await jest.advanceTimersByTimeAsync(10000);
    expect(fetcher).toHaveBeenCalledTimes(2);

    visibilityState = 'visible';
    await jest.advanceTimersByTimeAsync(1000);

    await promise;
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('should pause polling while the browser is offline', async () => {
    const fetcher = jest.fn(async () => ({ data: 'ok' }));
    const promise = poll(fetcher);

    onLine = false;
    await jest.advanceTimersByTimeAsync(10000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    onLine = true;
    await jest.advanceTimersByTimeAsync(2000);

    await promise;
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
