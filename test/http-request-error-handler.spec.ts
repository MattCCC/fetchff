import { HttpRequestErrorHandler } from '../src/http-request-error-handler';

export const mockErrorCallbackClass = class CustomErrorHandler {
  public process() {
    return 'function called';
  }
};

describe('API Handler', () => {
  const mockErrorCallback = () => 'function called';

  it('should call provided error callback', () => {
    const httpRequestHandler = new HttpRequestErrorHandler(
      null,
      mockErrorCallback
    );
    httpRequestHandler.httpRequestErrorService = jest
      .fn()
      .mockResolvedValue(mockErrorCallback);

    httpRequestHandler.process('My error text');

    expect(httpRequestHandler.httpRequestErrorService).toHaveBeenCalledTimes(1);
    expect(httpRequestHandler.httpRequestErrorService).toHaveBeenCalledWith(
      new Error('My error text')
    );
  });

  it('should call provided error class', () => {
    const httpRequestHandler = new HttpRequestErrorHandler(
      null,
      mockErrorCallbackClass
    );
    httpRequestHandler.httpRequestErrorService.process = jest
      .fn()
      .mockResolvedValue(mockErrorCallbackClass);

    httpRequestHandler.process('My error text');

    expect(
      httpRequestHandler.httpRequestErrorService.process
    ).toHaveBeenCalledTimes(1);
    expect(
      httpRequestHandler.httpRequestErrorService.process
    ).toHaveBeenCalledWith(new Error('My error text'));
  });
});
