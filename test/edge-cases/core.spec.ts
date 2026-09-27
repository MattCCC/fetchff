/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Edge cases of the core modules: unusual inputs, defaults and fallbacks.
 */
import { fetchf, createApiFetcher } from '../../src';
import {
  getCache,
  handleResponseCache,
  mutate,
  pruneCache,
  setCache,
} from '../../src/cache-manager';
import {
  abortRequest,
  getInFlightPromise,
  markInFlight,
  setInFlightPromise,
} from '../../src/inflight-manager';
import { applyInterceptors } from '../../src/interceptor-manager';
import { parseResponseData } from '../../src/response-parser';
import {
  getRetryAfterMs,
  getShouldStopRetrying,
  withRetry,
} from '../../src/retry-handler';
import {
  addRevalidator,
  removeRevalidator,
  revalidateAll,
  startRevalidatorCleanup,
} from '../../src/revalidator-manager';
import { clearAllTimeouts } from '../../src/timeout-wheel';
import {
  appendQueryParams,
  isJSONSerializable,
  isSlowConnection,
  replaceUrlPathParams,
} from '../../src/utils';
import { FetchError } from '../../src/errors/fetch-error';
import { NetworkError } from '../../src/errors/network-error';
import { buildConfig } from '../../src/config-handler';

const JSON_HEADERS = { 'content-type': 'application/json' };
const url = 'https://api.test/resource';

beforeEach(() => {
  global.fetch = jest.fn(
    async () => new Response('{"value":1}', { headers: JSON_HEADERS }),
  ) as any;
});

afterEach(() => {
  pruneCache();
  clearAllTimeouts();
});

describe('fetchf()', () => {
  it('should return a cached response for a string cacheKey without sending a request', async () => {
    setCache('my-key', { data: 'cached' }, 60);

    const response = await fetchf(url, { cacheKey: 'my-key', cacheTime: 60 });

    expect(response.data).toBe('cached');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['dedupeTime', { dedupeTime: 1000 }],
    ['cacheTime', { cacheTime: 60 }],
    ['cancellable', { cancellable: true }],
    ['refetchOnFocus', { refetchOnFocus: true }],
    ['refetchOnReconnect', { refetchOnReconnect: true }],
  ])(
    'should generate a cache key for %s even without a timeout',
    async (_, options) => {
      const { config } = await fetchf(url, { timeout: 0, ...options });

      expect(config.cacheKey).toEqual(expect.any(String));
    },
  );

  it('should not generate a cache key when no feature needs one', async () => {
    const { config, data } = await fetchf(url, { timeout: 0 });

    expect(config.cacheKey).toBeNull();
    expect(data).toEqual({ value: 1 });
  });

  it('should work without retry settings', async () => {
    const { data } = await fetchf(url, { retry: null as any });

    expect(data).toEqual({ value: 1 });
  });

  it('should parse native responses with a custom parser', async () => {
    const { data } = await fetchf(url, {
      parser: async (response: Response) => (await response.text()).length,
    });

    expect(data).toBe(11);
  });

  it('should not wrap custom fetcher results that are already responses', async () => {
    const { data, ok } = await fetchf<any>(url, {
      fetcher: async () =>
        ({ data: { value: 2 }, body: '{"value":2}', ok: true }) as any,
    });

    expect(data).toEqual({ value: 2 });
    expect(ok).toBe(true);
  });

  it('should return primitive custom fetcher results as they are', async () => {
    const response = await fetchf(url, { fetcher: async () => 'raw' as any });

    expect(response).toBe('raw');
  });
});

describe('Response methods', () => {
  const respond = (body: BodyInit, contentType: string) => {
    global.fetch = jest.fn(
      async () =>
        new Response(body, { headers: { 'content-type': contentType } }),
    ) as any;
  };

  it('should expose JSON data through the response methods', async () => {
    const response = await fetchf(url);

    await expect(response.json()).resolves.toEqual({ value: 1 });
    await expect(response.text()).resolves.toEqual({ value: 1 });
    expect(await (await response.blob()).size).toBe(0);
    expect((await response.arrayBuffer()).byteLength).toBe(0);
    expect(await response.bytes()).toEqual(new Uint8Array(0));
    expect([...(await response.formData()).keys()]).toEqual([]);
  });

  it('should expose binary data through the response methods', async () => {
    respond(new Uint8Array([1, 2, 3]), 'application/octet-stream');

    const response = await fetchf(url);

    expect((await response.arrayBuffer()).byteLength).toBe(3);
    expect(await response.bytes()).toEqual(new Uint8Array([1, 2, 3]));
    expect((await response.blob()).size).toBe(3);
  });

  it('should expose form data through formData()', async () => {
    const form = new FormData();
    form.append('a', '1');
    const encoded = new Response(form);

    respond(
      await encoded.arrayBuffer(),
      encoded.headers.get('content-type') as string,
    );

    const response = await fetchf(url);

    expect((await response.formData()).get('a')).toBe('1');
  });

  it('should clone into an equivalent response, as the body was already read', async () => {
    const response = await fetchf(url);
    const clone = response.clone();

    expect(clone).not.toBe(response);
    expect(clone.data).toEqual(response.data);
    expect(clone.status).toBe(200);
    await expect(clone.json()).resolves.toEqual({ value: 1 });
  });
});

