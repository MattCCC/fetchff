import type { RequestConfig } from './types';

export class ResponseErr extends Error {
  response: Response;
  request: RequestConfig;
  config: RequestConfig;
  status: number;
  statusText: string;

  constructor(message: string, requestInfo: RequestConfig, response: Response) {
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
