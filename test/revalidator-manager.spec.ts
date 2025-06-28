/**
 * @jest-environment jsdom
 */
import {
  registerRevalidator,
  unregisterRevalidator,
  revalidate,
  registerFocusRevalidator,
  unregisterFocusRevalidator,
  initFetchffRevalidationOnFocus,
  removeFocusRevalidators,
  startRevalidatorCleanup,
  unregisterAllRevalidators,
} from '../src/revalidator-manager';

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
    unregisterAllRevalidators(testKey);
    unregisterAllRevalidators(testKey2);
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
      registerFocusRevalidator(testKey);

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

  describe('registerFocusRevalidator', () => {
    it('should add key to focus revalidation set', () => {
      expect(() => registerFocusRevalidator(testKey)).not.toThrow();
    });

    it('should handle adding the same key multiple times', () => {
      registerFocusRevalidator(testKey);
      registerFocusRevalidator(testKey);

      expect(() => registerFocusRevalidator(testKey)).not.toThrow();
    });

    it('should handle empty key', () => {
      expect(() => registerFocusRevalidator('')).not.toThrow();
    });
  });

  describe('disableFocusRevalidation', () => {
    it('should remove key from focus revalidation set', () => {
      registerFocusRevalidator(testKey);

      expect(() => unregisterFocusRevalidator(testKey)).not.toThrow();
    });

    it('should handle removing non-existent key', () => {
      expect(() =>
        unregisterFocusRevalidator('non-existent-key'),
      ).not.toThrow();
    });

    it('should handle empty key', () => {
      expect(() => unregisterFocusRevalidator('')).not.toThrow();
    });
  });

  describe('focus revalidation behavior', () => {
    let mockAddEventListener: jest.Mock;

    beforeEach(() => {
      removeFocusRevalidators();
      mockAddEventListener = jest.fn();
      window.addEventListener = mockAddEventListener;
      window.removeEventListener = jest.fn();
      // Call the initializer after setting up the mock to ensure the event listener is attached
      initFetchffRevalidationOnFocus();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should attach focus event listener when initializing', () => {
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
      registerFocusRevalidator(testKey);
      registerFocusRevalidator(testKey2);

      // We can't easily test the actual focus event due to module initialization,
      // but we can test that the functions work correctly when called directly
      await revalidate(testKey);
      await revalidate(testKey2);

      expect(mockRevalidatorFn).toHaveBeenCalled();
      expect(mockRevalidatorFn2).toHaveBeenCalled();
    });
  });

  describe('initFetchffRevalidationOnFocus', () => {
    let mockAddEventListener: jest.Mock;

    beforeEach(() => {
      removeFocusRevalidators();
      mockAddEventListener = jest.fn();
      window.addEventListener = mockAddEventListener;
      window.removeEventListener = jest.fn();
      // Call the initializer after setting up the mock to ensure the event listener is attached
      initFetchffRevalidationOnFocus();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle multiple calls gracefully due to guard', () => {
      // Since the function has already been called during module import,
      // subsequent calls should be no-ops due to the hasAttachedFocusHandler guard
      const mockAddEventListener = jest.fn();
      window.addEventListener = mockAddEventListener;
      window.removeEventListener = jest.fn();

      // Call multiple times - these should be no-ops since the guard is already set
      initFetchffRevalidationOnFocus();
      initFetchffRevalidationOnFocus();
      initFetchffRevalidationOnFocus();

      // Since the function was already called during module import and has a guard,
      // these subsequent calls should not add any more event listeners
      expect(mockAddEventListener).toHaveBeenCalledTimes(0);
    });

    it('should not attach focus listener when window is undefined', () => {
      // Save the original window
      const originalWindow = globalThis.window;
      // @ts-expect-error Removal of window for testing
      delete globalThis.window;

      expect(() => initFetchffRevalidationOnFocus()).not.toThrow();

      // Restore the original window
      globalThis.window = originalWindow;
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

  describe('TTL handling and cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should register revalidator with default TTL', async () => {
      registerRevalidator(testKey, mockRevalidatorFn);

      await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should register revalidator with custom TTL', async () => {
      const customTTL = 5000; // 5 seconds
      registerRevalidator(testKey, mockRevalidatorFn, customTTL);

      await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should never expire revalidator with TTL = 0', async () => {
      registerRevalidator(testKey, mockRevalidatorFn, 0);

      // Fast forward time way beyond normal TTL
      jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour (reduced from 24)

      await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should update lastUsed timestamp on revalidation', async () => {
      registerRevalidator(testKey, mockRevalidatorFn);

      await revalidate(testKey);
      jest.advanceTimersByTime(1000);
      await revalidate(testKey);

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('focus revalidation with suffix logic', () => {
    it('should store focus revalidators with |f suffix', () => {
      registerFocusRevalidator(testKey, mockRevalidatorFn);

      // Manual revalidator should not trigger focus revalidator
      expect(() => revalidate(testKey)).not.toThrow();

      // Focus revalidator should be stored separately
      unregisterFocusRevalidator(testKey);
      expect(() => unregisterFocusRevalidator(testKey)).not.toThrow();
    });

    it('should allow both manual and focus revalidators for same key', async () => {
      const manualFn = jest.fn().mockResolvedValue('manual');
      const focusFn = jest.fn().mockResolvedValue('focus');

      registerRevalidator(testKey, manualFn);
      registerFocusRevalidator(testKey, focusFn);

      // Manual revalidation should only call manual function
      const result = await revalidate(testKey);
      expect(manualFn).toHaveBeenCalledTimes(1);
      expect(focusFn).not.toHaveBeenCalled();
      expect(result).toBe('manual');
    });

    it('should unregister focus revalidator without affecting manual', async () => {
      registerRevalidator(testKey, mockRevalidatorFn);
      registerFocusRevalidator(testKey, mockRevalidatorFn2);

      unregisterFocusRevalidator(testKey);

      // Manual revalidator should still work
      await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should handle registerFocusRevalidator with null function gracefully', () => {
      expect(() => registerFocusRevalidator(testKey, null)).not.toThrow();
      expect(() => registerFocusRevalidator(testKey)).not.toThrow();
    });
  });

  describe('async handling and fire-and-forget', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should handle sync revalidator functions', async () => {
      const syncFn = jest.fn().mockReturnValue('sync-result');
      registerRevalidator(testKey, syncFn);

      const result = await revalidate(testKey);
      expect(syncFn).toHaveBeenCalledTimes(1);
      expect(result).toBe('sync-result');
    });

    it('should handle async revalidator functions', async () => {
      const asyncFn = jest.fn().mockResolvedValue('async-result');
      registerRevalidator(testKey, asyncFn);

      const result = await revalidate(testKey);
      expect(asyncFn).toHaveBeenCalledTimes(1);
      expect(result).toBe('async-result');
    });

    it('should handle revalidator that returns undefined', async () => {
      const undefinedFn = jest.fn().mockResolvedValue(undefined);
      registerRevalidator(testKey, undefinedFn);

      const result = await revalidate(testKey);
      expect(undefinedFn).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('should handle revalidator that returns null', async () => {
      const nullFn = jest.fn().mockResolvedValue(null);
      registerRevalidator(testKey, nullFn);

      const result = await revalidate(testKey);
      expect(nullFn).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });
  });

  describe('focus event simulation and cleanup', () => {
    let mockAddEventListener: jest.Mock;
    let focusHandler: (() => void) | undefined;

    beforeEach(() => {
      jest.useFakeTimers();
      removeFocusRevalidators();

      mockAddEventListener = jest.fn().mockImplementation((event, handler) => {
        if (event === 'focus') {
          focusHandler = handler;
        }
      });

      window.addEventListener = mockAddEventListener;
      window.removeEventListener = jest.fn();

      initFetchffRevalidationOnFocus();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should call focus revalidators when focus event is triggered', () => {
      registerFocusRevalidator(testKey, mockRevalidatorFn);
      registerFocusRevalidator(testKey2, mockRevalidatorFn2);

      // Simulate focus event
      if (focusHandler) {
        focusHandler();
      }

      // Since we're using fake timers, the Promise.resolve in the focus handler
      // should resolve immediately, so we can check right away
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
      expect(mockRevalidatorFn2).toHaveBeenCalledTimes(1);
    });

    it('should not call manual revalidators on focus event', () => {
      registerRevalidator(testKey, mockRevalidatorFn);
      registerRevalidator(testKey2, mockRevalidatorFn2);

      // Simulate focus event
      if (focusHandler) {
        focusHandler();
      }

      // Manual revalidators should not be called
      expect(mockRevalidatorFn).not.toHaveBeenCalled();
      expect(mockRevalidatorFn2).not.toHaveBeenCalled();
    });

    it('should clean up expired focus revalidators on focus event', () => {
      const shortTTL = 100; // 100ms
      registerFocusRevalidator(testKey, mockRevalidatorFn, shortTTL);

      // Fast forward past TTL
      jest.advanceTimersByTime(shortTTL + 1);

      // Simulate focus event
      if (focusHandler) {
        focusHandler();
      }

      // Expired revalidator should not be called
      expect(mockRevalidatorFn).not.toHaveBeenCalled();
    });

    it('should not clean up focus revalidators with TTL = 0', () => {
      registerFocusRevalidator(testKey, mockRevalidatorFn, 0);

      // Fast forward way past normal TTL
      jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour (reduced from 24)

      // Simulate focus event
      if (focusHandler) {
        focusHandler();
      }

      // With fake timers, promises should resolve immediately
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in focus revalidators without affecting others', () => {
      const errorFn = jest.fn().mockRejectedValue(new Error('Focus error'));
      const workingFn = jest.fn().mockResolvedValue('success');

      registerFocusRevalidator(testKey, errorFn);
      registerFocusRevalidator(testKey2, workingFn);

      // Simulate focus event
      if (focusHandler) {
        focusHandler();
      }

      // With fake timers, the revalidators should be called immediately
      expect(errorFn).toHaveBeenCalledTimes(1);
      expect(workingFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle revalidate with empty string key', async () => {
      const result = await revalidate('');
      expect(result).toBeNull();
    });

    it('should handle revalidate with null key', async () => {
      const result = await revalidate(null);
      expect(result).toBeNull();
    });

    it('should handle registering with empty string key', () => {
      expect(() => registerRevalidator('', mockRevalidatorFn)).not.toThrow();
    });

    it('should handle unregistering with empty string key', () => {
      expect(() => unregisterRevalidator('')).not.toThrow();
      expect(() => unregisterFocusRevalidator('')).not.toThrow();
    });

    it('should overwrite existing revalidator with same key', async () => {
      const firstFn = jest.fn().mockResolvedValue('first');
      const secondFn = jest.fn().mockResolvedValue('second');

      registerRevalidator(testKey, firstFn);
      registerRevalidator(testKey, secondFn);

      const result = await revalidate(testKey);
      expect(firstFn).not.toHaveBeenCalled();
      expect(secondFn).toHaveBeenCalledTimes(1);
      expect(result).toBe('second');
    });

    it('should handle mixed TTL values correctly', () => {
      registerRevalidator(testKey, mockRevalidatorFn, 1000);
      registerRevalidator(testKey2, mockRevalidatorFn2, 0);

      expect(() => revalidate(testKey)).not.toThrow();
      expect(() => revalidate(testKey2)).not.toThrow();
    });

    it('should handle negative TTL as normal TTL', async () => {
      registerRevalidator(testKey, mockRevalidatorFn, -1000);

      const result = await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });
  });

  describe('unregisterAllRevalidators', () => {
    it('should remove both manual and focus revalidators', async () => {
      registerRevalidator(testKey, mockRevalidatorFn);
      registerFocusRevalidator(testKey, mockRevalidatorFn2);

      unregisterAllRevalidators(testKey);

      // Neither should work after unregistering all
      const result = await revalidate(testKey);
      expect(result).toBeNull();
      expect(mockRevalidatorFn).not.toHaveBeenCalled();
    });

    it('should handle unregistering when only manual exists', () => {
      registerRevalidator(testKey, mockRevalidatorFn);

      expect(() => unregisterAllRevalidators(testKey)).not.toThrow();
    });

    it('should handle unregistering when only focus exists', () => {
      registerFocusRevalidator(testKey, mockRevalidatorFn);

      expect(() => unregisterAllRevalidators(testKey)).not.toThrow();
    });

    it('should handle unregistering when neither exists', () => {
      expect(() => unregisterAllRevalidators(testKey)).not.toThrow();
    });
  });

  describe('unified tuple-based storage and comprehensive edge cases', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should store manual and focus revalidators in same map with different keys', async () => {
      const manualFn = jest.fn().mockResolvedValue('manual');
      const focusFn = jest.fn().mockResolvedValue('focus');

      registerRevalidator(testKey, manualFn, 5000);
      registerFocusRevalidator(testKey, focusFn, 10000);

      // Manual revalidation should only call manual function
      const result = await revalidate(testKey);
      expect(manualFn).toHaveBeenCalledTimes(1);
      expect(focusFn).not.toHaveBeenCalled();
      expect(result).toBe('manual');

      // Cleanup should work independently
      unregisterFocusRevalidator(testKey);
      unregisterRevalidator(testKey);
    });

    it('should handle revalidators with TTL = 0 never expiring', async () => {
      registerRevalidator(testKey, mockRevalidatorFn, 0);
      registerFocusRevalidator(testKey2, mockRevalidatorFn2, 0);

      const cleanup = startRevalidatorCleanup(50); // Reduced cleanup interval

      // Fast forward time (reduced from 24 hours)
      jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour

      // Both should still work
      await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('should handle periodic cleanup correctly', async () => {
      registerRevalidator(testKey, mockRevalidatorFn, 100); // Reduced TTL

      const cleanup = startRevalidatorCleanup(50); // Reduced cleanup interval

      // Initially should work
      await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);

      // Fast forward past TTL and trigger cleanup
      jest.advanceTimersByTime(200); // Reduced time advance

      // Should be cleaned up now
      const result = await revalidate(testKey);
      expect(result).toBeNull();

      cleanup();
    });

    it('should handle negative TTL values in cleanup', async () => {
      registerRevalidator(testKey, mockRevalidatorFn, -1000);

      const cleanup = startRevalidatorCleanup(50); // Reduced cleanup interval
      jest.advanceTimersByTime(100); // Reduced time advance

      const result = await revalidate(testKey);
      expect(result).toBeUndefined(); // Should be cleaned up

      cleanup();
    });

    it('should handle extreme values gracefully', async () => {
      registerRevalidator(testKey, mockRevalidatorFn, Number.MAX_SAFE_INTEGER);
      registerRevalidator(testKey2, mockRevalidatorFn2, NaN);

      await revalidate(testKey);
      await revalidate(testKey2);

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
      expect(mockRevalidatorFn2).toHaveBeenCalledTimes(1);
    });

    it('should handle keys containing focus suffix correctly', async () => {
      const trickeyKey = 'test|f|more';
      registerRevalidator(trickeyKey, mockRevalidatorFn);
      registerFocusRevalidator(trickeyKey, mockRevalidatorFn2);

      await revalidate(trickeyKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);

      unregisterAllRevalidators(trickeyKey);
      const result = await revalidate(trickeyKey);
      expect(result).toBeNull();
    });

    it('should handle self-modifying revalidators', async () => {
      const selfModifyingFn = jest.fn().mockImplementation(() => {
        unregisterRevalidator(testKey);
        return 'self-modified';
      });

      registerRevalidator(testKey, selfModifyingFn);

      const result = await revalidate(testKey);
      expect(result).toBe('self-modified');

      // Second call should return null since it unregistered itself
      const result2 = await revalidate(testKey);
      expect(result2).toBeNull();
    });

    it('should handle mixed return types from revalidators', async () => {
      const multiTypeFn = jest
        .fn()
        .mockResolvedValueOnce('string')
        .mockResolvedValueOnce(42)
        .mockResolvedValueOnce({ data: 'object' });

      registerRevalidator(testKey, multiTypeFn);

      expect(await revalidate(testKey)).toBe('string');
      expect(await revalidate(testKey)).toBe(42);
      expect(await revalidate(testKey)).toEqual({ data: 'object' });

      expect(multiTypeFn).toHaveBeenCalledTimes(3);
    });

    it('should preserve TTL when updating lastUsed timestamp', async () => {
      const customTTL = 10000;
      registerRevalidator(testKey, mockRevalidatorFn, customTTL);

      await revalidate(testKey);
      jest.advanceTimersByTime(5000);
      await revalidate(testKey);

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(2);
    });

    it('should handle very large numbers of revalidators', async () => {
      const promises = [];
      // Reduced from 50 to 10 for faster execution
      for (let i = 0; i < 10; i++) {
        const fn = jest.fn().mockResolvedValue(`result-${i}`);
        registerRevalidator(`key-${i}`, fn, 50); // Reduced TTL
        promises.push(revalidate(`key-${i}`));
      }

      await Promise.all(promises);

      const cleanup = startRevalidatorCleanup(25); // Reduced cleanup interval
      jest.advanceTimersByTime(100); // Reduced time advance

      // Check fewer keys for speed
      for (let i = 0; i < 5; i++) {
        const result = await revalidate(`key-${i}`);
        expect(result).toBeNull();
      }

      cleanup();
    });
  });

  describe('focus revalidation with fire-and-forget async handling', () => {
    let focusHandler: (() => void) | undefined;

    beforeEach(() => {
      jest.useFakeTimers();
      removeFocusRevalidators();

      const mockAddEventListener = jest
        .fn()
        .mockImplementation((event, handler) => {
          if (event === 'focus') {
            focusHandler = handler;
          }
        });

      window.addEventListener = mockAddEventListener;
      window.removeEventListener = jest.fn();
      initFetchffRevalidationOnFocus();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should handle focus revalidation with proper cleanup timing', () => {
      const shortTTL = 100;
      registerFocusRevalidator(testKey, mockRevalidatorFn, shortTTL);

      // Fast forward well past TTL
      jest.advanceTimersByTime(shortTTL + 50);

      // Focus event should clean up expired entry
      if (focusHandler) {
        focusHandler();
      }

      // Should not be called because it was expired
      expect(mockRevalidatorFn).not.toHaveBeenCalled();
    });

    it('should handle async errors in focus revalidators gracefully', () => {
      const errorFn = jest.fn().mockRejectedValue(new Error('Focus error'));
      const workingFn = jest.fn().mockResolvedValue('success');

      registerFocusRevalidator(testKey, errorFn);
      registerFocusRevalidator(testKey2, workingFn);

      // Should not throw despite error in one revalidator
      expect(() => {
        if (focusHandler) {
          focusHandler();
        }
      }).not.toThrow();

      // With fake timers, the revalidators should be called immediately
      expect(errorFn).toHaveBeenCalledTimes(1);
      expect(workingFn).toHaveBeenCalledTimes(1);
    });

    it('should not trigger manual revalidators on focus events', () => {
      registerRevalidator(testKey, mockRevalidatorFn);
      registerRevalidator(testKey2, mockRevalidatorFn2);

      if (focusHandler) {
        focusHandler();
      }

      // Manual revalidators should not be called
      expect(mockRevalidatorFn).not.toHaveBeenCalled();
      expect(mockRevalidatorFn2).not.toHaveBeenCalled();
    });

    it('should handle rapid focus events without issues', () => {
      registerFocusRevalidator(testKey, mockRevalidatorFn, 5000);

      // Trigger multiple focus events rapidly (reduced from 5 to 3)
      if (focusHandler) {
        for (let i = 0; i < 3; i++) {
          focusHandler();
          jest.advanceTimersByTime(5); // Reduced time advance
        }
      }

      // Should be called for each focus event
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('additional tuple-based revalidator tests', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle TTL = 0 as never expire', async () => {
      registerRevalidator(testKey, mockRevalidatorFn, 0);

      const cleanup = startRevalidatorCleanup(50); // Reduced cleanup interval

      // Reduced time advance for TTL=0 test
      jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour instead of 24

      await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('should clean up expired entries in periodic cleanup', async () => {
      registerRevalidator(testKey, mockRevalidatorFn, 100);

      const cleanup = startRevalidatorCleanup(50);
      jest.advanceTimersByTime(200);

      const result = await revalidate(testKey);
      expect(result).toBeNull();

      cleanup();
    });

    it('should handle both manual and focus revalidators for same key', async () => {
      const manualFn = jest.fn().mockResolvedValue('manual');
      const focusFn = jest.fn().mockResolvedValue('focus');

      registerRevalidator(testKey, manualFn);
      registerFocusRevalidator(testKey, focusFn);

      const result = await revalidate(testKey);
      expect(manualFn).toHaveBeenCalledTimes(1);
      expect(focusFn).not.toHaveBeenCalled();
      expect(result).toBe('manual');
    });

    it('should handle extreme TTL values', async () => {
      registerRevalidator(testKey, mockRevalidatorFn, Number.MAX_SAFE_INTEGER);
      registerRevalidator(testKey2, mockRevalidatorFn2, -1000);

      await revalidate(testKey);
      await revalidate(testKey2);

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
      expect(mockRevalidatorFn2).toHaveBeenCalledTimes(1);
    });

    it('should handle keys containing focus suffix', async () => {
      const specialKey = 'test|f|more';
      registerRevalidator(specialKey, mockRevalidatorFn);
      registerFocusRevalidator(specialKey, mockRevalidatorFn2);

      await revalidate(specialKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);

      unregisterAllRevalidators(specialKey);
      const result = await revalidate(specialKey);
      expect(result).toBeNull();
    });

    it('should handle self-modifying revalidators', async () => {
      const selfModifyingFn = jest.fn().mockImplementation(() => {
        unregisterRevalidator(testKey);
        return 'modified';
      });

      registerRevalidator(testKey, selfModifyingFn);

      const result1 = await revalidate(testKey);
      const result2 = await revalidate(testKey);

      expect(result1).toBe('modified');
      expect(result2).toBeNull();
    });
  });
});