describe('parseResponseData()', () => {
  it('should read responses without headers as text', async () => {
    const data = await parseResponseData({
      text: async () => 'plain',
    } as any);

    expect(data).toBe('plain');
  });

  it('should keep non-string text results as they are', async () => {
    const data = await parseResponseData({
      headers: new Headers(),
      text: async () => 42,
    } as any);

    expect(data).toBe(42);
  });
});

describe('Cache manager', () => {
  it('should mutate cached data with primitive values', async () => {
    setCache('key', { data: { a: 1 } }, 60);

    await mutate('key', 'replaced');

    expect(getCache('key')?.data.data).toBe('replaced');
  });

  it('should ignore responses of requests without a cache key', () => {
    expect(() =>
      handleResponseCache({ data: 1 } as any, {} as any),
    ).not.toThrow();
  });
});

describe('In-flight manager', () => {
  it('should create a standalone controller for requests without a key', () => {
    const controller = markInFlight(null, url, 1000, 0, false, true);

    expect(controller).toBeInstanceOf(AbortController);
    expect(controller.signal.aborted).toBe(false);
  });

  it('should ignore aborting requests without a key', async () => {
    await expect(abortRequest(null)).resolves.toBeUndefined();
  });

  it('should ignore promises for requests that are not in flight', () => {
    setInFlightPromise('unknown', Promise.resolve());

    expect(getInFlightPromise('unknown', 1000)).toBeNull();
  });

  it('should not return promises for requests without a key', () => {
    expect(getInFlightPromise(null, 1000)).toBeNull();
  });
});

describe('Interceptors', () => {
  it('should ignore interceptors that are neither functions nor arrays', async () => {
    const data = { a: 1 };

    await applyInterceptors({} as any, data);

    expect(data).toEqual({ a: 1 });
  });
});

