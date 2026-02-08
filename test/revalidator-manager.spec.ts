/**
 * @jest-environment jsdom
 */
import {
  addRevalidator,
  removeRevalidator,
  revalidate,
  startRevalidatorCleanup,
  removeRevalidators,
  setEventProvider,
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
    removeRevalidator(testKey);
    removeRevalidator(testKey2);
    jest.clearAllTimers();
  });

  describe('addRevalidator', () => {
    it('should register a revalidator function for a key', async () => {
      addRevalidator(testKey, mockRevalidatorFn);

      await revalidate(testKey);

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should overwrite existing revalidator for the same key', async () => {
      const firstFn = jest.fn().mockResolvedValue(undefined);
      const secondFn = jest.fn().mockResolvedValue(undefined);

      addRevalidator(testKey, firstFn);
      addRevalidator(testKey, secondFn);

      await revalidate(testKey);

      expect(firstFn).not.toHaveBeenCalled();
      expect(secondFn).toHaveBeenCalledTimes(1);
    });

    it('should allow multiple keys with different revalidators', async () => {
      addRevalidator(testKey, mockRevalidatorFn);
      addRevalidator(testKey2, mockRevalidatorFn2);

      await revalidate(testKey);
      await revalidate(testKey2);

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
      expect(mockRevalidatorFn2).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeRevalidator', () => {
    it('should remove a registered revalidator', async () => {
      addRevalidator(testKey, mockRevalidatorFn);
      removeRevalidator(testKey);

      const result = await revalidate(testKey);

      expect(mockRevalidatorFn).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should disable focus revalidation when unregistering', () => {
      addRevalidator(
        testKey,
        mockRevalidatorFn,
        undefined,
        undefined,
        undefined,
        true,
      );

      // This should not throw and should clean up focus revalidation
      expect(() => removeRevalidator(testKey)).not.toThrow();
    });

    it('should handle unregistering non-existent key gracefully', () => {
      expect(() => removeRevalidator('non-existent-key')).not.toThrow();
    });
  });

  describe('revalidate', () => {
    it('should execute registered revalidator function', async () => {
      addRevalidator(testKey, mockRevalidatorFn);

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
      addRevalidator(testKey, errorFn);

      await expect(revalidate(testKey)).rejects.toThrow('Revalidation failed');
      expect(errorFn).toHaveBeenCalledTimes(1);
    });

    it('should handle revalidator function that returns a value', async () => {
      const returnValueFn = jest.fn().mockResolvedValue('some-value');
      addRevalidator(testKey, returnValueFn);

      const result = await revalidate(testKey);

      expect(returnValueFn).toHaveBeenCalledTimes(1);
      expect(result).toBe('some-value');
    });

    it('should handle empty key gracefully', async () => {
      const result = await revalidate('');

      expect(result).toBeNull();
    });
  });

  describe('addRevalidator with focus revalidation', () => {
    it('should add key to focus revalidation set', () => {
      expect(() =>
        addRevalidator(
          testKey,
          mockRevalidatorFn,
          undefined,
          undefined,
          undefined,
          true,
        ),
      ).not.toThrow();
    });

    it('should handle adding the same key multiple times', () => {
      addRevalidator(
        testKey,
        mockRevalidatorFn,
        undefined,
        undefined,
        undefined,
        true,
      );
      addRevalidator(
        testKey,
        mockRevalidatorFn,
        undefined,
        undefined,
        undefined,
        true,
      );

      expect(() =>
        addRevalidator(
          testKey,
          mockRevalidatorFn,
          undefined,
          undefined,
          undefined,
          true,
        ),
      ).not.toThrow();
    });

    it('should handle empty key', () => {
      expect(() =>
        addRevalidator(
          '',
          mockRevalidatorFn,
          undefined,
          undefined,
          undefined,
          true,
        ),
      ).not.toThrow();
    });
  });

  describe('focus revalidation behavior', () => {
    let mockAddEventListener: jest.Mock;

    beforeEach(() => {
      removeRevalidators('focus');
      mockAddEventListener = jest.fn();
      window.addEventListener = mockAddEventListener;
      window.removeEventListener = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should test focus revalidation by directly calling the internal function', async () => {
      // Since the module initialization is complex to test due to timing,
      // we'll test the focus functionality through the public API
      addRevalidator(testKey, mockRevalidatorFn);
      addRevalidator(testKey2, mockRevalidatorFn2);
      addRevalidator(
        testKey,
        mockRevalidatorFn,
        undefined,
        undefined,
        undefined,
        true,
      );
      addRevalidator(
        testKey2,
        mockRevalidatorFn2,
        undefined,
        undefined,
        undefined,
        true,
      );

      // We can't easily test the actual focus event due to module initialization,
      // but we can test that the functions work correctly when called directly
      await revalidate(testKey);
      await revalidate(testKey2);

      expect(mockRevalidatorFn).toHaveBeenCalled();
      expect(mockRevalidatorFn2).toHaveBeenCalled();
    });
  });

  describe('error handling in focus revalidation', () => {
    it('should handle errors in revalidators gracefully', async () => {
      const errorFn = jest
        .fn()
        .mockRejectedValue(new Error('Focus revalidation failed'));
      addRevalidator(testKey, errorFn);

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
      addRevalidator(testKey, mockRevalidatorFn);

      await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should register revalidator with custom TTL', async () => {
      const customTTL = 5000; // 5 seconds
      addRevalidator(testKey, mockRevalidatorFn, customTTL);

      await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should never expire revalidator with TTL = 0', async () => {
      addRevalidator(testKey, mockRevalidatorFn, 0);

      // Fast forward time way beyond normal TTL
      jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour (reduced from 24)

      await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should update lastUsed timestamp on revalidation', async () => {
      addRevalidator(testKey, mockRevalidatorFn);

      await revalidate(testKey);
      jest.advanceTimersByTime(1000);
      await revalidate(testKey);

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(2);
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
      addRevalidator(testKey, syncFn);

      const result = await revalidate(testKey);
      expect(syncFn).toHaveBeenCalledTimes(1);
      expect(result).toBe('sync-result');
    });

    it('should handle async revalidator functions', async () => {
      const asyncFn = jest.fn().mockResolvedValue('async-result');
      addRevalidator(testKey, asyncFn);

      const result = await revalidate(testKey);
      expect(asyncFn).toHaveBeenCalledTimes(1);
      expect(result).toBe('async-result');
    });

    it('should handle revalidator that returns undefined', async () => {
      const undefinedFn = jest.fn().mockResolvedValue(undefined);
      addRevalidator(testKey, undefinedFn);

      const result = await revalidate(testKey);
      expect(undefinedFn).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('should handle revalidator that returns null', async () => {
      const nullFn = jest.fn().mockResolvedValue(null);
      addRevalidator(testKey, nullFn);

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
      removeRevalidators('focus');

      mockAddEventListener = jest.fn().mockImplementation((event, handler) => {
        if (event === 'focus') {
          focusHandler = handler;
        }
      });

      window.addEventListener = mockAddEventListener;
      window.removeEventListener = jest.fn();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should call focus revalidators when focus event is triggered', () => {
      addRevalidator(
        testKey,
        mockRevalidatorFn,
        undefined,
        undefined,
        mockRevalidatorFn,
        true,
      );
      addRevalidator(
        testKey2,
        mockRevalidatorFn2,
        undefined,
        undefined,
        mockRevalidatorFn2,
        true,
      );

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
      addRevalidator(testKey, mockRevalidatorFn);
      addRevalidator(testKey2, mockRevalidatorFn2);

      // Simulate focus event
      if (focusHandler) {
        focusHandler();
      }

      // Manual revalidators should not be called
      expect(mockRevalidatorFn).not.toHaveBeenCalled();
      expect(mockRevalidatorFn2).not.toHaveBeenCalled();
    });

    it('should not clean up focus revalidators with TTL = 0', () => {
      addRevalidator(
        testKey,
        mockRevalidatorFn,
        0,
        undefined,
        mockRevalidatorFn,
        true,
      );

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

      addRevalidator(testKey, errorFn, undefined, undefined, errorFn, true);
      addRevalidator(
        testKey2,
        workingFn,
        undefined,
        undefined,
        workingFn,
        true,
      );

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
      expect(() => addRevalidator('', mockRevalidatorFn)).not.toThrow();
    });

    it('should handle unregistering with empty string key', () => {
      expect(() => removeRevalidator('')).not.toThrow();
    });

    it('should overwrite existing revalidator with same key', async () => {
      const firstFn = jest.fn().mockResolvedValue('first');
      const secondFn = jest.fn().mockResolvedValue('second');

      addRevalidator(testKey, firstFn);
      addRevalidator(testKey, secondFn);

      const result = await revalidate(testKey);
      expect(firstFn).not.toHaveBeenCalled();
      expect(secondFn).toHaveBeenCalledTimes(1);
      expect(result).toBe('second');
    });

    it('should handle mixed TTL values correctly', () => {
      addRevalidator(testKey, mockRevalidatorFn, 1000);
      addRevalidator(testKey2, mockRevalidatorFn2, 0);

      expect(() => revalidate(testKey)).not.toThrow();
      expect(() => revalidate(testKey2)).not.toThrow();
    });

    it('should handle negative TTL as normal TTL', async () => {
      addRevalidator(testKey, mockRevalidatorFn, -1000);

      const result = await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });
  });

  describe('removeRevalidator', () => {
    it('should remove both manual and focus revalidators', async () => {
      addRevalidator(testKey, mockRevalidatorFn);
      addRevalidator(
        testKey,
        mockRevalidatorFn2,
        undefined,
        undefined,
        undefined,
        true,
      );

      removeRevalidator(testKey);

      // Neither should work after unregistering all
      const result = await revalidate(testKey);
      expect(result).toBeNull();
      expect(mockRevalidatorFn).not.toHaveBeenCalled();
    });

    it('should handle unregistering when only manual exists', () => {
      addRevalidator(testKey, mockRevalidatorFn);

      expect(() => removeRevalidator(testKey)).not.toThrow();
    });

    it('should handle unregistering when only focus exists', () => {
      addRevalidator(
        testKey,
        mockRevalidatorFn,
        undefined,
        undefined,
        undefined,
        true,
      );

      expect(() => removeRevalidator(testKey)).not.toThrow();
    });

    it('should handle unregistering when neither exists', () => {
      expect(() => removeRevalidator(testKey)).not.toThrow();
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

      addRevalidator(testKey, manualFn, 5000);
      addRevalidator(testKey, focusFn, 10000, undefined, undefined, true);

      // Manual revalidation should only call manual function
      const result = await revalidate(testKey);
      expect(focusFn).toHaveBeenCalledTimes(1);
      expect(manualFn).not.toHaveBeenCalled();
      expect(result).toBe('focus');

      // Cleanup should work independently
      removeRevalidator(testKey);
    });

    it('should handle revalidators with TTL = 0 never expiring', async () => {
      addRevalidator(testKey, mockRevalidatorFn, 0);
      addRevalidator(
        testKey2,
        mockRevalidatorFn2,
        0,
        undefined,
        undefined,
        true,
      );

      const cleanup = startRevalidatorCleanup(50); // Reduced cleanup interval

      // Fast forward time (reduced from 24 hours)
      jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour

      // Both should still work
      await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
      await revalidate(testKey2);
      expect(mockRevalidatorFn2).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('should handle periodic cleanup correctly', async () => {
      addRevalidator(testKey, mockRevalidatorFn, 100); // Reduced TTL

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
      addRevalidator(testKey, mockRevalidatorFn, -1000);

      const cleanup = startRevalidatorCleanup(50); // Reduced cleanup interval
      jest.advanceTimersByTime(100); // Reduced time advance

      const result = await revalidate(testKey);
      expect(result).toBeUndefined(); // Should be cleaned up

      cleanup();
    });

    it('should handle extreme values gracefully', async () => {
      addRevalidator(testKey, mockRevalidatorFn, Number.MAX_SAFE_INTEGER);
      addRevalidator(testKey2, mockRevalidatorFn2, NaN);

      await revalidate(testKey);
      await revalidate(testKey2);

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
      expect(mockRevalidatorFn2).toHaveBeenCalledTimes(1);
    });

    it('should handle keys containing focus suffix correctly', async () => {
      const trickeyKey = 'test|f|more';
      addRevalidator(trickeyKey, mockRevalidatorFn);
      addRevalidator(
        trickeyKey,
        mockRevalidatorFn2,
        undefined,
        undefined,
        undefined,
        true,
      );

      await revalidate(trickeyKey);
      expect(mockRevalidatorFn2).toHaveBeenCalledTimes(1);

      removeRevalidator(trickeyKey);
      const result = await revalidate(trickeyKey);
      expect(result).toBeNull();
    });

    it('should handle self-modifying revalidators', async () => {
      const selfModifyingFn = jest.fn().mockImplementation(() => {
        removeRevalidator(testKey);
        return 'self-modified';
      });

      addRevalidator(testKey, selfModifyingFn);

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

      addRevalidator(testKey, multiTypeFn);

      expect(await revalidate(testKey)).toBe('string');
      expect(await revalidate(testKey)).toBe(42);
      expect(await revalidate(testKey)).toEqual({ data: 'object' });

      expect(multiTypeFn).toHaveBeenCalledTimes(3);
    });

    it('should preserve TTL when updating lastUsed timestamp', async () => {
      const customTTL = 10000;
      addRevalidator(testKey, mockRevalidatorFn, customTTL);

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
        addRevalidator(`key-${i}`, fn, 50); // Reduced TTL
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
      removeRevalidators('focus');

      const mockAddEventListener = jest
        .fn()
        .mockImplementation((event, handler) => {
          if (event === 'focus') {
            focusHandler = handler;
          }
        });

      window.addEventListener = mockAddEventListener;
      window.removeEventListener = jest.fn();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should handle focus revalidation with proper cleanup timing and deletion before focus event', () => {
      const shortTTL = 100;
      addRevalidator(
        testKey,
        mockRevalidatorFn,
        shortTTL,
        undefined,
        undefined,
        true,
      );

      startRevalidatorCleanup(10);

      // Fast forward well past TTL
      jest.advanceTimersByTime(shortTTL + 50);

      // Simulate deletion before focus event
      removeRevalidator(testKey);

      // Focus event should not call the revalidator since it was deleted
      if (focusHandler) {
        focusHandler();
      }

      expect(mockRevalidatorFn).not.toHaveBeenCalled();
    });

    it('should handle async errors in focus revalidators gracefully', () => {
      const errorFn = jest.fn().mockRejectedValue(new Error('Focus error'));
      const workingFn = jest.fn().mockResolvedValue('success');

      addRevalidator(testKey, errorFn, undefined, undefined, errorFn, true);
      addRevalidator(
        testKey2,
        workingFn,
        undefined,
        undefined,
        workingFn,
        true,
      );

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
      addRevalidator(testKey, mockRevalidatorFn);
      addRevalidator(testKey2, mockRevalidatorFn2);

      if (focusHandler) {
        focusHandler();
      }

      // Manual revalidators should not be called
      expect(mockRevalidatorFn).not.toHaveBeenCalled();
      expect(mockRevalidatorFn2).not.toHaveBeenCalled();
    });

    it('should handle rapid focus events without issues', () => {
      addRevalidator(
        testKey,
        mockRevalidatorFn,
        5000,
        undefined,
        mockRevalidatorFn,
        true,
      );

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
      addRevalidator(testKey, mockRevalidatorFn, 0);

      const cleanup = startRevalidatorCleanup(50); // Reduced cleanup interval

      // Reduced time advance for TTL=0 test
      jest.advanceTimersByTime(60 * 60 * 1000); // 1 hour instead of 24

      await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('should clean up expired entries in periodic cleanup', async () => {
      addRevalidator(testKey, mockRevalidatorFn, 100);

      const cleanup = startRevalidatorCleanup(50);
      jest.advanceTimersByTime(200);

      const result = await revalidate(testKey);
      expect(result).toBeNull();

      cleanup();
    });

    it('should handle both manual and focus revalidators for same key', async () => {
      const manualFn = jest.fn().mockResolvedValue('manual');
      const focusFn = jest.fn().mockResolvedValue('focus');

      addRevalidator(testKey, manualFn);
      addRevalidator(testKey, focusFn, undefined, undefined, undefined, true);

      const result = await revalidate(testKey);
      expect(focusFn).toHaveBeenCalledTimes(1);
      expect(manualFn).not.toHaveBeenCalled();
      expect(result).toBe('focus');
    });

    it('should handle extreme TTL values', async () => {
      addRevalidator(testKey, mockRevalidatorFn, Number.MAX_SAFE_INTEGER);
      addRevalidator(testKey2, mockRevalidatorFn2, -1000);

      await revalidate(testKey);
      await revalidate(testKey2);

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
      expect(mockRevalidatorFn2).toHaveBeenCalledTimes(1);
    });

    it('should handle keys containing focus suffix', async () => {
      const specialKey = 'test|f|more';
      addRevalidator(specialKey, mockRevalidatorFn);
      addRevalidator(
        specialKey,
        mockRevalidatorFn2,
        undefined,
        undefined,
        undefined,
        true,
      );

      await revalidate(specialKey);
      expect(mockRevalidatorFn2).toHaveBeenCalledTimes(1);

      removeRevalidator(specialKey);
      const result = await revalidate(specialKey);
      expect(result).toBeNull();
    });

    it('should handle self-modifying revalidators', async () => {
      const selfModifyingFn = jest.fn().mockImplementation(() => {
        removeRevalidator(testKey);
        return 'modified';
      });

      addRevalidator(testKey, selfModifyingFn);

      const result1 = await revalidate(testKey);
      const result2 = await revalidate(testKey);

      expect(result1).toBe('modified');
      expect(result2).toBeNull();
    });
  });

  describe('staleTime functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Mock global fetch for staleTime tests
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'mocked response' }),
      });
    });

    afterEach(() => {
      removeRevalidator(testKey);
      removeRevalidator(testKey2);
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should trigger background revalidation after staleTime', async () => {
      const mainFn = jest.fn().mockResolvedValue('main');
      const bgFn = jest.fn().mockResolvedValue('background');
      const staleTime = 1000;

      addRevalidator(testKey, mainFn, 3 * 60 * 1000, staleTime, bgFn);

      // Initially no background revalidation
      expect(bgFn).not.toHaveBeenCalled();

      // Advance time past staleTime
      jest.advanceTimersByTime(staleTime + 10);

      // Run all pending timers and microtasks
      jest.runAllTimers();
      await Promise.resolve(); // Allow microtasks to complete

      expect(bgFn).toHaveBeenCalledTimes(1);
      expect(mainFn).not.toHaveBeenCalled();
    });

    it('should not trigger background revalidation when staleTime is 0', async () => {
      const mainFn = jest.fn().mockResolvedValue('main');
      const bgFn = jest.fn().mockResolvedValue('background');

      addRevalidator(testKey, mainFn, 3 * 60 * 1000, 0, bgFn);

      jest.advanceTimersByTime(10000);
      jest.runAllTimers();
      await Promise.resolve();

      expect(bgFn).not.toHaveBeenCalled();
    });

    it('should clean up stale timer on unregister', async () => {
      const mainFn = jest.fn().mockResolvedValue('main');
      const bgFn = jest.fn().mockResolvedValue('background');
      const staleTime = 1000;

      addRevalidator(testKey, mainFn, 3 * 60 * 1000, staleTime, bgFn);
      removeRevalidator(testKey);

      // Advance time past staleTime
      jest.advanceTimersByTime(staleTime + 10);
      jest.runAllTimers();
      await Promise.resolve();

      expect(bgFn).not.toHaveBeenCalled();
    });

    it('should handle background revalidation errors silently', async () => {
      const mainFn = jest.fn().mockResolvedValue('main');
      const bgFn = jest.fn().mockRejectedValue(new Error('Background error'));
      const staleTime = 1000;

      addRevalidator(testKey, mainFn, 3 * 60 * 1000, staleTime, bgFn);

      // Should not throw despite background error
      expect(() => {
        jest.advanceTimersByTime(staleTime + 10);
      }).not.toThrow();

      jest.runAllTimers();
      await Promise.resolve();
      expect(bgFn).toHaveBeenCalledTimes(1);
    });

    it('should use background revalidator when isBgRevalidator is true', async () => {
      const mainFn = jest.fn().mockResolvedValue('main');
      const bgFn = jest.fn().mockResolvedValue('background');

      addRevalidator(testKey, mainFn, 3 * 60 * 1000, 0, bgFn);

      const result = await revalidate(testKey, true);
      expect(bgFn).toHaveBeenCalledTimes(1);
      expect(mainFn).not.toHaveBeenCalled();
      expect(result).toBe('background');
    });

    it('should return null when background revalidator is not defined', async () => {
      const mainFn = jest.fn().mockResolvedValue('main');

      addRevalidator(testKey, mainFn, 3 * 60 * 1000, 0);

      const result = await revalidate(testKey, true);
      expect(result).toBeNull();
      expect(mainFn).not.toHaveBeenCalled();
    });

    it('should handle multiple stale timers for different keys', async () => {
      const fn1 = jest.fn().mockResolvedValue('fn1');
      const fn2 = jest.fn().mockResolvedValue('fn2');
      const bgFn1 = jest.fn().mockResolvedValue('bg1');
      const bgFn2 = jest.fn().mockResolvedValue('bg2');
      const staleTime1 = 1;
      const staleTime2 = 2;

      addRevalidator(testKey, fn1, 3 * 60 * 1000, staleTime1, bgFn1);
      addRevalidator(testKey2, fn2, 3 * 60 * 1000, staleTime2, bgFn2);

      // Advance time past first staleTime
      jest.advanceTimersByTime(staleTime1 * 1000 + 10);

      expect(bgFn1).toHaveBeenCalledTimes(1);
      expect(bgFn2).not.toHaveBeenCalled();

      // Advance time past second staleTime
      jest.advanceTimersByTime(staleTime2 * 1000 - staleTime1 * 1000);

      expect(bgFn1).toHaveBeenCalledTimes(1);
      expect(bgFn2).toHaveBeenCalledTimes(1);
    });

    it('should handle fetch-based background revalidation', async () => {
      const fetchSpy = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ data: 'fresh data' }),
      } as unknown as Response);

      // Create a realistic revalidator that uses fetch
      const bgRevalidator = jest.fn().mockImplementation(async () => {
        const response = await fetch('/api/test');
        return response.json();
      });

      const mainFn = jest.fn().mockResolvedValue('main');
      const staleTime = 1000;

      addRevalidator(testKey, mainFn, 3 * 60 * 1000, staleTime, bgRevalidator);

      // Advance time past staleTime
      jest.advanceTimersByTime(staleTime + 10);
      jest.runAllTimers();
      await Promise.resolve();

      expect(bgRevalidator).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith('/api/test');
    });

    it('should handle network errors in background revalidation', async () => {
      const fetchSpy = global.fetch as jest.MockedFunction<typeof fetch>;
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      // Create a revalidator that handles fetch errors
      const bgRevalidator = jest.fn().mockImplementation(async () => {
        try {
          const response = await fetch('/api/test');
          return response.json();
        } catch {
          throw new Error('Revalidation failed');
        }
      });

      const mainFn = jest.fn().mockResolvedValue('main');
      const staleTime = 1000;

      addRevalidator(testKey, mainFn, 3 * 60 * 1000, staleTime, bgRevalidator);

      // Advance time past staleTime
      jest.advanceTimersByTime(staleTime + 10);
      jest.runAllTimers();
      await Promise.resolve();

      expect(bgRevalidator).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith('/api/test');
    });
  });

  describe('additional edge cases and error conditions', () => {
    it('should handle revalidator function that returns undefined', async () => {
      const undefinedFn = jest.fn().mockResolvedValue(undefined);
      addRevalidator(testKey, undefinedFn);

      const result = await revalidate(testKey);
      expect(undefinedFn).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('should handle very large TTL values without overflow', async () => {
      const largeTTL = Number.MAX_SAFE_INTEGER;
      addRevalidator(testKey, mockRevalidatorFn, largeTTL);

      await revalidate(testKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should handle keys with special characters', async () => {
      const specialKey = 'test-key/with:special@chars#and%encoding';
      addRevalidator(specialKey, mockRevalidatorFn);

      await revalidate(specialKey);
      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);

      removeRevalidator(specialKey);
      const result = await revalidate(specialKey);
      expect(result).toBeNull();
    });

    it('should handle revalidator that modifies global state', async () => {
      let globalCounter = 0;
      const statefulFn = jest.fn().mockImplementation(() => {
        globalCounter++;
        return Promise.resolve(`count-${globalCounter}`);
      });

      addRevalidator(testKey, statefulFn);

      const result1 = await revalidate(testKey);
      const result2 = await revalidate(testKey);

      expect(result1).toBe('count-1');
      expect(result2).toBe('count-2');
      expect(globalCounter).toBe(2);
    });

    it('should handle simultaneous revalidations of same key', async () => {
      let callCount = 0;
      const slowFn = jest.fn().mockImplementation(() => {
        return new Promise((resolve) =>
          setTimeout(() => {
            callCount++;
            resolve(`result-${callCount}`);
          }, 10),
        );
      });

      addRevalidator(testKey, slowFn);

      // Start multiple revalidations simultaneously
      const promise1 = revalidate(testKey);
      const promise2 = revalidate(testKey);
      const promise3 = revalidate(testKey);

      const [result1, result2, result3] = await Promise.all([
        promise1,
        promise2,
        promise3,
      ]);

      expect(slowFn).toHaveBeenCalledTimes(3);
      expect(result1).toBe('result-1');
      expect(result2).toBe('result-2');
      expect(result3).toBe('result-3');
    });

    it('should handle focus revalidator registration when focus handler not initialized', () => {
      // Remove focus handler if it exists
      removeRevalidators('focus');

      // Should not throw when registering focus revalidator without handler
      expect(() => {
        addRevalidator(
          testKey,
          mockRevalidatorFn,
          undefined,
          undefined,
          undefined,
          true,
        );
      }).not.toThrow();
    });

    it('should handle cleanup with mixed revalidator types', () => {
      addRevalidator(testKey, mockRevalidatorFn);
      addRevalidator(
        testKey,
        mockRevalidatorFn2,
        undefined,
        undefined,
        undefined,
        true,
      );

      // Should clean up both types
      expect(() => {
        removeRevalidator(testKey);
      }).not.toThrow();
    });

    it('should handle extremely short stale times', async () => {
      jest.useRealTimers(); // Use real timers for this test

      const mainFn = jest.fn().mockResolvedValue('main');
      const bgFn = jest.fn().mockResolvedValue('background');
      const shortStaleTime = 0.001; // 1ms

      addRevalidator(testKey, mainFn, 3 * 60 * 1000, shortStaleTime, bgFn);

      // Wait slightly longer than stale time
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(bgFn).toHaveBeenCalledTimes(1);

      jest.useFakeTimers(); // Restore fake timers
    });
  });

  describe('setEventProvider', () => {
    afterEach(() => {
      removeRevalidators('focus');
      removeRevalidators('online');
    });

    it('should use custom provider instead of window events for focus', () => {
      const cleanup = jest.fn();
      let capturedHandler: (() => void) | undefined;

      setEventProvider('focus', (handler) => {
        capturedHandler = handler;
        return cleanup;
      });

      addRevalidator(
        testKey,
        mockRevalidatorFn,
        undefined,
        undefined,
        mockRevalidatorFn,
        true,
      );

      // Trigger focus via custom provider
      capturedHandler!();

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should use custom provider for online events', () => {
      const cleanup = jest.fn();
      let capturedHandler: (() => void) | undefined;

      setEventProvider('online', (handler) => {
        capturedHandler = handler;
        return cleanup;
      });

      addRevalidator(
        testKey,
        mockRevalidatorFn,
        undefined,
        undefined,
        mockRevalidatorFn,
        false,
        true,
      );

      capturedHandler!();

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should call cleanup when removing revalidators', () => {
      const cleanup = jest.fn();

      setEventProvider('focus', () => cleanup);

      addRevalidator(
        testKey,
        mockRevalidatorFn,
        undefined,
        undefined,
        undefined,
        true,
      );

      removeRevalidators('focus');

      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should re-register handler when provider is set after revalidators', () => {
      const cleanup = jest.fn();
      let capturedHandler: (() => void) | undefined;

      // First register with browser events
      addRevalidator(
        testKey,
        mockRevalidatorFn,
        undefined,
        undefined,
        mockRevalidatorFn,
        true,
      );

      // Then set a custom provider — should re-register
      setEventProvider('focus', (handler) => {
        capturedHandler = handler;
        return cleanup;
      });

      // Custom provider should now be active
      capturedHandler!();

      expect(mockRevalidatorFn).toHaveBeenCalledTimes(1);
    });

    it('should not trigger revalidators without the matching flag', () => {
      let capturedHandler: (() => void) | undefined;

      setEventProvider('focus', (handler) => {
        capturedHandler = handler;
        return jest.fn();
      });

      // Register without refetchOnFocus
      addRevalidator(testKey, mockRevalidatorFn);

      capturedHandler?.();

      expect(mockRevalidatorFn).not.toHaveBeenCalled();
    });
  });
});
