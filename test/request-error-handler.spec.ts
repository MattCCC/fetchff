import { RequestErrorHandler } from '../src/request-error-handler';

export const mockErrorCallbackClass = class CustomErrorHandler {
  public process() {
    return 'function called';
  }
};

describe('Request Error Handler', () => {
  const mockErrorCallback = () => 'function called';

  it('should call provided error callback', () => {
    const httpRequestHandler = new RequestErrorHandler(null, mockErrorCallback);
    httpRequestHandler.requestErrorService = jest
      .fn()
      .mockResolvedValue(mockErrorCallback);

    httpRequestHandler.process('My error text');

    expect(httpRequestHandler.requestErrorService).toHaveBeenCalledTimes(1);
    expect(httpRequestHandler.requestErrorService).toHaveBeenCalledWith(
      new Error('My error text'),
    );
  });

  it('should call provided error class', () => {
    const httpRequestHandler = new RequestErrorHandler(
      null,
      mockErrorCallbackClass,
    );
    httpRequestHandler.requestErrorService.process = jest
      .fn()
      .mockResolvedValue(mockErrorCallbackClass);

    httpRequestHandler.process('My error text');

    expect(
      httpRequestHandler.requestErrorService.process,
    ).toHaveBeenCalledTimes(1);
    expect(httpRequestHandler.requestErrorService.process).toHaveBeenCalledWith(
      new Error('My error text'),
    );
  });
});
