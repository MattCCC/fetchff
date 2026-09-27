import { fetchf } from '../src';
import { withDownloadProgress } from '../src/download-progress';
import { pruneCache } from '../src/cache-manager';
import { clearAllTimeouts } from '../src/timeout-wheel';

const url = 'https://api.example.com/books';
const encoder = new TextEncoder();
const parts = ['[{"id":1,', '"title":"Dune"},', '{"id":2,"title":"Emma"}]'];
const sizes = parts.map((part) => encoder.encode(part).byteLength);
const size = sizes.reduce((sum, partSize) => sum + partSize, 0);
const books = [
  { id: 1, title: 'Dune' },
  { id: 2, title: 'Emma' },
];

// A response whose body arrives in parts, like one downloaded over the network
const streamedResponse = (headers: Record<string, string>, init = {}) =>
  new Response(
    new ReadableStream({
      start(controller) {
        parts.forEach((part) => controller.enqueue(encoder.encode(part)));
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'application/json', ...headers }, ...init },
  );

describe('onDownloadProgress', () => {
  let fetchMock: jest.SpyInstance;

  // Like fetch(), the mock reads the body of the request before responding
  const mockResponse = (response: Response) => {
    fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_url, init) => {
        await new Response(init?.body).arrayBuffer();

        return response;
      });
  };

  afterEach(() => {
    jest.restoreAllMocks();
    pruneCache();
    clearAllTimeouts();
  });

  it('should report the download progress while the body is received', async () => {
    mockResponse(streamedResponse({ 'Content-Length': String(size) }));

    const onDownloadProgress = jest.fn();
    const response = await fetchf(url, { onDownloadProgress });

    expect(response.data).toEqual(books);
    expect(onDownloadProgress.mock.calls).toEqual([
      [{ loaded: sizes[0], total: size, progress: sizes[0] / size }],
      [
        {
          loaded: sizes[0] + sizes[1],
          total: size,
          progress: (sizes[0] + sizes[1]) / size,
        },
      ],
      [{ loaded: size, total: size, progress: 1 }],
    ]);
  });

  it('should report an unknown total without a Content-Length header', async () => {
    mockResponse(streamedResponse({}));

    const onDownloadProgress = jest.fn();

    await fetchf(url, { onDownloadProgress });

    expect(onDownloadProgress).toHaveBeenCalledTimes(3);
    expect(onDownloadProgress).toHaveBeenLastCalledWith({
      loaded: size,
      total: undefined,
      progress: undefined,
    });
  });

  it('should report an unknown total for compressed responses', async () => {
    // Content-Length is the compressed size, which isn't the size of the decompressed body that is read
    mockResponse(
      streamedResponse({
        'Content-Length': String(Math.round(size / 3)),
        'Content-Encoding': 'gzip',
      }),
    );

    const onDownloadProgress = jest.fn();

    await fetchf(url, { onDownloadProgress });

    expect(onDownloadProgress).toHaveBeenLastCalledWith({
      loaded: size,
      total: undefined,
      progress: undefined,
    });
  });

  it('should not report more than the whole body when Content-Length is too small', async () => {
    // E.g. a cross-origin response whose Content-Encoding header browsers hide
    mockResponse(streamedResponse({ 'Content-Length': String(sizes[0]) }));

    const onDownloadProgress = jest.fn();

    await fetchf(url, { onDownloadProgress });

    expect(onDownloadProgress.mock.calls).toEqual([
      [{ loaded: sizes[0], total: sizes[0], progress: 1 }],
      [
        {
          loaded: sizes[0] + sizes[1],
          total: sizes[0] + sizes[1],
          progress: 1,
        },
      ],
      [{ loaded: size, total: size, progress: 1 }],
    ]);
  });

  it('should keep the details of the response', async () => {
    const original = streamedResponse(
      { 'Content-Length': String(size) },
      { status: 201, statusText: 'Created' },
    );

    Object.defineProperties(original, {
      url: { value: url + '?page=1' },
      redirected: { value: true },
      type: { value: 'cors' },
    });
    mockResponse(original);

    const response = await fetchf(url, { onDownloadProgress: jest.fn() });

    expect(response).toMatchObject({
      status: 201,
      statusText: 'Created',
      ok: true,
      url: url + '?page=1',
      redirected: true,
      type: 'cors',
      headers: {
        'content-type': 'application/json',
        'content-length': String(size),
      },
      data: books,
    });
  });

  it('should report the progress of bodies that a custom parser reads', async () => {
    mockResponse(streamedResponse({ 'Content-Length': String(size) }));

    const onDownloadProgress = jest.fn();
    const response = await fetchf(url, {
      onDownloadProgress,
      parser: (response) => response.text(),
    });

    expect(response.data).toBe(parts.join(''));
    expect(onDownloadProgress).toHaveBeenCalledTimes(3);
  });

  it('should report the download progress of uploads', async () => {
    mockResponse(streamedResponse({ 'Content-Length': String(size) }));

    const onUploadProgress = jest.fn();
    const onDownloadProgress = jest.fn();

    await fetchf(url, {
      method: 'POST',
      body: { title: 'Dune' },
      onUploadProgress,
      onDownloadProgress,
    });

    expect(onUploadProgress).toHaveBeenCalled();
    expect(onDownloadProgress).toHaveBeenLastCalledWith({
      loaded: size,
      total: size,
      progress: 1,
    });
  });

  it('should not report the progress of responses without a body', async () => {
    mockResponse(new Response(null, { status: 204 }));

    const onDownloadProgress = jest.fn();
    const response = await fetchf(url, { onDownloadProgress });

    expect(response.status).toBe(204);
    expect(onDownloadProgress).not.toHaveBeenCalled();
  });

  it('should keep the response as it is without onDownloadProgress', async () => {
    const original = streamedResponse({});

    mockResponse(original);

    const response = await fetchf(url);

    expect(response.body).toBe(original.body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('should keep responses of custom fetchers that are not native as they are', async () => {
    const onDownloadProgress = jest.fn();
    const response = await fetchf(url, {
      onDownloadProgress,
      fetcher: () => Promise.resolve({ data: books, body: null, ok: true }),
    });

    expect(response.data).toEqual(books);
    expect(onDownloadProgress).not.toHaveBeenCalled();
  });

  it('should keep responses as they are where Response is missing', () => {
    const response = { data: books };
    const NativeResponse = globalThis.Response;

    // @ts-expect-error Response is missing in some environments
    delete globalThis.Response;

    try {
      expect(withDownloadProgress(response, jest.fn())).toBe(response);
    } finally {
      globalThis.Response = NativeResponse;
    }
  });
});
