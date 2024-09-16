import { addRequest, removeRequest, getController } from '../src/queue-manager';
import type { RequestConfig } from '../src/types';

const createConfig = (url: string): RequestConfig => ({
  url,
});

describe('Request Queue Manager', () => {
  const config = createConfig('https://example.com');
  const mockConfig = { method: 'GET', url: 'http://example.com' }; // Replace with appropriate mock config

  beforeAll(() => {
    jest.useFakeTimers();
  });

  it('should add and retrieve a request correctly', async () => {
    const controller = await addRequest(config, 1000);
    const retrievedController = await getController(config);

    expect(retrievedController).toBe(controller);
  });

  it('should remove a request from the queue', async () => {
    await addRequest(config, 1000);
    await removeRequest(config);
    const retrievedController = await getController(config);

    expect(retrievedController).toBeUndefined();
  });

  it('should handle removing a non-existent request', async () => {
    await expect(
      removeRequest(createConfig('https://example.com')),
    ).resolves.not.toThrow();
  });

  it('should handle multiple concurrent requests correctly', async () => {
    const config1 = createConfig('https://example1.com');
    const config2 = createConfig('https://example2.com');

    // Start concurrent requests
    const [controller1, controller2] = await Promise.all([
      addRequest(config1, 1000),
      addRequest(config2, 1000),
    ]);

    // Ensure controllers are retrieved correctly
    const [retrievedController1, retrievedController2] = await Promise.all([
      getController(config1),
      getController(config2),
    ]);

    expect(retrievedController1).toBe(controller1);
    expect(retrievedController2).toBe(controller2);

    // Cleanup
    await removeRequest(config1);
    await removeRequest(config2);
  });

  it('should handle concurrent requests with different configurations separately', async () => {
    const config1 = createConfig('https://example.com/a');
    const config2 = createConfig('https://example.com/b');

    // Add two concurrent requests with different configurations
    const [controller1, controller2] = await Promise.all([
      addRequest(config1, 2000),
      addRequest(config2, 2000),
    ]);

    jest.advanceTimersByTime(2000);

    expect(controller1).toBeDefined();
    expect(controller2).toBeDefined();
    expect(controller1).not.toBe(controller2);
  });

  it('should abort request due to timeout and remove it from queue', async () => {
    const config = createConfig('https://example.com');
    const timeout = 1000;

    // Add a request
    await addRequest(config, timeout);

    // Advance timers to simulate timeout
    jest.advanceTimersByTime(timeout);

    // Verify that the request was removed from the queue
    const controller = await getController(config);
    expect(controller).toBeUndefined(); // Ensure the request was removed

    // Ensure request removal
    await removeRequest(config);
  });

  it('should queue multiple operations on the same request config correctly', async () => {
    const config = createConfig('https://example.com');

    // Simulate a long-running first request
    const firstRequestPromise = addRequest(config, 2000);

    // Attempt to add a second request that should be queued
    const secondRequestPromise = addRequest(config, 2000);

    // Advance timers to simulate part of the delay for the first request
    jest.advanceTimersByTime(500);

    // Ensure the first request is being processed
    expect(await getController(config)).toBeTruthy();

    // Advance timers to complete the first request
    jest.advanceTimersByTime(1500);

    // Ensure both requests are resolved
    const firstRequestController = await firstRequestPromise;
    const secondRequestController = await secondRequestPromise;

    // Check that controllers are distinct if they are meant to be different requests
    // or the same if deduplication is in effect (depending on your implementation)
    expect(firstRequestController).not.toBe(secondRequestController);

    // Ensure the queue is empty after processing both requests
    expect(await getController(config)).toBeUndefined();
  });

  it('should clear timeout and abort request on removal', async () => {
    const configWithTimeout = createConfig('https://example.com');
    await addRequest(configWithTimeout, 1000);

    jest.advanceTimersByTime(1500);

    const retrievedController = await getController(configWithTimeout);

    expect(retrievedController).toBeUndefined();
  });

  it('should deduplicate same requests within dedupeTime', async () => {
    // Add a request to the queue
    const controller1 = await addRequest(mockConfig, 2000, 1000);

    // Trigger the same request within the dedupeTime
    const controller2 = await addRequest(mockConfig, 2000, 1000);

    jest.advanceTimersByTime(500);

    // Ensure that the same AbortController is reused
    expect(controller1).toBe(controller2);
  });

  it('should not deduplicate requests if dedupeTime is 0', async () => {
    // Add the first request
    const controller1 = await addRequest(mockConfig, 1000, 0);

    // Add the same request with dedupeTime 0
    const controller2 = await addRequest(mockConfig, 1000, 0);

    // Fast-forward time (though not necessary for 0 dedupeTime)
    jest.advanceTimersByTime(1000);

    // Ensure that two different AbortControllers are created
    expect(controller1).not.toBe(controller2);
  });

  it('should not abort the request when timeout is disabled', async () => {
    const controller = await addRequest(mockConfig, 0, 0, false, false);

    jest.advanceTimersByTime(1000);

    expect(controller.signal.aborted).toBe(false);
    await removeRequest(mockConfig, null);
  });

  it('should handle multiple distinct requests separately', async () => {
    const configA: RequestConfig = {
      url: 'https://example.com/a',
      method: 'GET',
    };
    const configB: RequestConfig = {
      url: 'https://example.com/b',
      method: 'GET',
    };

    // Add two distinct requests
    const controllerA = await addRequest(configA, 1000, 1000);
    const controllerB = await addRequest(configB, 1000, 1000);

    jest.advanceTimersByTime(1000);

    expect(controllerA).not.toBe(controllerB);
  });

  it('should handle both timeout and cancellation correctly', async () => {
    const config = createConfig('https://example.com');
    const timeout = 1000;

    // Add multiple requests
    const controller1 = await addRequest(config, timeout, 1000, true);
    const controller2 = await addRequest(config, timeout, 1000, true);

    // Advance timers to simulate timeout
    jest.advanceTimersByTime(timeout + 500);

    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(true);
  });

  it('should handle requests with the same configuration but different options correctly', async () => {
    const config = createConfig('https://example.com');
    const controller1 = await addRequest(config, 2000, 1000, true); // Cancellable
    const controller2 = await addRequest(config, 2000, 1000, false); // Not cancellable

    // Advance timers to simulate request handling
    jest.advanceTimersByTime(1500);

    // Check that the cancellable request was aborted and non-cancellable was not
    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(false);
  });

  it('should handle request configuration changes correctly', async () => {
    const config1 = createConfig('https://example.com');
    const config2 = createConfig('https://example.com');
    config2.method = 'POST'; // Change method to simulate different config

    // Add requests with different configurations
    const controller1 = await addRequest(config1, 2000, 1000);
    const controller2 = await addRequest(config2, 2000, 1000);

    // Advance timers to simulate request handling
    jest.advanceTimersByTime(1500);

    expect(controller1).not.toBe(controller2); // Different configurations should not deduplicate
    expect(controller1.signal.aborted).toBe(false);
    expect(controller2.signal.aborted).toBe(false);
  });

  it('should cancel all previous requests if they are cancellable and deduplication time is not yet passed', async () => {
    const controller1 = await addRequest(mockConfig, 2000, 1000, true);
    const controller2 = await addRequest(mockConfig, 2000, 1000, true);
    const controller3 = await addRequest(mockConfig, 2000, 1000, true);

    jest.advanceTimersByTime(500);

    expect(controller1).not.toBe(controller3);
    expect(controller2).not.toBe(controller3);
    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(true);
    expect(controller3.signal.aborted).toBe(false);
    expect(controller3).toBeInstanceOf(AbortController);

    jest.spyOn(Date, 'now').mockRestore();
    await removeRequest(mockConfig);
  });

  it('should cancel all previous requests if they are cancellable and deduplication time is passed', async () => {
    const controller1 = await addRequest(mockConfig, 2000, 1000, true);
    const controller2 = await addRequest(mockConfig, 2000, 1000, true);
    const controller3 = await addRequest(mockConfig, 2000, 1000, true);

    jest.advanceTimersByTime(1500);

    expect(controller1).not.toBe(controller3);
    expect(controller2).not.toBe(controller3);
    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(true);
    expect(controller3.signal.aborted).toBe(false);
    expect(controller3).toBeInstanceOf(AbortController);

    jest.spyOn(Date, 'now').mockRestore();
    await removeRequest(mockConfig);
  });

  it('should cancel all requests if they are cancellable and timeout is passed', async () => {
    const controller1 = await addRequest(mockConfig, 2000, 1000, true);
    const controller2 = await addRequest(mockConfig, 2000, 1000, true);
    const controller3 = await addRequest(mockConfig, 2000, 1000, true);

    jest.advanceTimersByTime(2500);

    expect(controller1).not.toBe(controller3);
    expect(controller2).not.toBe(controller3);
    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(true);
    expect(controller3.signal.aborted).toBe(true);
    expect(controller3).toBeInstanceOf(AbortController);

    jest.spyOn(Date, 'now').mockRestore();
    await removeRequest(mockConfig);
  });

  it('should not cancel any request if not cancellable and deduplication time is not yet passed', async () => {
    const controller1 = await addRequest(mockConfig, 2000, 1000, false);
    const controller2 = await addRequest(mockConfig, 2000, 1000, false);
    const controller3 = await addRequest(mockConfig, 2000, 1000, false);

    jest.advanceTimersByTime(500);

    expect(controller1).toBe(controller3);
    expect(controller2).toBe(controller3);
    expect(controller1.signal.aborted).toBe(false);
    expect(controller2.signal.aborted).toBe(false);
    expect(controller3.signal.aborted).toBe(false);
    expect(controller3).toBeInstanceOf(AbortController);

    jest.spyOn(Date, 'now').mockRestore();
    await removeRequest(mockConfig);
  });

  it('should not cancel any request if not cancellable and deduplication time is passed for each request', async () => {
    const controller1 = await addRequest(mockConfig, 20000, 1000, false);
    jest.advanceTimersByTime(1500);
    const controller2 = await addRequest(mockConfig, 20000, 1000, false);
    jest.advanceTimersByTime(1500);
    const controller3 = await addRequest(mockConfig, 20000, 1000, false);
    jest.advanceTimersByTime(1500);

    expect(controller1).not.toBe(controller3);
    expect(controller1).not.toBe(controller2);
    expect(controller2).not.toBe(controller3);
    expect(controller1.signal.aborted).toBe(false);
    expect(controller2.signal.aborted).toBe(false);
    expect(controller3.signal.aborted).toBe(false);
    expect(controller3).toBeInstanceOf(AbortController);

    jest.spyOn(Date, 'now').mockRestore();
    await removeRequest(mockConfig);
  });

  it('should not cancel the previous requests if they are not cancellable', async () => {
    const controller1 = await addRequest(mockConfig, 2000, 1000, false);

    jest.advanceTimersByTime(1500);

    const controller2 = await addRequest(mockConfig, 2000, 1000, true);

    expect(controller1).not.toBe(controller2);
    expect(controller1.signal.aborted).toBe(false);
    expect(controller2.signal.aborted).toBe(false);
    expect(controller2).toBeInstanceOf(AbortController);

    jest.spyOn(Date, 'now').mockRestore();
    await removeRequest(mockConfig);
  });
});
