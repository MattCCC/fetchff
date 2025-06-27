import {
  queueRequest,
  abortRequest,
  getController,
} from '../src/queue-manager';

const createKey = (url: string) => url;

describe('Request Queue Manager', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  it('should add and retrieve a request correctly', async () => {
    const key = createKey('https://example.com');
    const controller = await queueRequest(key, 'https://example.com', 1000);
    const retrievedController = await getController(key);
    expect(retrievedController).toBe(controller);
  });

  it('should remove a request from the queue', async () => {
    const key = createKey('https://example.com');
    await queueRequest(key, 'https://example.com', 1000);
    await abortRequest(key);
    const retrievedController = await getController(key);
    expect(retrievedController).toBeUndefined();
  });

  it('should handle removing a non-existent request', async () => {
    const key = createKey('https://example.com');
    await expect(abortRequest(key)).resolves.not.toThrow();
  });

  it('should handle multiple concurrent requests correctly', async () => {
    const key1 = createKey('https://example1.com');
    const key2 = createKey('https://example2.com');
    const [controller1, controller2] = await Promise.all([
      queueRequest(key1, 'https://example1.com', 1000),
      queueRequest(key2, 'https://example2.com', 1000),
    ]);
    const [retrievedController1, retrievedController2] = await Promise.all([
      getController(key1),
      getController(key2),
    ]);
    expect(retrievedController1).toBe(controller1);
    expect(retrievedController2).toBe(controller2);
    await abortRequest(key1);
    await abortRequest(key2);
  });

  it('should handle concurrent requests with different configurations separately', async () => {
    const key1 = createKey('https://example.com/a');
    const key2 = createKey('https://example.com/b');
    const [controller1, controller2] = await Promise.all([
      queueRequest(key1, 'https://example.com/a', 2000),
      queueRequest(key2, 'https://example.com/b', 2000),
    ]);
    jest.advanceTimersByTime(2000);
    expect(controller1).toBeDefined();
    expect(controller2).toBeDefined();
    expect(controller1).not.toBe(controller2);
  });

  it('should abort request due to timeout and remove it from queue', async () => {
    const key = createKey('https://example.com');
    const timeout = 1000;
    await queueRequest(key, 'https://example.com', timeout);
    jest.advanceTimersByTime(timeout);
    const controller = await getController(key);
    expect(controller).toBeUndefined();
    await abortRequest(key);
  });

  it('should queue multiple operations on the same request key correctly', async () => {
    const key = createKey('https://example.com');
    const firstRequestPromise = queueRequest(key, 'https://example.com', 2000);
    const secondRequestPromise = queueRequest(key, 'https://example.com', 2000);
    jest.advanceTimersByTime(500);
    expect(await getController(key)).toBeTruthy();
    jest.advanceTimersByTime(1500);
    const firstRequestController = await firstRequestPromise;
    const secondRequestController = await secondRequestPromise;
    expect(firstRequestController).not.toBe(secondRequestController);
    expect(await getController(key)).toBeUndefined();
  });

  it('should clear timeout and abort request on removal', async () => {
    const key = createKey('https://example.com');
    await queueRequest(key, 'https://example.com', 1000);
    jest.advanceTimersByTime(1500);
    const retrievedController = await getController(key);
    expect(retrievedController).toBeUndefined();
  });

  it('should deduplicate same requests within dedupeTime', async () => {
    const key = 'dedupe-key';
    const controller1 = await queueRequest(key, 'dedupe-url', 2000, 1000);
    const controller2 = await queueRequest(key, 'dedupe-url', 2000, 1000);
    jest.advanceTimersByTime(500);
    expect(controller1).toBe(controller2);
  });

  it('should not deduplicate requests if dedupeTime is 0', async () => {
    const key = 'dedupe-key-0';
    const controller1 = await queueRequest(key, 'dedupe-url-0', 1000, 0);
    const controller2 = await queueRequest(key, 'dedupe-url-0', 1000, 0);
    jest.advanceTimersByTime(1000);
    expect(controller1).not.toBe(controller2);
  });

  it('should not abort the request when timeout is disabled', async () => {
    const key = 'timeout-disabled';
    const controller = await queueRequest(
      key,
      'timeout-disabled-url',
      0,
      0,
      false,
      false,
    );
    jest.advanceTimersByTime(1000);
    expect(controller.signal.aborted).toBe(false);
    await abortRequest(key, null);
  });

  it('should handle multiple distinct requests separately', async () => {
    const keyA = 'distinct-a';
    const keyB = 'distinct-b';
    const controllerA = await queueRequest(keyA, 'distinct-a-url', 1000, 1000);
    const controllerB = await queueRequest(keyB, 'distinct-b-url', 1000, 1000);
    jest.advanceTimersByTime(1000);
    expect(controllerA).not.toBe(controllerB);
  });

  it('should handle both timeout and cancellation correctly', async () => {
    const key = 'timeout-cancel';
    const controller1 = await queueRequest(
      key,
      'timeout-cancel-url',
      1000,
      1000,
      true,
    );
    const controller2 = await queueRequest(
      key,
      'timeout-cancel-url',
      1000,
      1000,
      true,
    );
    jest.advanceTimersByTime(1500);
    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(true);
  });

  it('should handle requests with the same configuration but different options correctly', async () => {
    const key = 'same-config-diff-options';
    const controller1 = await queueRequest(
      key,
      'same-config-diff-options-url',
      2000,
      1000,
      true,
    );
    const controller2 = await queueRequest(
      key,
      'same-config-diff-options-url',
      2000,
      1000,
      false,
    );
    jest.advanceTimersByTime(1500);
    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(false);
  });

  it('should handle request configuration changes correctly', async () => {
    const key1 = 'config-change-1';
    const key2 = 'config-change-2';
    const controller1 = await queueRequest(
      key1,
      'config-change-1-url',
      2000,
      1000,
    );
    const controller2 = await queueRequest(
      key2,
      'config-change-2-url',
      2000,
      1000,
    );
    jest.advanceTimersByTime(1500);
    expect(controller1).not.toBe(controller2);
    expect(controller1.signal.aborted).toBe(false);
    expect(controller2.signal.aborted).toBe(false);
  });

  it('should cancel all previous requests if they are cancellable and deduplication time is not yet passed', async () => {
    const key = 'cancel-prev-not-passed';
    const controller1 = await queueRequest(
      key,
      'cancel-prev-not-passed-url',
      2000,
      1000,
      true,
    );
    const controller2 = await queueRequest(
      key,
      'cancel-prev-not-passed-url',
      2000,
      1000,
      true,
    );
    const controller3 = await queueRequest(
      key,
      'cancel-prev-not-passed-url',
      2000,
      1000,
      true,
    );
    jest.advanceTimersByTime(500);
    expect(controller1).not.toBe(controller3);
    expect(controller2).not.toBe(controller3);
    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(true);
    expect(controller3.signal.aborted).toBe(false);
    expect(controller3).toBeInstanceOf(AbortController);
  });

  it('should cancel all previous requests if they are cancellable and deduplication time is passed', async () => {
    const key = 'cancel-prev-passed';
    const controller1 = await queueRequest(
      key,
      'cancel-prev-passed-url',
      2000,
      1000,
      true,
    );
    const controller2 = await queueRequest(
      key,
      'cancel-prev-passed-url',
      2000,
      1000,
      true,
    );
    const controller3 = await queueRequest(
      key,
      'cancel-prev-passed-url',
      2000,
      1000,
      true,
    );
    jest.advanceTimersByTime(1500);
    expect(controller1).not.toBe(controller3);
    expect(controller2).not.toBe(controller3);
    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(true);
    expect(controller3.signal.aborted).toBe(false);
    expect(controller3).toBeInstanceOf(AbortController);
  });

  it('should cancel all requests if they are cancellable and timeout is passed', async () => {
    const key = 'cancel-all-timeout';
    const controller1 = await queueRequest(
      key,
      'cancel-all-timeout-url',
      2000,
      1000,
      true,
    );
    const controller2 = await queueRequest(
      key,
      'cancel-all-timeout-url',
      2000,
      1000,
      true,
    );
    const controller3 = await queueRequest(
      key,
      'cancel-all-timeout-url',
      2000,
      1000,
      true,
    );
    jest.advanceTimersByTime(2500);
    expect(controller1).not.toBe(controller3);
    expect(controller2).not.toBe(controller3);
    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(true);
    expect(controller3.signal.aborted).toBe(true);
    expect(controller3).toBeInstanceOf(AbortController);
  });

  it('should not cancel any request if not cancellable and deduplication time is not yet passed', async () => {
    const key = 'not-cancel-not-passed';
    const controller1 = await queueRequest(
      key,
      'not-cancel-not-passed-url',
      2000,
      1000,
      false,
    );
    const controller2 = await queueRequest(
      key,
      'not-cancel-not-passed-url',
      2000,
      1000,
      false,
    );
    const controller3 = await queueRequest(
      key,
      'not-cancel-not-passed-url',
      2000,
      1000,
      false,
    );
    jest.advanceTimersByTime(500);
    expect(controller1).toBe(controller3);
    expect(controller2).toBe(controller3);
    expect(controller1.signal.aborted).toBe(false);
    expect(controller2.signal.aborted).toBe(false);
    expect(controller3.signal.aborted).toBe(false);
    expect(controller3).toBeInstanceOf(AbortController);
  });

  it('should not cancel any request if not cancellable and deduplication time is passed for each request', async () => {
    const key = 'not-cancel-passed';
    const controller1 = await queueRequest(
      key,
      'not-cancel-passed-url',
      20000,
      1000,
      false,
    );
    jest.advanceTimersByTime(1500);
    const controller2 = await queueRequest(
      key,
      'not-cancel-passed-url',
      20000,
      1000,
      false,
    );
    jest.advanceTimersByTime(1500);
    const controller3 = await queueRequest(
      key,
      'not-cancel-passed-url',
      20000,
      1000,
      false,
    );
    jest.advanceTimersByTime(1500);
    expect(controller1).not.toBe(controller3);
    expect(controller1).not.toBe(controller2);
    expect(controller2).not.toBe(controller3);
    expect(controller1.signal.aborted).toBe(false);
    expect(controller2.signal.aborted).toBe(false);
    expect(controller3.signal.aborted).toBe(false);
    expect(controller3).toBeInstanceOf(AbortController);
  });

  it('should not cancel the previous requests if they are not cancellable', async () => {
    const key = 'not-cancel-prev';
    const controller1 = await queueRequest(
      key,
      'not-cancel-prev-url',
      2000,
      1000,
      false,
    );
    jest.advanceTimersByTime(1500);
    const controller2 = await queueRequest(
      key,
      'not-cancel-prev-url',
      2000,
      1000,
      true,
    );
    expect(controller1).not.toBe(controller2);
    expect(controller1.signal.aborted).toBe(false);
    expect(controller2.signal.aborted).toBe(false);
    expect(controller2).toBeInstanceOf(AbortController);
  });
});
