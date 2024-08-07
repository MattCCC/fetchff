import type { FetchResponse, RequestConfig } from './types';

export class ResponseErr extends Error {
  response: FetchResponse;
  request: RequestConfig;
  config: RequestConfig;
  status: number;
  statusText: string;

  constructor(
    message: string,
    requestInfo: RequestConfig,
    response: FetchResponse,
  ) {
    super(message);

    this.name = 'ResponseError';
    this.message = message;
    this.status = response.status;
    this.statusText = response.statusText;
    this.request = requestInfo;
    this.config = requestInfo;
    this.response = response;
  }
}
