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

describe('Credential containment (property test)', () => {
  // Deterministic PRNG, so that failures are reproducible
  const random = (() => {
    let seed = 1234567;

    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const tokens = [
    '',
    '/',
    '//',
    '\\',
    '\\\\',
    '.',
    '..',
    '@',
    ':',
    '-',
    '_',
    'x',
    '8080',
    'http:',
    'https:',
    'HTTPS:',
    'javascript:',
    'evil.test',
    'api.test',
    '?',
    '#',
    '%2F',
    '%5C',
    '%2E',
    ' ',
    '\t',
    '\n',
    '\u0000',
  ];
  const randomUrl = () =>
    Array.from(
      { length: 1 + Math.floor(random() * 6) },
      () => tokens[Math.floor(random() * tokens.length)],
    ).join('');

  it.each([
    ['https://api.test'],
    ['https://api.test/'],
    ['https://api.test/v1'],
  ])(
    'should only send global headers to the API host with baseURL %s',
    async (baseURL) => {
      const api = lib.createApiFetcher({
        baseURL,
        headers: { Authorization: 'Bearer secret' },
        endpoints: {},
      });

      for (let i = 0; i < 500; i++) {
        const url = randomUrl();

        sentRequests.length = 0;
        await api.request(url).catch(() => null);

        for (const { url: sentUrl, headers } of sentRequests) {
          if (!headers.get('authorization')) {
            continue;
          }

          let host: string | undefined;

          try {
            host = new URL(sentUrl, 'https://app.test').host;
          } catch {
            // An invalid URL can't be requested
            continue;
          }

          if (host !== 'api.test') {
            throw new Error(
              JSON.stringify(url) + ' sent credentials to ' + host,
            );
          }
        }
      }
    },
  );

  it.each([
    ['.evil.test/steal'],
    ['-evil.test/steal'],
    ['@evil.test/steal'],
    ['x.evil.test/steal'],
  ])(
    'should join %j as a path of the baseURL, not as part of its host',
    (url) => {
      const config = lib.buildConfig(url, { baseURL: 'https://api.test' });

      expect(new URL(config.url as string).host).toBe('api.test');
    },
  );

  it.each([
    ['users', 'https://api.test', 'https://api.test/users'],
    ['users', 'https://api.test/', 'https://api.test/users'],
    ['/users', 'https://api.test', 'https://api.test/users'],
    ['?page=2', 'https://api.test/users', 'https://api.test/users?page=2'],
    ['#top', 'https://api.test/users', 'https://api.test/users#top'],
    ['', 'https://api.test/users', 'https://api.test/users'],
  ])('should join %j and %j as %j', (url, baseURL, expected) => {
    expect(lib.buildConfig(url, { baseURL }).url).toBe(expected);
  });
});

describe('Fuzzing', () => {
  let seed = 42;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pieces = [
    'a',
    'Z',
    '0',
    ' ',
    '+',
    '&',
    '=',
    '?',
    '#',
    '/',
    '\\',
    '%',
    '%20',
    '%2F',
    '.',
    '..',
    '[',
    ']',
    '[]',
    '"',
    "'",
    '<',
    '>',
    ':',
    ';',
    ',',
    '@',
    '$',
    '\t',
    '\n',
    'ą',
    '日本',
    '😀',
    '__proto__',
    'constructor',
  ];
  const randomString = (maxPieces = 5) =>
    Array.from(
      { length: Math.floor(random() * (maxPieces + 1)) },
      () => pieces[Math.floor(random() * pieces.length)],
    ).join('');

  beforeEach(() => {
    seed = 42;
  });

  it('should round-trip random query params exactly, without injecting others', () => {
    for (let i = 0; i < 1000; i++) {
      const entries = Array.from(
        { length: 1 + Math.floor(random() * 4) },
        () => [randomString() || 'k', randomString()],
      );
      const params = Object.fromEntries(entries);
      const { url } = lib.buildConfig('https://api.test/search', { params });
      const parsed = new URL(url as string).searchParams;

      expect([...new Set(parsed.keys())].sort()).toEqual(
        Object.keys(params).sort(),
      );

      for (const key of Object.keys(params)) {
        expect(parsed.get(key)).toBe(params[key]);
      }
    }
  });

  it('should keep random path params inside their own segment', () => {
    for (let i = 0; i < 1000; i++) {
      const value = randomString();

      if (value === '.' || value === '..') {
        continue;
      }

      const { url } = lib.buildConfig('https://api.test/a/:p/b', {
        urlPathParams: { p: value },
      });
      const parsed = new URL(url as string);
      const segments = parsed.pathname.split('/');

      expect(segments).toHaveLength(4);
      expect(decodeURIComponent(segments[2])).toBe(value);
      expect(parsed.search).toBe('');
      expect(parsed.hash).toBe('');
      expect(parsed.host).toBe('api.test');
    }
  });

  it('should never give different requests the same cache key', () => {
    const seen = new Map<string, string>();

    for (let i = 0; i < 3000; i++) {
      const url = '/' + randomString(3);
      const body = randomString(8);
      const request = JSON.stringify([url, body]);
      const key = lib.generateCacheKey({ url, method: 'POST', body });
      const previous = seen.get(key);

      if (previous !== undefined && previous !== request) {
        throw new Error(previous + ' and ' + request + ' share key ' + key);
      }

      seen.set(key, request);
    }
  });

  it('should always strip dangerous keys when sanitizing', () => {
    const { sanitizeObject } = jest.requireActual('../src/utils');
    const dangerous = ['__proto__', 'constructor', 'prototype'];

    for (let i = 0; i < 500; i++) {
      const entries = Array.from({ length: Math.floor(random() * 6) }, () => [
        random() < 0.3
          ? dangerous[Math.floor(random() * 3)]
          : randomString(2) || 'k',
        { polluted: true },
      ]);
      const input = Object.fromEntries(entries);
      const output = sanitizeObject(input);

      expect(Object.getPrototypeOf(output)).toBe(Object.prototype);

      for (const key of dangerous) {
        expect(Object.prototype.hasOwnProperty.call(output, key)).toBe(false);
      }

      for (const key of Object.keys(input)) {
        if (!dangerous.includes(key)) {
          expect(output[key]).toBe(input[key]);
        }
      }
    }
  });
});

describe('Endpoint names', () => {
  it.each([['constructor'], ['__proto__'], ['toString'], ['hasOwnProperty']])(
    'should treat the inherited name %j as a plain URL, not an endpoint',
    async (name) => {
      const api = lib.createApiFetcher({
        baseURL: 'https://api.test/',
        endpoints: {},
      });

      await api.request(name);

      expect(sentRequests[0].url).toBe('https://api.test/' + name);
    },
  );
});

describe('Request identity', () => {
  const key = (body: unknown) =>
    lib.generateCacheKey({ url: '/upload', method: 'POST', body } as any);
  const formWithFile = (content: string) => {
    const form = new FormData();
    form.append('file', new Blob([content]), 'file.txt');
    return form;
  };

  it.each([
    [
      'URLSearchParams',
      () => new URLSearchParams('a=1'),
      () => new URLSearchParams('b=2'),
    ],
    ['FormData files', () => formWithFile('AAAA'), () => formWithFile('BBBB')],
    [
      'Blobs of the same size',
      () => new Blob(['AAAA']),
      () => new Blob(['BBBB']),
    ],
    [
      'typed arrays of the same length',
      () => new Uint8Array([1, 2]),
      () => new Uint8Array([3, 4]),
    ],
    [
      'ArrayBuffers of the same length',
      () => new ArrayBuffer(8),
      () => new ArrayBuffer(8),
    ],
    ['streams', () => new ReadableStream(), () => new ReadableStream()],
    [
      'objects differing in a __proto__ key',
      () => JSON.parse('{"__proto__": {"admin": true}, "q": "x"}'),
      () => ({ q: 'x' }),
    ],
  ])('should give different %s different cache keys', (_, first, second) => {
    expect(key(first())).not.toBe(key(second()));
  });

  it('should give the same body object the same cache key', () => {
    const body = formWithFile('AAAA');

    expect(key(body)).toBe(key(body));
  });

  it('should not deduplicate two different uploads into one request', async () => {
    const config = { method: 'POST', dedupeTime: 2000 } as const;

    await Promise.all([
      lib.fetchf('https://api.test/upload', {
        ...config,
        body: formWithFile('AAAA'),
      }),
      lib.fetchf('https://api.test/upload', {
        ...config,
        body: formWithFile('BBBB'),
      }),
    ]);

    expect(sentRequests).toHaveLength(2);
  });
});

describe('Timer limits', () => {
  it.each([[Infinity], [2 ** 31]])(
    'should not abort a request right away with timeout: %p',
    async (timeout) => {
      global.fetch = jest.fn(
        (_url: string, init: RequestInit) =>
          new Promise((resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(init.signal?.reason),
            );
            setTimeout(() => resolve(new Response('{}')), 50);
          }),
      ) as any;

      const { error } = await lib.fetchf('https://api.test/a', {
        timeout,
        strategy: 'softFail',
      });

      expect(error).toBeNull();
    },
  );

  it('should not poll right away with a huge pollingInterval', async () => {
    // Fake timers fire delays that don't fit in 32 bits right away, like browsers and Node.js
    jest.useFakeTimers();

    lib.fetchf('https://api.test/a', {
      pollingInterval: 2 ** 31,
      maxPollingAttempts: 2,
    });

    await jest.advanceTimersByTimeAsync(1000);

    expect(sentRequests).toHaveLength(1);
  });
});

describe('Hostile objects', () => {
  const hostile = () => JSON.parse('{"__proto__": {"polluted": "yes"}}');

  it('should not let interceptor results set the prototype of the config or response', async () => {
    const { config } = await lib.fetchf<any>('https://api.test/a', {
      onRequest: () => hostile(),
      onResponse: (response: any) => {
        Object.assign(response, { seen: true });
        return hostile();
      },
    });

    expect((config as any).polluted).toBeUndefined();
  });

  it('should skip __proto__ when normalizing headers', () => {
    const { processHeaders } = jest.requireActual('../src/utils');

    expect(processHeaders(hostile()).polluted).toBeUndefined();
  });

  it('should ignore __proto__ in nested retry settings', () => {
    const config = lib.buildConfig('https://api.test/a', { retry: hostile() });

    expect((config.retry as any).polluted).toBeUndefined();
  });
});

describe('Header injection', () => {
  it('should not send a request with CR/LF in header values', async () => {
    const { error } = await lib.fetchf('https://api.test/a', {
      headers: { 'X-A': 'a\r\nInjected: 1' },
      strategy: 'softFail',
    });

    expect(error).toBeTruthy();
    expect(sentRequests).toHaveLength(0);
  });
});

describe('Credentials on external URLs', () => {
  it('should not apply global withCredentials to external URLs', async () => {
    let credentials: RequestCredentials | undefined;
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      credentials = init.credentials;
      return new Response('{}');
    }) as any;

    await lib
      .createApiFetcher({
        baseURL: 'https://api.test',
        withCredentials: true,
        endpoints: {},
      })
      .request('https://evil.test/steal');

    expect(credentials).not.toBe('include');
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
