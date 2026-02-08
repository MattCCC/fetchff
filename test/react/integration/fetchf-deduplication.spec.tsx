/**
 * @jest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom';
import { act, render, screen, waitFor, cleanup } from '@testing-library/react';
import { fetchf } from '../../../src/index';
import { useFetcher } from '../../../src/react/index';
import { clearAllTimeouts } from '../../../src/timeout-wheel';

describe('fetchf deduplication and parking with jsdom and onRequest', () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    clearAllTimeouts();
    delete (window as any).__dedupeTriggered;
  });

  it('deduplicates and parks requests when onRequest triggers a second identical fetchf call', async () => {
    const testUrl = '/api/onrequest-dedupe';
    const cacheKey = 'onrequest-dedupe-key';
    let resolveFetch: ((value: Response) => void) | undefined;
    let fetchCallCount = 0;

    // Mock global.fetch to simulate slow network
    global.fetch = jest.fn().mockImplementation(() => {
      fetchCallCount++;
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    });

    // Track results from both calls
    let onRequestResult: any = undefined;

    // Set up onRequest interceptor that triggers a second fetchf call
    const onRequest = async (config: any) => {
      if (!onRequestResult) {
        // Trigger a second fetchf with the same cacheKey while the first is in-flight
        onRequestResult = fetchf(testUrl, {
          cacheKey,
          dedupeTime: 2000,
        });
      }
      return config;
    };

    // Start first request with onRequest interceptor
    const promise1 = fetchf(testUrl, {
      cacheKey,
      dedupeTime: 2000,
      onRequest,
    });

    expect(promise1).not.toBeUndefined();

    // Allow microtasks to flush so onRequest fires and the first doRequestOnce calls fetch()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // onRequest triggered a second fetchf that was deduped
    expect(onRequestResult).not.toBeUndefined();
    expect(promise1).not.toBe(onRequestResult); // Different promise objects, but parked

    // Only one actual fetch call should have been made (the second was deduped)
    expect(fetchCallCount).toBe(1);

    // Resolve the fetch with a proper mock response
    await act(async () => {
      if (resolveFetch) {
        resolveFetch({
          ok: true,
          status: 200,
          data: { result: 'deduped-onrequest' },
          body: JSON.stringify({ result: 'deduped-onrequest' }),
          headers: { 'content-type': 'application/json' },
        } as unknown as Response);
      }
    });

    // Both promises should resolve to the same result
    const [result1, result2] = await Promise.all([promise1, onRequestResult]);
    expect(result1.data).toEqual({ result: 'deduped-onrequest' });
    expect(result2.data).toEqual({ result: 'deduped-onrequest' });
    expect(fetchCallCount).toBe(1);
  });

  it('useFetcher deduplication: onRequest triggers fetchf with same cacheKey, other useFetcher waits for it', async () => {
    const testUrl = '/api/component-dedupe';
    const cacheKey = 'component-dedupe-key';
    let resolveFetch: ((value: Response) => void) | undefined;
    let fetchCallCount = 0;

    // Mock global.fetch to simulate slow network
    global.fetch = jest.fn().mockImplementation(() => {
      fetchCallCount++;
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    });

    // React test component that triggers the fetch
    function DedupeComponent() {
      const { data, isLoading } = useFetcher(testUrl, {
        cacheKey,
        dedupeTime: 2000,
        immediate: true,
        onRequest: async (config: any) => {
          // Only trigger once to avoid infinite loop
          if (!(window as any).__dedupeTriggered) {
            (window as any).__dedupeTriggered = true;
            // This fetchf call uses the same cacheKey and should be deduped
            fetchf(testUrl, { cacheKey, dedupeTime: 2000 });
          }
          return config;
        },
      });
      return (
        <div>
          <div data-testid="data">
            {data ? JSON.stringify(data) : 'No Data'}
          </div>
          <div data-testid="loading">
            {isLoading ? 'Loading' : 'Not Loading'}
          </div>
        </div>
      );
    }

    // Another useFetcher instance that relies on the same cacheKey
    function WaitingComponent() {
      const { data, isLoading } = useFetcher(testUrl, {
        cacheKey,
        dedupeTime: 2000,
        immediate: true,
      });
      return (
        <div>
          <div data-testid="waiting-data">
            {data ? JSON.stringify(data) : 'No Data'}
          </div>
          <div data-testid="waiting-loading">
            {isLoading ? 'Loading' : 'Not Loading'}
          </div>
        </div>
      );
    }

    // Render both components
    render(
      <>
        <DedupeComponent />
        <WaitingComponent />
      </>,
    );

    // Both should be loading initially
    expect(screen.getByTestId('loading').textContent).toBe('Loading');
    expect(screen.getByTestId('waiting-loading').textContent).toBe('Loading');

    // Allow microtasks to flush so the fetch is actually called
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(fetchCallCount).toBe(1);

    // Resolve the fetch with a proper mock response
    await act(async () => {
      if (resolveFetch) {
        resolveFetch({
          ok: true,
          status: 200,
          data: { result: 'deduped-component' },
          body: JSON.stringify({ result: 'deduped-component' }),
          headers: { 'content-type': 'application/json' },
        } as unknown as Response);
      }
    });

    // Both should show the result and not loading
    await waitFor(() => {
      expect(screen.getByTestId('data').textContent).toContain(
        'deduped-component',
      );
      expect(screen.getByTestId('loading').textContent).toBe('Not Loading');
      expect(screen.getByTestId('waiting-data').textContent).toContain(
        'deduped-component',
      );
      expect(screen.getByTestId('waiting-loading').textContent).toBe(
        'Not Loading',
      );
    });

    // Only one network request should have been made
    expect(fetchCallCount).toBe(1);
  });
});
