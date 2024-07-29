import type { RequestConfig } from './types';

export class RequestError extends Error {
  response: Response;
  request: RequestConfig;

  constructor(message: string, requestInfo: RequestConfig, response: Response) {
    super(message);

    this.name = 'RequestError';
    this.message = message;
    this.request = requestInfo;
    this.response = response;

    // Clean stack trace
    Error.captureStackTrace(this, RequestError);
  }
}
