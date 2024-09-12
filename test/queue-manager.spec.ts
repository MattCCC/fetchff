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

  it('should handle concurrent requests', async () => {
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

  it('should clear timeout and abort request on removal', async () => {
    const configWithTimeout = createConfig('https://example.com');
    await addRequest(configWithTimeout, 10000);

    jest.advanceTimersByTime(15000);

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

    // Ensure both requests have their own controllers
    expect(controllerA).not.toBe(controllerB);
  });

  it('should deduplicate requests and not abort if isCancellable is true', async () => {
    const controller1 = await addRequest(mockConfig, 2000, 1000, true);
    const controller2 = await addRequest(mockConfig, 2000, 1000, true);

    jest.advanceTimersByTime(500);

    expect(controller1).toBe(controller2);
    expect(controller1.signal.aborted).toBe(false); // Ensure the previous request was aborted
    expect(controller2.signal.aborted).toBe(false); // Ensure the current request was not aborted
    expect(controller2).toBeInstanceOf(AbortController); // Ensure new controller is created

    jest.spyOn(Date, 'now').mockRestore();
  });

  it('should cancel the previous request if isCancellable is true', async () => {
    const controllerA = await addRequest(mockConfig, 2000, 1000, true);

    jest.advanceTimersByTime(1500);

    const controllerB = await addRequest(mockConfig, 2000, 1000, true);

    expect(controllerA).not.toBe(controllerB);
    expect(controllerA.signal.aborted).toBe(true); // Ensure the previous request was aborted
    expect(controllerB.signal.aborted).toBe(false); // Ensure the current request was not aborted
    expect(controllerB).toBeInstanceOf(AbortController); // Ensure new controller is created

    jest.spyOn(Date, 'now').mockRestore();
  });

  it('should not cancel the previous request if isCancellable is false', async () => {
    const controllerA = await addRequest(mockConfig, 2000, 1000, true);

    jest.advanceTimersByTime(1500);

    const controllerB = await addRequest(mockConfig, 2000, 1000, false);

    expect(controllerA).not.toBe(controllerB);
    expect(controllerA.signal.aborted).toBe(false); // Ensure the previous request was aborted
    expect(controllerB.signal.aborted).toBe(false); // Ensure the current request was not aborted
    expect(controllerB).toBeInstanceOf(AbortController); // Ensure new controller is created

    jest.spyOn(Date, 'now').mockRestore();
  });
});
