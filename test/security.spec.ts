/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Adversarial tests: hostile configs, URLs, headers and server responses.
 */
let lib: typeof import('../src/index') &
  typeof import('../src/cache-manager') &
  typeof import('../src/timeout-wheel');

const JSON_HEADERS = { 'content-type': 'application/json' };
const sentRequests: Array<{ url: string; headers: Headers }> = [];

// Global defaults and cache are module state, so each test gets fresh modules
beforeEach(async () => {
  await jest.isolateModulesAsync(async () => {
    lib = {
      ...(await import('../src/index')),
      ...(await import('../src/cache-manager')),
      ...(await import('../src/timeout-wheel')),
    } as typeof lib;
  });

  sentRequests.length = 0;
  global.fetch = jest.fn(async (url: string, init: any) => {
    sentRequests.push({ url, headers: new Headers(init.headers) });

    return new Response('{}', { headers: JSON_HEADERS });
  }) as any;
});

afterEach(() => {
  lib.clearAllTimeouts();
  jest.useRealTimers();
});

describe('Prototype pollution', () => {
  const hostile = () =>
    JSON.parse(
      '{"__proto__": {"polluted": "yes"}, "constructor": {"prototype": {"polluted": "yes"}}, "x": "1"}',
    );

  afterEach(() => {
    expect(({} as any).polluted).toBeUndefined();
    expect((Object.prototype as any).polluted).toBeUndefined();
  });

  it('should ignore __proto__ in request config', () => {
    const config = lib.buildConfig('https://api.test/a', hostile());

    expect((config as any).polluted).toBeUndefined();
  });

  it('should ignore __proto__ in headers', () => {
    const config = lib.buildConfig('https://api.test/a', {
      headers: hostile(),
    });

    expect((config.headers as any).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(config.headers)).toBe(Object.prototype);
  });

  it('should ignore __proto__ in global defaults', () => {
    lib.setDefaultConfig(hostile());
    lib.setDefaultConfig({ headers: hostile(), retry: hostile() });

    const defaults = lib.getDefaultConfig() as any;

    expect(defaults.polluted).toBeUndefined();
    expect(defaults.headers.polluted).toBeUndefined();
  });

  it('should not pollute prototypes through query params', () => {
    const config = lib.buildConfig('https://api.test/a', {
      params: hostile(),
    });

    expect(config.url).toContain('x=1');
  });

  it('should not pollute prototypes through JSON responses', async () => {
    global.fetch = jest.fn(
      async () =>
        new Response('{"__proto__": {"polluted": "yes"}, "data": {"a": 1}}', {
          headers: JSON_HEADERS,
        }),
    ) as any;

    const { data } = await lib.fetchf<any>('https://api.test/a', {
      flattenResponse: true,
    });

    expect(data).toEqual({ a: 1 });
  });

  it('should ignore __proto__ when mutating cached data', async () => {
    lib.setCache('key', { data: null }, 60);

    await lib.mutate('key', hostile());

    expect((lib.getCache('key')?.data.data as any).polluted).toBeUndefined();
  });
});

describe('Credential leaks through the API handler', () => {
  const createApi = () =>
    lib.createApiFetcher({
      baseURL: 'https://api.test',
      headers: { Authorization: 'Bearer secret' },
      endpoints: { me: { url: '/me' } },
    });

  it.each([
    ['//evil.test/steal'],
    ['/\\evil.test/steal'],
    ['\\\\evil.test/steal'],
    ['\\/evil.test/steal'],
    [' //evil.test/steal'],
    ['\t//evil.test/steal'],
    ['/\t/evil.test/steal'],
  ])('should block protocol-relative URL %j', async (url) => {
    await expect(createApi().request(url)).rejects.toThrow(
      'Protocol-relative URLs not allowed.',
    );
    expect(sentRequests).toHaveLength(0);
  });

  it.each([
    ['https://evil.test/steal'],
    ['HTTPS://evil.test/steal'],
    ['http:\\\\evil.test/steal'],
    ['http:evil.test/steal'],
    [' https://evil.test/steal'],
    ['\nhttps://evil.test/steal'],
    ['ht\ttps://evil.test/steal'],
  ])('should not send global headers to external URL %j', async (url) => {
    await createApi()
      .request(url)
      .catch(() => null);

    for (const { headers } of sentRequests) {
      expect(headers.get('authorization')).toBeNull();
    }
  });

  it('should still send global headers to configured endpoints', async () => {
    await createApi().me();

    expect(sentRequests[0].headers.get('authorization')).toBe('Bearer secret');
  });

  it('should not leak headers set by an interceptor of one instance into other requests', async () => {
    const api = lib.createApiFetcher({
      baseURL: 'https://api.test',
      endpoints: { me: { url: '/me' } },
      onRequest(config) {
        (config.headers as Record<string, string>).Authorization =
          'Bearer secret';
      },
    });

    await api.me();
    await lib.fetchf('https://evil.test/steal');

    expect(sentRequests[0].headers.get('authorization')).toBe('Bearer secret');
    expect(sentRequests[1].headers.get('authorization')).toBeNull();
  });
});

