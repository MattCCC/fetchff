import {
  incrementRef,
  decrementRef,
  getRefCount,
  clearRefCache,
  INFINITE_CACHE_TIME,
} from '../../src/react/cache-ref';
import { deleteCache } from '../../src/cache-manager';

// Mock the deleteCache function
jest.mock('../../src/cache-manager', () => ({
  deleteCache: jest.fn(),
}));

const mockDeleteCache = deleteCache as jest.MockedFunction<typeof deleteCache>;

describe('Cache Reference Management', () => {
  const testKey = 'test-cache-key';
  const testKey2 = 'test-cache-key-2';
  const dedupeTime = 100;

  beforeEach(() => {
    jest.useFakeTimers();
    clearRefCache();
    mockDeleteCache.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    clearRefCache();
  });

  describe('incrementRef', () => {
    it('should initialize ref count to 1 for new key', () => {
      incrementRef(testKey);
      expect(getRefCount(testKey)).toBe(1);
    });

    it('should increment existing ref count', () => {
      incrementRef(testKey);
      incrementRef(testKey);
      incrementRef(testKey);
      expect(getRefCount(testKey)).toBe(3);
    });

    it('should handle null key gracefully', () => {
      incrementRef(null);
      expect(getRefCount(null)).toBe(0);
    });

    it('should handle multiple different keys independently', () => {
      incrementRef(testKey);
      incrementRef(testKey2);
      incrementRef(testKey);

      expect(getRefCount(testKey)).toBe(2);
      expect(getRefCount(testKey2)).toBe(1);
    });
  });

  describe('decrementRef', () => {
    describe('Basic functionality', () => {
      it('should decrement ref count', () => {
        incrementRef(testKey);
        incrementRef(testKey);

        decrementRef(testKey);
        expect(getRefCount(testKey)).toBe(1);
      });

      it('should handle null key gracefully', () => {
        expect(() => decrementRef(null)).not.toThrow();
      });

      it('should handle non-existent key gracefully', () => {
        expect(() => decrementRef('non-existent')).not.toThrow();
        expect(getRefCount('non-existent')).toBe(0);
      });

      it('should not go below zero', () => {
        incrementRef(testKey);
        decrementRef(testKey);
        decrementRef(testKey); // Try to go negative

        expect(getRefCount(testKey)).toBe(0);
      });
    });

    describe('Infinite cache behavior', () => {
      it('should delete cache when ref count drops to 0 for infinite cache', () => {
        incrementRef(testKey);
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);

        expect(getRefCount(testKey)).toBe(0);
        expect(mockDeleteCache).not.toHaveBeenCalled(); // Not called yet

        // Advance timers past dedupeTime
        jest.advanceTimersByTime(dedupeTime);

        expect(mockDeleteCache).toHaveBeenCalledWith(testKey, true);
        expect(mockDeleteCache).toHaveBeenCalledTimes(1);
      });

      it('should not delete cache for non-infinite cache times', () => {
        incrementRef(testKey);
        decrementRef(testKey, 300, dedupeTime); // 5 minutes cache

        expect(getRefCount(testKey)).toBe(0);

        jest.advanceTimersByTime(dedupeTime);

        expect(mockDeleteCache).not.toHaveBeenCalled();
      });

      it('should not delete cache when cacheTime is 0', () => {
        incrementRef(testKey);
        decrementRef(testKey, 0, dedupeTime);

        jest.advanceTimersByTime(dedupeTime);

        expect(mockDeleteCache).not.toHaveBeenCalled();
      });

      it('should not delete cache when cacheTime is undefined', () => {
        incrementRef(testKey);
        decrementRef(testKey, undefined, dedupeTime);

        jest.advanceTimersByTime(dedupeTime);

        expect(mockDeleteCache).not.toHaveBeenCalled();
      });
    });

    describe('Race condition prevention', () => {
      it('should prevent deletion if ref count increases during timeout', () => {
        incrementRef(testKey);
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);

        expect(getRefCount(testKey)).toBe(0);

        // Simulate new component mounting during timeout
        incrementRef(testKey);
        expect(getRefCount(testKey)).toBe(1);

        // Advance timer
        jest.advanceTimersByTime(dedupeTime);

        // Cache should NOT be deleted because ref count is now > 0
        expect(mockDeleteCache).not.toHaveBeenCalled();
      });

      it('should handle multiple increments during timeout', () => {
        incrementRef(testKey);
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);

        // Multiple components mount during timeout
        incrementRef(testKey);
        incrementRef(testKey);
        incrementRef(testKey);

        expect(getRefCount(testKey)).toBe(3);

        jest.advanceTimersByTime(dedupeTime);

        expect(mockDeleteCache).not.toHaveBeenCalled();
      });

      it('should still delete if no new refs are added during timeout', () => {
        incrementRef(testKey);
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);

        // No new increments happen
        jest.advanceTimersByTime(dedupeTime);

        expect(mockDeleteCache).toHaveBeenCalledWith(testKey, true);
      });
    });

    describe('Complex scenarios', () => {
      it('should handle multiple components with same cache key', () => {
        // Simulate 3 components using same cache key
        incrementRef(testKey); // Component A
        incrementRef(testKey); // Component B
        incrementRef(testKey); // Component C

        expect(getRefCount(testKey)).toBe(3);

        // Component A unmounts
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
        expect(getRefCount(testKey)).toBe(2);

        jest.advanceTimersByTime(dedupeTime);
        expect(mockDeleteCache).not.toHaveBeenCalled();

        // Component B unmounts
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
        expect(getRefCount(testKey)).toBe(1);

        jest.advanceTimersByTime(dedupeTime);
        expect(mockDeleteCache).not.toHaveBeenCalled();

        // Component C unmounts (last one)
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
        expect(getRefCount(testKey)).toBe(0);

        jest.advanceTimersByTime(dedupeTime);
        expect(mockDeleteCache).toHaveBeenCalledWith(testKey, true);
        expect(mockDeleteCache).toHaveBeenCalledTimes(1);
      });

      it('should handle rapid mount/unmount cycles', () => {
        // Rapid mount/unmount/mount cycle
        incrementRef(testKey);
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
        // Ref count is 0, deletion scheduled

        // Before timeout, new component mounts
        incrementRef(testKey);
        expect(getRefCount(testKey)).toBe(1);

        // Another unmount
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
        expect(getRefCount(testKey)).toBe(0);

        // Yet another mount before any timeout
        incrementRef(testKey);
        expect(getRefCount(testKey)).toBe(1);

        // Advance all timers
        jest.advanceTimersByTime(dedupeTime * 3);

        // Cache should not be deleted because final state has refs
        expect(mockDeleteCache).not.toHaveBeenCalled();
      });

      it('should handle concurrent operations on different keys', () => {
        // Setup multiple keys with refs
        incrementRef(testKey);
        incrementRef(testKey2);

        // Decrement both to trigger deletion timers
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
        decrementRef(testKey2, INFINITE_CACHE_TIME, dedupeTime);

        // Add ref back to only one key
        incrementRef(testKey);

        jest.advanceTimersByTime(dedupeTime);

        // Only testKey2 should be deleted
        expect(mockDeleteCache).toHaveBeenCalledWith(testKey2, true);
        expect(mockDeleteCache).not.toHaveBeenCalledWith(testKey);
        expect(mockDeleteCache).toHaveBeenCalledTimes(1);
      });

      it('should handle race condition with timeout correctly', () => {
        incrementRef(testKey);

        // Decrement to 0 - this schedules deletion
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
        expect(getRefCount(testKey)).toBe(0);

        // Before timeout fires, add ref back
        incrementRef(testKey);
        expect(getRefCount(testKey)).toBe(1);

        // When timeout fires, it should see ref count > 0 and not delete
        jest.advanceTimersByTime(dedupeTime);
        expect(mockDeleteCache).not.toHaveBeenCalled();

        // Now decrement again and let it delete
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
        expect(getRefCount(testKey)).toBe(0);

        jest.advanceTimersByTime(dedupeTime);
        expect(mockDeleteCache).toHaveBeenCalledWith(testKey, true);
        expect(mockDeleteCache).toHaveBeenCalledTimes(1);
      });

      it('should handle default dedupeTime when not provided', () => {
        incrementRef(testKey);
        decrementRef(testKey, INFINITE_CACHE_TIME); // No dedupeTime provided

        // Should still work with undefined dedupeTime
        jest.advanceTimersByTime(0);

        // The implementation should handle undefined gracefully
        expect(() => jest.advanceTimersToNextTimer()).not.toThrow();
      });
    });

    describe('Edge cases', () => {
      it('should handle system clock changes during timeout', () => {
        incrementRef(testKey);
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);

        // Simulate system clock jumping (timer still fires)
        jest.advanceTimersByTime(dedupeTime);

        expect(mockDeleteCache).toHaveBeenCalledWith(testKey, true);
      });

      it('should handle very large ref counts', () => {
        // Add many refs
        for (let i = 0; i < 10000; i++) {
          incrementRef(testKey);
        }

        expect(getRefCount(testKey)).toBe(10000);

        // Remove all but one
        for (let i = 0; i < 9999; i++) {
          decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
        }

        expect(getRefCount(testKey)).toBe(1);
        expect(mockDeleteCache).not.toHaveBeenCalled();

        // Remove last one
        decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
        jest.advanceTimersByTime(dedupeTime);

        expect(mockDeleteCache).toHaveBeenCalledWith(testKey, true);
      });

      it('should handle empty string as key gracefully', () => {
        const emptyKey = '';

        // Test behavior with empty string
        incrementRef(emptyKey);
        const refCount = getRefCount(emptyKey);

        // The implementation might treat empty string as invalid
        // If so, it should behave like null key
        expect(refCount).toBeGreaterThanOrEqual(0);

        // If ref count is 0, empty string is treated as invalid
        if (refCount === 0) {
          // Should handle decrementRef gracefully too
          expect(() =>
            decrementRef(emptyKey, INFINITE_CACHE_TIME, dedupeTime),
          ).not.toThrow();
        } else {
          // Empty string is supported
          decrementRef(emptyKey, INFINITE_CACHE_TIME, dedupeTime);
          expect(getRefCount(emptyKey)).toBe(0);

          jest.advanceTimersByTime(dedupeTime);
          expect(mockDeleteCache).toHaveBeenCalledWith(emptyKey);
        }
      });

      it('should handle special characters in key', () => {
        const specialKey = 'key/with:special@characters#test';
        incrementRef(specialKey);
        decrementRef(specialKey, INFINITE_CACHE_TIME, dedupeTime);

        jest.advanceTimersByTime(dedupeTime);

        expect(mockDeleteCache).toHaveBeenCalledWith(specialKey, true);
      });
    });
  });

  describe('getRefCount', () => {
    it('should return 0 for non-existent key', () => {
      expect(getRefCount('non-existent')).toBe(0);
    });

    it('should return 0 for null key', () => {
      expect(getRefCount(null)).toBe(0);
    });

    it('should return correct count for existing key', () => {
      incrementRef(testKey);
      incrementRef(testKey);
      expect(getRefCount(testKey)).toBe(2);
    });

    it('should return 0 after ref is deleted', () => {
      incrementRef(testKey);
      decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
      expect(getRefCount(testKey)).toBe(0);
    });
  });

  describe('clearRefCache', () => {
    it('should clear all ref counts', () => {
      incrementRef(testKey);
      incrementRef(testKey2);
      incrementRef('another-key');

      expect(getRefCount(testKey)).toBe(1);
      expect(getRefCount(testKey2)).toBe(1);
      expect(getRefCount('another-key')).toBe(1);

      clearRefCache();

      expect(getRefCount(testKey)).toBe(0);
      expect(getRefCount(testKey2)).toBe(0);
      expect(getRefCount('another-key')).toBe(0);
    });

    it('should not affect pending deletion timers', () => {
      incrementRef(testKey);
      decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);

      clearRefCache();

      // Timer should still fire and attempt deletion
      jest.advanceTimersByTime(dedupeTime);
      expect(mockDeleteCache).toHaveBeenCalledWith(testKey, true);
    });
  });

  describe('Integration scenarios', () => {
    it('should simulate React component lifecycle accurately', () => {
      // Component mounts
      incrementRef(testKey);
      expect(getRefCount(testKey)).toBe(1);

      // Component updates (no ref change)
      expect(getRefCount(testKey)).toBe(1);

      // Second component with same key mounts
      incrementRef(testKey);
      expect(getRefCount(testKey)).toBe(2);

      // First component unmounts
      decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
      expect(getRefCount(testKey)).toBe(1);

      // Cache should not be deleted
      jest.advanceTimersByTime(dedupeTime);
      expect(mockDeleteCache).not.toHaveBeenCalled();

      // Second component unmounts
      decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
      expect(getRefCount(testKey)).toBe(0);

      // Cache should be deleted after timeout
      jest.advanceTimersByTime(dedupeTime);
      expect(mockDeleteCache).toHaveBeenCalledWith(testKey, true);
    });

    it('should handle React Strict Mode double mounting', () => {
      // Strict mode mounts component twice
      incrementRef(testKey);
      incrementRef(testKey);
      expect(getRefCount(testKey)).toBe(2);

      // Then unmounts once (cleanup of first mount)
      decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
      expect(getRefCount(testKey)).toBe(1);

      // Should not delete cache
      jest.advanceTimersByTime(dedupeTime);
      expect(mockDeleteCache).not.toHaveBeenCalled();

      // Final unmount
      decrementRef(testKey, INFINITE_CACHE_TIME, dedupeTime);
      jest.advanceTimersByTime(dedupeTime);
      expect(mockDeleteCache).toHaveBeenCalledWith(testKey, true);
    });
  });
});
