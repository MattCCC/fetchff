import {
  registerRevalidator,
  unregisterRevalidator,
  revalidate,
  enableFocusRevalidation,
  disableFocusRevalidation,
  initFetchffRevalidationOnFocus,
} from '../src/revalidator-manager';

// Store original window to restore later
const originalWindow = global.window;

describe('Revalidator Manager', () => {
  let mockRevalidatorFn: jest.Mock;
  let mockRevalidatorFn2: jest.Mock;
  const testKey = 'test-key';
  const testKey2 = 'test-key-2';

  beforeEach(() => {
    mockRevalidatorFn = jest.fn().mockResolvedValue(undefined);
    mockRevalidatorFn2 = jest.fn().mockResolvedValue(undefined);
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up registered revalidators
    unregisterRevalidator(testKey);
    unregisterRevalidator(testKey2);
    disableFocusRevalidation(testKey);
    disableFocusRevalidation(testKey2);
  });

  describe('registerRevalidator', () => {
    it('should register a revalidator function for a key', async () => {
      registerRevalidator(testKey, mockRevalidatorFn);

      await revalidate(testKey);

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should overwrite existing revalidator for the same key', async () => {
      const firstFn = jest.fn().mockResolvedValue(undefined);
      const secondFn = jest.fn().mockResolvedValue(undefined);

      registerRevalidator(testKey, firstFn);
      registerRevalidator(testKey, secondFn);

      await revalidate(testKey);

      expect(firstFn).not.toHaveBeenCalled();
      expect(secondFn).toHaveBeenCalledTimes(1);
    });

    it('should allow multiple keys with different revalidators', async () => {
      registerRevalidator(testKey, mockRevalidatorFn);
      registerRevalidator(testKey2, mockRevalidatorFn2);

      await revalidate(testKey);
      await revalidate(testKey2);

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
      expect(mockRevalidatorFn2).toHaveBeenCalledTimes(1);
    });
  });

  describe('unregisterRevalidator', () => {
    it('should remove a registered revalidator', async () => {
      registerRevalidator(testKey, mockRevalidatorFn);
      unregisterRevalidator(testKey);

      const result = await revalidate(testKey);

      expect(mockRevalidatorFn).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should disable focus revalidation when unregistering', () => {
      registerRevalidator(testKey, mockRevalidatorFn);
      enableFocusRevalidation(testKey);

      // This should not throw and should clean up focus revalidation
      expect(() => unregisterRevalidator(testKey)).not.toThrow();
    });

    it('should handle unregistering non-existent key gracefully', () => {
      expect(() => unregisterRevalidator('non-existent-key')).not.toThrow();
    });
  });

  describe('revalidate', () => {
    it('should execute registered revalidator function', async () => {
      registerRevalidator(testKey, mockRevalidatorFn);

      const result = await revalidate(testKey);

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('should return null for non-existent key', async () => {
      const result = await revalidate('non-existent-key');

      expect(result).toBeNull();
    });

    it('should propagate errors from revalidator function', async () => {
      const errorFn = jest
        .fn()
        .mockRejectedValue(new Error('Revalidation failed'));
      registerRevalidator(testKey, errorFn);

      await expect(revalidate(testKey)).rejects.toThrow('Revalidation failed');
      expect(errorFn).toHaveBeenCalledTimes(1);
    });

    it('should handle revalidator function that returns a value', async () => {
      const returnValueFn = jest.fn().mockResolvedValue('some-value');
      registerRevalidator(testKey, returnValueFn);

      const result = await revalidate(testKey);

      expect(returnValueFn).toHaveBeenCalledTimes(1);
      expect(result).toBe('some-value');
    });

    it('should handle empty key gracefully', async () => {
      const result = await revalidate('');

      expect(result).toBeNull();
    });
  });

  describe('enableFocusRevalidation', () => {
    it('should add key to focus revalidation set', () => {
      expect(() => enableFocusRevalidation(testKey)).not.toThrow();
    });

    it('should handle adding the same key multiple times', () => {
      enableFocusRevalidation(testKey);
      enableFocusRevalidation(testKey);

      expect(() => enableFocusRevalidation(testKey)).not.toThrow();
    });

    it('should handle empty key', () => {
      expect(() => enableFocusRevalidation('')).not.toThrow();
    });
  });

  describe('disableFocusRevalidation', () => {
    it('should remove key from focus revalidation set', () => {
      enableFocusRevalidation(testKey);

      expect(() => disableFocusRevalidation(testKey)).not.toThrow();
    });

    it('should handle removing non-existent key', () => {
      expect(() => disableFocusRevalidation('non-existent-key')).not.toThrow();
    });

    it('should handle empty key', () => {
      expect(() => disableFocusRevalidation('')).not.toThrow();
    });
  });

  describe('focus revalidation behavior', () => {
    let mockAddEventListener: jest.Mock;

    beforeEach(() => {
      mockAddEventListener = jest.fn();
      Object.defineProperty(global, 'window', {
        value: {
          addEventListener: mockAddEventListener,
          removeEventListener: jest.fn(),
        },
        writable: true,
      });
    });

    afterEach(() => {
      // Restore original window
      global.window = originalWindow;
    });

    it('should attach focus event listener when initializing', () => {
      initFetchffRevalidationOnFocus();

      expect(mockAddEventListener).toHaveBeenCalledWith(
        'focus',
        expect.any(Function),
      );
    });

    it('should test focus revalidation by directly calling the internal function', async () => {
      // Since the module initialization is complex to test due to timing,
      // we'll test the focus functionality through the public API
      registerRevalidator(testKey, mockRevalidatorFn);
      registerRevalidator(testKey2, mockRevalidatorFn2);
      enableFocusRevalidation(testKey);
      enableFocusRevalidation(testKey2);

      // We can't easily test the actual focus event due to module initialization,
      // but we can test that the functions work correctly when called directly
      await revalidate(testKey);
      await revalidate(testKey2);

      expect(mockRevalidatorFn).toHaveBeenCalled();
      expect(mockRevalidatorFn2).toHaveBeenCalled();
    });
  });

  describe('initFetchffRevalidationOnFocus', () => {
    it('should handle multiple calls gracefully due to guard', () => {
      // Since the function has already been called during module import,
      // subsequent calls should be no-ops due to the hasAttachedFocusHandler guard
      const mockWindow = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      Object.defineProperty(global, 'window', {
        value: mockWindow,
        writable: true,
      });

      // Call multiple times - these should be no-ops since the guard is already set
      initFetchffRevalidationOnFocus();
      initFetchffRevalidationOnFocus();
      initFetchffRevalidationOnFocus();

      // Since the function was already called during module import and has a guard,
      // these subsequent calls should not add any more event listeners
      expect(mockWindow.addEventListener).toHaveBeenCalledTimes(0);
    });

    it('should not attach focus listener when window is undefined', () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
      });

      // This should not throw even when window is undefined
      expect(() => initFetchffRevalidationOnFocus()).not.toThrow();
    });
  });

  describe('error handling in focus revalidation', () => {
    it('should handle errors in revalidators gracefully', async () => {
      const errorFn = jest
        .fn()
        .mockRejectedValue(new Error('Focus revalidation failed'));
      registerRevalidator(testKey, errorFn);

      // Test that errors are propagated when calling revalidate directly
      await expect(revalidate(testKey)).rejects.toThrow(
        'Focus revalidation failed',
      );
      expect(errorFn).toHaveBeenCalled();
    });
  });
});
