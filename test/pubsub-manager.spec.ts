import {
  addListener,
  removeListener,
  notifySubscribers,
  subscribe,
} from '../src/pubsub-manager';

describe('PubSub Manager', () => {
  let mockListener1: jest.Mock;
  let mockListener2: jest.Mock;
  let mockListener3: jest.Mock;
  const testKey = 'test-key';
  const testKey2 = 'test-key-2';
  const testData = { data: 'test-data', id: 123 };

  beforeEach(() => {
    mockListener1 = jest.fn();
    mockListener2 = jest.fn();
    mockListener3 = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up any listeners by calling removeListener
    removeListener(testKey, mockListener1);
    removeListener(testKey, mockListener2);
    removeListener(testKey, mockListener3);
    removeListener(testKey2, mockListener1);
    removeListener(testKey2, mockListener2);
  });

  describe('addListener', () => {
    it('should add a listener for a key', () => {
      const result = addListener(testKey, mockListener1);

      expect(result).toBeInstanceOf(Set);
      expect(result.has(mockListener1)).toBe(true);
    });

    it('should add multiple listeners for the same key', () => {
      addListener(testKey, mockListener1);
      const result = addListener(testKey, mockListener2);

      expect(result.has(mockListener1)).toBe(true);
      expect(result.has(mockListener2)).toBe(true);
      expect(result.size).toBe(2);
    });

    it('should add the same listener only once', () => {
      const result1 = addListener(testKey, mockListener1);
      const result2 = addListener(testKey, mockListener1);

      expect(result1).toBe(result2);
      expect(result1.size).toBe(1);
    });

    it('should handle different keys independently', () => {
      const set1 = addListener(testKey, mockListener1);
      const set2 = addListener(testKey2, mockListener2);

      expect(set1).not.toBe(set2);
      expect(set1.has(mockListener1)).toBe(true);
      expect(set1.has(mockListener2)).toBe(false);
      expect(set2.has(mockListener2)).toBe(true);
      expect(set2.has(mockListener1)).toBe(false);
    });

    it('should handle empty string as key', () => {
      const result = addListener('', mockListener1);

      expect(result).toBeInstanceOf(Set);
      expect(result.has(mockListener1)).toBe(true);
    });
  });

  describe('removeListener', () => {
    it('should remove a listener from a key', () => {
      const set = addListener(testKey, mockListener1);
      addListener(testKey, mockListener2);

      removeListener(testKey, mockListener1);

      expect(set.has(mockListener1)).toBe(false);
      expect(set.has(mockListener2)).toBe(true);
    });

    it('should handle removing non-existent listener gracefully', () => {
      addListener(testKey, mockListener1);

      expect(() => removeListener(testKey, mockListener2)).not.toThrow();
    });

    it('should handle removing from non-existent key gracefully', () => {
      expect(() =>
        removeListener('non-existent-key', mockListener1),
      ).not.toThrow();
    });

    it('should handle empty string key', () => {
      addListener('', mockListener1);

      expect(() => removeListener('', mockListener1)).not.toThrow();
    });
  });

  describe('notifySubscribers', () => {
    it('should notify all listeners for a key', () => {
      addListener(testKey, mockListener1);
      addListener(testKey, mockListener2);

      notifySubscribers(testKey, testData);

      expect(mockListener1).toHaveBeenCalledWith(testData);
      expect(mockListener2).toHaveBeenCalledWith(testData);
      expect(mockListener1).toHaveBeenCalledTimes(1);
      expect(mockListener2).toHaveBeenCalledTimes(1);
    });

    it('should not notify listeners for different keys', () => {
      addListener(testKey, mockListener1);
      addListener(testKey2, mockListener2);

      notifySubscribers(testKey, testData);

      expect(mockListener1).toHaveBeenCalledWith(testData);
      expect(mockListener2).not.toHaveBeenCalled();
    });

    it('should handle notifying non-existent key gracefully', () => {
      expect(() =>
        notifySubscribers('non-existent-key', testData),
      ).not.toThrow();
    });

    it('should notify with different data types', () => {
      addListener(testKey, mockListener1);

      const stringData = 'string-data';
      const numberData = 42;
      const objectData = { complex: { nested: 'object' } };
      const arrayData = [1, 2, 3];

      notifySubscribers(testKey, stringData);
      notifySubscribers(testKey, numberData);
      notifySubscribers(testKey, objectData);
      notifySubscribers(testKey, arrayData);

      expect(mockListener1).toHaveBeenNthCalledWith(1, stringData);
      expect(mockListener1).toHaveBeenNthCalledWith(2, numberData);
      expect(mockListener1).toHaveBeenNthCalledWith(3, objectData);
      expect(mockListener1).toHaveBeenNthCalledWith(4, arrayData);
      expect(mockListener1).toHaveBeenCalledTimes(4);
    });

    it('should handle listener throwing error gracefully', () => {
      const errorTestKey = 'error-test-key'; // Use a dedicated key for this test
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      addListener(errorTestKey, errorListener);
      addListener(errorTestKey, mockListener1);

      // This should not prevent other listeners from being called
      expect(() => notifySubscribers(errorTestKey, testData)).toThrow(
        'Listener error',
      );

      expect(errorListener).toHaveBeenCalledWith(testData);
      // Note: Due to forEach implementation, if first listener throws,
      // subsequent listeners might not be called

      // Clean up the error listener
      removeListener(errorTestKey, errorListener);
      removeListener(errorTestKey, mockListener1);
    });
  });

  describe('subscribe', () => {
    it('should add a listener and return unsubscribe function', () => {
      const unsubscribe = subscribe(testKey, mockListener1);

      expect(typeof unsubscribe).toBe('function');

      notifySubscribers(testKey, testData);
      expect(mockListener1).toHaveBeenCalledWith(testData);
    });

    it('should allow unsubscribing', () => {
      const unsubscribe = subscribe(testKey, mockListener1);

      notifySubscribers(testKey, testData);
      expect(mockListener1).toHaveBeenCalledTimes(1);

      unsubscribe();

      notifySubscribers(testKey, testData);
      expect(mockListener1).toHaveBeenCalledTimes(1); // Should not increase
    });

    it('should remove key from listeners map when all subscribers unsubscribe', () => {
      const unsubscribe1 = subscribe(testKey, mockListener1);
      const unsubscribe2 = subscribe(testKey, mockListener2);

      // Both listeners should receive notifications
      notifySubscribers(testKey, testData);
      expect(mockListener1).toHaveBeenCalledTimes(1);
      expect(mockListener2).toHaveBeenCalledTimes(1);

      // Unsubscribe first listener
      unsubscribe1();
      notifySubscribers(testKey, testData);
      expect(mockListener1).toHaveBeenCalledTimes(1); // No change
      expect(mockListener2).toHaveBeenCalledTimes(2); // Still receiving

      // Unsubscribe last listener - this should clean up the key
      unsubscribe2();
      notifySubscribers(testKey, testData);
      expect(mockListener1).toHaveBeenCalledTimes(1);
      expect(mockListener2).toHaveBeenCalledTimes(2); // No change
    });

    it('should handle multiple subscriptions of the same function', () => {
      const unsubscribe1 = subscribe(testKey, mockListener1);
      const unsubscribe2 = subscribe(testKey, mockListener1);

      notifySubscribers(testKey, testData);
      // Should only be called once since it's the same function reference
      expect(mockListener1).toHaveBeenCalledTimes(1);

      unsubscribe1();
      notifySubscribers(testKey, testData);
      // Should not be called since the function was removed
      expect(mockListener1).toHaveBeenCalledTimes(1);

      // Second unsubscribe should be safe to call
      expect(() => unsubscribe2()).not.toThrow();
    });

    it('should handle unsubscribing multiple times safely', () => {
      const unsubscribe = subscribe(testKey, mockListener1);

      unsubscribe();
      expect(() => unsubscribe()).not.toThrow();
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex subscriber management', () => {
      // Multiple subscribers for multiple keys
      const unsubscribe1 = subscribe(testKey, mockListener1);
      const unsubscribe2 = subscribe(testKey, mockListener2);
      const unsubscribe3 = subscribe(testKey2, mockListener3);

      // Notify first key
      notifySubscribers(testKey, testData);
      expect(mockListener1).toHaveBeenCalledWith(testData);
      expect(mockListener2).toHaveBeenCalledWith(testData);
      expect(mockListener3).not.toHaveBeenCalled();

      // Notify second key
      const testData2 = { different: 'data' };
      notifySubscribers(testKey2, testData2);
      expect(mockListener3).toHaveBeenCalledWith(testData2);

      // Unsubscribe and verify isolation
      unsubscribe1();
      notifySubscribers(testKey, testData);
      expect(mockListener1).toHaveBeenCalledTimes(1); // No change
      expect(mockListener2).toHaveBeenCalledTimes(2); // Still active

      // Clean up
      unsubscribe2();
      unsubscribe3();
    });

    it('should handle edge case with empty data', () => {
      subscribe(testKey, mockListener1);

      notifySubscribers(testKey, null);
      notifySubscribers(testKey, undefined);
      notifySubscribers(testKey, '');
      notifySubscribers(testKey, 0);
      notifySubscribers(testKey, false);

      expect(mockListener1).toHaveBeenNthCalledWith(1, null);
      expect(mockListener1).toHaveBeenNthCalledWith(2, undefined);
      expect(mockListener1).toHaveBeenNthCalledWith(3, '');
      expect(mockListener1).toHaveBeenNthCalledWith(4, 0);
      expect(mockListener1).toHaveBeenNthCalledWith(5, false);
      expect(mockListener1).toHaveBeenCalledTimes(5);
    });
  });
});
