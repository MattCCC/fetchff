/* eslint-disable @typescript-eslint/no-explicit-any */
import { APPLICATION_JSON, CONTENT_TYPE } from './const';
import type { DefaultResponse, FetchResponse } from './types/request-handler';

/**
 * Parses the response data based on the Content-Type header.
 *
 * @param response - The Response object to parse.
 * @returns A Promise that resolves to the parsed data.
 */
export async function parseResponseData<ResponseData = DefaultResponse>(
  response: FetchResponse<ResponseData>,
): Promise<any> {
  // Bail early when body is empty
  if (!response?.body) {
    return null;
  }

  const contentType = String(
    (response as Response).headers?.get(CONTENT_TYPE) || '',
  ).split(';')[0]; // Correctly handle charset

  let data;

  try {
    if (
      contentType.includes(APPLICATION_JSON) ||
      contentType.includes('+json')
    ) {
      data = await response.json(); // Parse JSON response
    } else if (contentType.includes('multipart/form-data')) {
      data = await response.formData(); // Parse as FormData
    } else if (contentType.includes('application/octet-stream')) {
      data = await response.blob(); // Parse as blob
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      data = await response.formData(); // Handle URL-encoded forms
    } else if (contentType.includes('text/')) {
      data = await response.text(); // Parse as text
    } else {
      try {
        const responseClone = response.clone();

        // Handle edge case of no content type being provided... We assume JSON here.
        data = await responseClone.json();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        // Handle streams
        data = await response.text();
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    // Parsing failed, fallback to null
    data = null;
  }

  return data;
}