describe('Retry handler', () => {
  const ok = { data: 1, error: null, config: {} } as any;
  const failure = (status: number, headers = {}) =>
    ({ data: null, error: { status }, headers, config: {} }) as any;

  it('should ignore a non-numeric ratelimit-reset-after header', () => {
    expect(
      getRetryAfterMs({ headers: { 'ratelimit-reset-after': 'soon' } } as any),
    ).toBeNull();
  });

  it('should make a single attempt with default settings', async () => {
    const request = jest.fn(async () => failure(500));

    await withRetry(request, {});

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('should treat negative retries as no retries', async () => {
    const request = jest.fn(async () => failure(500));

    await withRetry(request, { retries: -1, retryOn: [500] });

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('should stop when shouldRetry declines a successful response', async () => {
    const request = jest.fn(async () => ok);

    await withRetry(request, { retries: 2, shouldRetry: () => false });

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('should retry successful responses without backoff or maxDelay', async () => {
    const request = jest.fn(async () => ok);

    await withRetry(request, {
      retries: 1,
      delay: 0,
      backoff: 0,
      maxDelay: 0,
      shouldRetry: () => true,
    });

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('should retry errors without backoff or maxDelay', async () => {
    const request = jest.fn(async () => failure(429, { 'retry-after': '0' }));

    await withRetry(request, {
      retries: 1,
      delay: 0,
      backoff: 0,
      maxDelay: 0,
      retryOn: [429],
    });

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('should stop retrying by default when there is no error status', async () => {
    await expect(getShouldStopRetrying(ok, 0, 1)).resolves.toBe(true);
    await expect(
      getShouldStopRetrying(ok, 0, 1, null, null as any),
    ).resolves.toBe(true);
  });
});

describe('Revalidator manager', () => {
  afterEach(() => {
    removeRevalidator('focus-key');
  });

  it('should use the background revalidator for focus events by default', () => {
    const main = jest.fn(async () => null);
    const background = jest.fn(async () => null);

    addRevalidator('focus-key', main, undefined, undefined, background, true);
    revalidateAll('focus');

    expect(background).toHaveBeenCalledWith(true);
    expect(main).not.toHaveBeenCalled();
  });

  it('should use the main revalidator for non-stale revalidations', () => {
    const main = jest.fn(async () => null);

    addRevalidator('focus-key', main, undefined, undefined, undefined, true);
    revalidateAll('focus', false);

    expect(main).toHaveBeenCalledWith(false);
  });

  it('should skip entries without a background revalidator', () => {
    const main = jest.fn(async () => null);

    addRevalidator('focus-key', main, undefined, undefined, undefined, true);

    expect(() => revalidateAll('focus')).not.toThrow();
    expect(main).not.toHaveBeenCalled();
  });

  it('should not listen to window events outside of browsers', () => {
    expect(typeof window).toBe('undefined');
    expect(() =>
      addRevalidator(
        'focus-key',
        jest.fn(async () => null),
        undefined,
        undefined,
        undefined,
        true,
        true,
      ),
    ).not.toThrow();
  });

  it('should run the cleanup with the default interval', () => {
    jest.useFakeTimers();
    const stop = startRevalidatorCleanup();

    expect(typeof stop).toBe('function');
    stop();
    jest.useRealTimers();
  });
});

describe('Config handler', () => {
  it('should not set a Content-Type for bodies of unknown types', () => {
    const { headers } = buildConfig(url, {
      method: 'POST',
      body: new Date() as any,
    });

    expect(new Headers(headers).has('Content-Type')).toBe(false);
  });

  it('should use longer default timeouts on slow connections', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

    Object.defineProperty(globalThis, 'navigator', {
      value: { connection: { effectiveType: '2g' } },
      configurable: true,
    });

    try {
      await jest.isolateModulesAsync(async () => {
        const { defaultConfig } = await import('../../src/config-handler');

        expect(defaultConfig.timeout).toBe(60000);
        expect(defaultConfig.retry?.delay).toBe(2000);
      });
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'navigator', descriptor);
      } else {
        delete (globalThis as any).navigator;
      }
    }
  });
});

describe('Utils', () => {
  it('should call function values of query params', () => {
    expect(appendQueryParams('/a', { x: () => 'computed' })).toBe(
      '/a?x=computed',
    );
  });

  it('should send null and undefined query params as empty values', () => {
    expect(appendQueryParams('/a', { x: null, y: undefined })).toBe('/a?x=&y=');
  });

  it('should index arrays of objects and skip indexes for other values', () => {
    expect(
      decodeURIComponent(
        appendQueryParams('/a', { list: [{ b: 1 }, null, 'c'] }),
      ),
    ).toBe('/a?list[0][b]=1&list[]=&list[]=c');
  });

  it('should keep placeholders of null or undefined path params', () => {
    expect(
      replaceUrlPathParams('/users/:id/:tab', { id: null, tab: undefined }),
    ).toBe('/users/:id/:tab');
  });

  it('should treat objects with toJSON as JSON serializable', () => {
    class Money {
      toJSON() {
        return '1.00';
      }
    }

    expect(isJSONSerializable(new Money())).toBe(true);
  });

  it.each([
    ['2g', true],
    ['slow-2g', true],
    ['3g', true],
    ['4g', false],
  ])('should detect %s connections as slow: %p', (effectiveType, slow) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

    Object.defineProperty(globalThis, 'navigator', {
      value: { connection: { effectiveType } },
      configurable: true,
    });

    try {
      expect(isSlowConnection()).toBe(slow);
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'navigator', descriptor);
      } else {
        delete (globalThis as any).navigator;
      }
    }
  });
});

describe('Errors', () => {
  it('should default the status of errors without a response', () => {
    const error = new FetchError('failed', { url } as any, null);

    expect(error.status).toBe(0);
    expect(error.statusText).toBe('');
  });

  it('should create network errors', () => {
    const error = new NetworkError('offline', { url } as any);

    expect(error.name).toBe('NetworkError');
    expect(error.status).toBe(0);
    expect(error.response).toBeNull();
  });
});

describe('API handler', () => {
  it('should merge the endpoint config, but not the global config, for absolute endpoint URLs', async () => {
    const sent: Headers[] = [];
    global.fetch = jest.fn(async (_url: string, init: any) => {
      sent.push(new Headers(init.headers));
      return new Response('{}');
    }) as any;

    const api = createApiFetcher({
      baseURL: 'https://api.test',
      headers: { Authorization: 'Bearer secret' },
      endpoints: {
        external: { url: 'https://other.test/x', headers: { 'X-E': '1' } },
      },
    });

    await api.external();

    expect(sent[0].get('x-e')).toBe('1');
    expect(sent[0].get('authorization')).toBeNull();
  });
});
