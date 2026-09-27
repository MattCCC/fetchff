import { FUNCTION } from './constants';
import type { DownloadProgress } from './types';
import { toProgress } from './upload-progress';

/**
 * Reports the download progress of a response body to `onDownloadProgress` while the body is read.
 * The body is counted as it arrives, so the progress follows the download.
 *
 * @param {T} response - The response. Other than native responses with a body, e.g. responses of HEAD requests or custom fetchers, are returned as they are.
 * @param {Function} [onDownloadProgress] - The function called with the progress. Without it, the response is returned as it is.
 * @returns {T} - A copy of the response, whose body is counted while it's read.
 */
export function withDownloadProgress<T>(
  response: T,
  onDownloadProgress?: (progress: DownloadProgress) => void,
): T {
  // Response is missing in some environments, and response bodies e.g. in React Native
  if (
    !onDownloadProgress ||
    typeof Response !== FUNCTION ||
    !(response instanceof Response) ||
    !response.body
  ) {
    return response;
  }

  const headers = response.headers;
  // Content-Length is the size of the compressed body, so the size of a compressed one is unknown
  const total = headers.has('content-encoding')
    ? undefined
    : Number(headers.get('content-length')) || undefined;
  let loaded = 0;

  const counted = new Response(
    response.body.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          loaded += chunk.byteLength;
          // Browsers may hide the Content-Encoding header of cross-origin responses, so the progress is capped at 1
          onDownloadProgress(
            toProgress(loaded, total && Math.max(total, loaded)),
          );
          controller.enqueue(chunk);
        },
      }),
    ),
    response,
  );

  // Like the original response, the copy tells its final URL, whether it was redirected and its type
  for (const key of ['url', 'redirected', 'type'] as const) {
    Object.defineProperty(counted, key, { value: response[key] });
  }

  return counted as T;
}
