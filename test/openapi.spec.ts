import { createApiFetcher } from '../src';
import type { OpenApiEndpoint } from '../src';
import { replaceUrlPathParams } from '../src/utils';

// A schema like the ones that openapi-typescript generates
interface components {
  schemas: {
    User: { id: number; name: string };
    NewUser: { name: string };
    Error: { message: string };
  };
}

interface operations {
  getUser: {
    parameters: {
      query?: { expand?: 'posts' };
      header?: never;
      path: { id: number };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: { [name: string]: unknown };
        content: { 'application/json': components['schemas']['User'] };
      };
      404: {
        headers: { [name: string]: unknown };
        content: { 'application/json': components['schemas']['Error'] };
      };
    };
  };
  createUser: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: { 'application/json': components['schemas']['NewUser'] };
    };
    responses: {
      201: {
        headers: { [name: string]: unknown };
        content: { 'application/json': components['schemas']['User'] };
      };
    };
  };
  deleteUser: {
    parameters: {
      query?: never;
      header?: never;
      path: { id: number };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      204: {
        headers: { [name: string]: unknown };
        content?: never;
      };
    };
  };
}

interface paths {
  '/users': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get?: never;
    post: operations['createUser'];
  };
  '/users/{id}': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never };
    get: operations['getUser'];
    post?: never;
    delete: operations['deleteUser'];
  };
}

type Endpoints = {
  getUser: OpenApiEndpoint<paths, '/users/{id}', 'get'>;
  createUser: OpenApiEndpoint<paths, '/users', 'post'>;
  deleteUser: OpenApiEndpoint<paths, '/users/{id}', 'delete'>;
};

describe('OpenAPI endpoints', () => {
  let fetchMock: jest.SpyInstance;

  const api = createApiFetcher<Endpoints>({
    baseURL: 'https://api.example.com',
    endpoints: {
      getUser: { url: '/users/{id}' },
      createUser: { url: '/users', method: 'POST' },
      deleteUser: { url: '/users/{id}', method: 'DELETE' },
    },
  });

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response('{"id":1,"name":"Ada"}', {
          headers: { 'Content-Type': 'application/json' },
        }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should type the requests and responses of endpoints by the schema', async () => {
    const { data } = await api.getUser({
      urlPathParams: { id: 1 },
      params: { expand: 'posts' },
    });
    const user: components['schemas']['User'] = data;

    expect(user).toEqual({ id: 1, name: 'Ada' });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.example.com/users/1?expand=posts',
    );

    const { data: created } = await api.createUser({ body: { name: 'Ada' } });
    const createdUser: components['schemas']['User'] = created;

    expect(createdUser.name).toBe('Ada');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(fetchMock.mock.calls[1][1].body).toBe('{"name":"Ada"}');
  });

  it('should reject requests and responses that do not match the schema', async () => {
    // @ts-expect-error The id of the user is a number
    await api.getUser({ urlPathParams: { id: 'one' } });

    // @ts-expect-error A new user has a name
    await api.createUser({ body: { title: 'Ada' } });

    const { data } = await api.getUser({ urlPathParams: { id: 1 } });

    // @ts-expect-error The user has no email
    expect(data.email).toBeUndefined();
  });

  it('should type the data of responses without content as undefined', async () => {
    fetchMock.mockImplementation(
      async () => new Response(null, { status: 204 }),
    );

    const { data, status } = await api.deleteUser({ urlPathParams: { id: 1 } });
    const nothing: undefined = data;

    expect(nothing).toBeFalsy();
    expect(status).toBe(204);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/users/1');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('should replace path params in the {param} format of OpenAPI paths', () => {
    expect(
      replaceUrlPathParams('/users/{id}/posts/{postId}', {
        id: 1,
        postId: 'a b',
      }),
    ).toBe('/users/1/posts/a%20b');
    expect(
      replaceUrlPathParams('/users/{id}/:tab', { id: 1, tab: 'posts' }),
    ).toBe('/users/1/posts');

    // Unknown params are kept as they are
    expect(replaceUrlPathParams('/users/{id}', { name: 'Ada' })).toBe(
      '/users/{id}',
    );
  });
});