describe('URL injection', () => {
  it('should not let path params inject a query, fragment or path segments', () => {
    const { url } = lib.buildConfig('https://api.test/users/:id/posts', {
      urlPathParams: { id: '1?admin=true#x/../../admin' },
    });

    expect(new URL(url as string).pathname).toBe(
      '/users/1%3Fadmin%3Dtrue%23x%2F..%2F..%2Fadmin/posts',
    );
    expect(new URL(url as string).search).toBe('');
  });

  it.each([['.'], ['..']])(
    'should reject %j as a path param, as it would move the request to another path',
    async (id) => {
      expect(() =>
        lib.buildConfig('https://api.test/orgs/:id/delete', {
          urlPathParams: { id },
        }),
      ).toThrow('Path params "." and ".." not allowed.');

      await expect(
        lib.fetchf('https://api.test/orgs/:id/delete', {
          urlPathParams: { id },
          strategy: 'softFail',
        }),
      ).rejects.toThrow('Path params "." and ".." not allowed.');
      expect(sentRequests).toHaveLength(0);
    },
  );

  it.each([['...'], ['..foo'], ['../admin'], ['%2e%2e']])(
    'should keep the harmless path param %j in its segment',
    (id) => {
      const { url } = lib.buildConfig('https://api.test/orgs/:id/delete', {
        urlPathParams: { id },
      });

      expect(new URL(url as string).pathname).toBe(
        '/orgs/' + encodeURIComponent(id) + '/delete',
      );
    },
  );

  it('should not let query params inject extra params', () => {
    const { url } = lib.buildConfig('https://api.test/search', {
      params: { q: 'a&admin=true', 'x&role': 'admin' },
    });
    const params = new URL(url as string).searchParams;

    expect(params.get('q')).toBe('a&admin=true');
    expect(params.get('x&role')).toBe('admin');
    expect(params.has('admin')).toBe(false);
    expect(params.has('role')).toBe(false);
  });
});

describe('Logging', () => {
  it('should not log credential headers or the request body', async () => {
    global.fetch = jest.fn(
      async () => new Response('{}', { status: 500 }),
    ) as any;
    const warn = jest.fn();

    const { error } = await lib.fetchf('https://api.test/login', {
      method: 'POST',
      body: { user: 'a', password: 'hunter2' },
      headers: {
        Authorization: 'Bearer secret',
        Cookie: 'session=secret',
        'X-Trace-Id': 'abc',
      },
      strategy: 'softFail',
      logger: { warn },
    });
    const logged = warn.mock.calls[0][1];

    expect(logged.message).toBe(
      'POST to https://api.test/login failed! Status: 500',
    );
    expect(logged.status).toBe(500);
    expect(logged.config.headers).toMatchObject({
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
      'x-trace-id': 'abc',
    });
    expect(logged.config.body).toBeUndefined();
    expect(logged.config.data).toBeUndefined();
    expect(JSON.stringify(logged)).not.toMatch(/secret|hunter2/);

    // The error returned to the caller is untouched
    expect((error?.config.headers as any).Authorization).toBe('Bearer secret');
  });
});

describe('Hostile servers', () => {
  it.each([['600'], ['999999999']])(
    'should wait for maxDelay, not Retry-After: %s',
    async (retryAfter) => {
      jest.useFakeTimers();
      global.fetch = jest.fn(
        async () =>
          new Response('{}', {
            status: 429,
            headers: { ...JSON_HEADERS, 'retry-after': retryAfter },
          }),
      ) as any;

      const request = lib.fetchf('https://api.test/a', {
        strategy: 'softFail',
        retry: { retries: 1, delay: 10, maxDelay: 1000 },
      });

      // Neither an endless wait nor an immediate retry from a timer overflow
      await jest.advanceTimersByTimeAsync(999);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      await request;
      expect(global.fetch).toHaveBeenCalledTimes(2);
    },
  );

  it('should not break on responses that claim JSON but are not', async () => {
    global.fetch = jest.fn(
      async () => new Response('<html>', { headers: JSON_HEADERS }),
    ) as any;

    const { data, error } = await lib.fetchf('https://api.test/a');

    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

describe('Cache poisoning', () => {
  it('should not let control characters or separators forge another cache key', () => {
    const key = (url: string) => lib.generateCacheKey({ url });
    const legit = key('https://api.test/a');

    expect(key('https://api.test/a\n')).not.toBe(legit);
    expect(key('https://api.test/a\u0000')).not.toBe(legit);
    expect(key('https://api.test/ a')).not.toBe(legit);
    // eslint-disable-next-line no-control-regex -- checking for control characters
    expect(key('https://api.test/a')).not.toMatch(/[\s\u0000-\u001f]/);
  });

  it('should keep bodies apart even when crafted to look alike', () => {
    const key = (body: string) =>
      lib.generateCacheKey({ url: '/a', method: 'POST', body });

    expect(key('{"role":"user"}')).not.toBe(key('{"role":"user "}'));
    expect(key('{"a":"1","b":"2"}')).not.toBe(key('{"a":"1,b:2"}'));
  });
});

describe('Resource exhaustion guards', () => {
  it('should stop serializing deeply nested params', () => {
    let nested: any = 'bottom';

    for (let i = 0; i < 10000; i++) {
      nested = { a: nested };
    }

    expect(() =>
      lib.buildConfig('https://api.test/a', { params: nested }),
    ).not.toThrow();
  });

  it('should stop flattening deeply nested data', async () => {
    const depth = 5000;
    const nested = '{"data":'.repeat(depth) + '1' + '}'.repeat(depth);

    global.fetch = jest.fn(
      async () => new Response(nested, { headers: JSON_HEADERS }),
    ) as any;

    await expect(
      lib.fetchf('https://api.test/a', { flattenResponse: true }),
    ).resolves.toBeDefined();
  });
});
