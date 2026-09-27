import { ABORT_ERROR, UNDEFINED } from './constants';
import type { RequestConfig, UploadProgress } from './types';
import { createAbortError } from './utils';

// Responses with these statuses can't have a body
const NULL_BODY_STATUSES = [204, 205, 304];

// Headers that browsers don't let requests set. fetch() skips them silently, while
// XMLHttpRequest logs errors for them, so they are skipped before sending.
const FORBIDDEN_HEADERS =
  /^(accept-charset|accept-encoding|connection|content-length|cookie2?|date|dnt|expect|host|keep-alive|origin|referer|set-cookie|te|trailer|transfer-encoding|upgrade|via)$|^(proxy-|sec-|access-control-request-)/;

// ReadableStream is missing in some environments, e.g. React Native
const isStream = (body: unknown): body is ReadableStream<Uint8Array> =>
  typeof ReadableStream !== UNDEFINED && body instanceof ReadableStream;

const toProgress = (loaded: number, total?: number): UploadProgress => ({
  loaded,
  total,
  progress: total ? loaded / total : undefined,
});

/**
 * Sends a request and reports the upload progress of its body to `onUploadProgress`.
 * Browsers and React Native don't report the upload progress of fetch(), so XMLHttpRequest is used there.
 * Elsewhere, e.g. in Node.js, the body is streamed with fetch() and counted while it is sent.
 *
 * @param {string} url - The request URL.
 * @param {RequestConfig} config - The request configuration, with a body and `onUploadProgress`.
 * @returns {Promise<Response>} - The response.
 */
export function fetchWithUploadProgress(
  url: string,
  config: RequestConfig,
): Promise<Response> {
  const body = config.body as BodyInit;

  return typeof XMLHttpRequest !== UNDEFINED && !isStream(body)
    ? sendWithXhr(url, config, body)
    : sendStreamed(url, config, body);
}

function sendWithXhr(
  url: string,
  config: RequestConfig,
  body: BodyInit,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // fetchf() always sets the signal, as it handles timeouts and cancellation with it
    const signal = config.signal!;
    const abort = () => xhr.abort();

    const settle = (fn: () => void) => {
      signal.removeEventListener('abort', abort);

      try {
        fn();
      } catch (error) {
        reject(error);
      }
    };

    xhr.open(config.method as string, url);
    xhr.responseType = 'blob';
    xhr.withCredentials = config.credentials === 'include';

    new Headers(config.headers).forEach(
      (value, name) =>
        FORBIDDEN_HEADERS.test(name) || xhr.setRequestHeader(name, value),
    );

    xhr.upload.onprogress = (event) =>
      config.onUploadProgress!(
        toProgress(
          event.loaded,
          event.lengthComputable ? event.total : undefined,
        ),
      );

    xhr.onload = () =>
      settle(() => {
        const headers = new Headers();

        for (const line of xhr.getAllResponseHeaders().split(/\r?\n/)) {
          const index = line.indexOf(':');

          if (index > 0) {
            headers.append(line.slice(0, index), line.slice(index + 1).trim());
          }
        }

        const response = new Response(
          NULL_BODY_STATUSES.includes(xhr.status) ? null : xhr.response,
          { status: xhr.status, statusText: xhr.statusText, headers },
        );

        // Like fetch(), the response tells its final URL, e.g. after redirects
        Object.defineProperty(response, 'url', { value: xhr.responseURL });

        resolve(response);
      });

    xhr.onerror = () =>
      settle(() => reject(new TypeError('Network request failed')));

    // Like fetch(), aborted requests reject with the reason of the abort signal
    const onAbort = () =>
      settle(() =>
        reject(
          signal.reason ||
            createAbortError('The request was aborted', ABORT_ERROR),
        ),
      );

    xhr.onabort = onAbort;

    if (signal.aborted) {
      return onAbort();
    }

    signal.addEventListener('abort', abort);

    xhr.send(body as XMLHttpRequestBodyInit);
  });
}

async function sendStreamed(
  url: string,
  config: RequestConfig,
  body: BodyInit,
): Promise<Response> {
  const headers = new Headers(config.headers);
  let stream = body as ReadableStream<Uint8Array>;
  let total: number | undefined;

  if (!isStream(body)) {
    // Serialize the body like fetch() would, to know its size and content type
    const blob = body instanceof Blob ? body : await new Response(body).blob();

    total = blob.size;
    stream = blob.stream();

    if (blob.type && !headers.has('content-type')) {
      headers.set('content-type', blob.type);
    }
  }

  let loaded = 0;

  return fetch(url, {
    ...config,
    headers,
    body: stream.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          loaded += chunk.byteLength;
          config.onUploadProgress!(toProgress(loaded, total));
          controller.enqueue(chunk);
        },
      }),
    ),
    // Required by fetch() to send a stream
    duplex: 'half',
  } as RequestInit);
}
