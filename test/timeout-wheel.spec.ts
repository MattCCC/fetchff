/**
 * @jest-environment jsdom
 */
import {
  addTimeout,
  removeTimeout,
  clearAllTimeouts,
} from '../src/timeout-wheel';

describe('Timeout Wheel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    clearAllTimeouts();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('should execute timeout after specified time', () => {
      const callback = jest.fn();

      addTimeout('test-1', callback, 3000);

      // Should not fire before time
      expect(callback).not.toHaveBeenCalled();

      // Advance to just before timeout
      jest.advanceTimersByTime(2900);
      expect(callback).not.toHaveBeenCalled();

      // Advance past timeout
      jest.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should execute multiple timeouts at correct times', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      addTimeout('test-1', callback1, 1000);
      addTimeout('test-2', callback2, 3000);
      addTimeout('test-3', callback3, 5000);

      // At 1 second
      jest.advanceTimersByTime(1000);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();

      // At 3 seconds
      jest.advanceTimersByTime(2000);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).not.toHaveBeenCalled();

      // At 5 seconds
      jest.advanceTimersByTime(2000);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should remove timeout before execution', () => {
      const callback = jest.fn();

      addTimeout('test-1', callback, 3000);
      removeTimeout('test-1');

      // Advance past timeout time
      jest.advanceTimersByTime(5000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent timeout', () => {
      expect(() => removeTimeout('non-existent')).not.toThrow();
    });
  });

  describe('Key Management', () => {
    it('should replace timeout with same key', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      addTimeout('same-key', callback1, 2000);
      addTimeout('same-key', callback2, 4000);

      // First timeout should be replaced
      jest.advanceTimersByTime(2500);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();

      // Second timeout should fire
      jest.advanceTimersByTime(2000);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple timeouts in same slot', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      addTimeout('key-1', callback1, 3000);
      addTimeout('key-2', callback2, 3000);
      addTimeout('key-3', callback3, 3000);

      jest.advanceTimersByTime(3000);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should remove specific timeout from slot with multiple timeouts', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      addTimeout('key-1', callback1, 3000);
      addTimeout('key-2', callback2, 3000);
      addTimeout('key-3', callback3, 3000);

      removeTimeout('key-2');

      jest.advanceTimersByTime(3000);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).toHaveBeenCalledTimes(1);
    });
  });

  describe('Fallback to setTimeout', () => {
    it('should use setTimeout for timeouts > 10 minutes', () => {
      const callback = jest.fn();
      const longTimeout = 11 * 60 * 1000; // 11 minutes

      addTimeout('long-timeout', callback, longTimeout);

      // Should use native setTimeout, not timing wheel
      jest.advanceTimersByTime(longTimeout);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should use setTimeout for non-1000ms-divisible timeouts', () => {
      const callback = jest.fn();

      addTimeout('sub-second', callback, 1500); // 1.5 seconds

      jest.advanceTimersByTime(1500);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should remove setTimeout-based timeouts', () => {
      const callback = jest.fn();

      addTimeout('sub-second', callback, 1500);
      removeTimeout('sub-second');

      jest.advanceTimersByTime(2000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle replacing setTimeout timeout with wheel timeout', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      addTimeout('mixed-key', callback1, 1500); // setTimeout
      addTimeout('mixed-key', callback2, 3000); // wheel

      jest.advanceTimersByTime(1600);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1500);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Timer Management', () => {
    it('should start timer on first timeout', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      addTimeout('test-1', jest.fn(), 3000);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it('should stop timer when no timeouts remain', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const callback = jest.fn();

      addTimeout('test-1', callback, 1000);

      // Timer should be running
      expect(clearIntervalSpy).not.toHaveBeenCalled();

      // Fire timeout
      jest.advanceTimersByTime(1000);

      // Timer should be stopped
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should not start multiple timers', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      addTimeout('test-1', jest.fn(), 2000);
      addTimeout('test-2', jest.fn(), 3000);
      addTimeout('test-3', jest.fn(), 4000);

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('should restart timer after clearAllTimeouts', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      addTimeout('test-1', jest.fn(), 2000);
      clearAllTimeouts();
      addTimeout('test-2', jest.fn(), 3000);

      expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle callback errors without stopping wheel', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();

      addTimeout('error-key', errorCallback, 2000);
      addTimeout('normal-key', normalCallback, 3000);

      // Error callback should throw but not stop wheel
      jest.advanceTimersByTime(2000);
      expect(errorCallback).toHaveBeenCalledTimes(1);

      // Normal callback should still work
      jest.advanceTimersByTime(1000);
      expect(normalCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle async callback errors', () => {
      const asyncErrorCallback = jest.fn(async () => {
        throw new Error('Async error');
      });
      const normalCallback = jest.fn();

      addTimeout('async-error', asyncErrorCallback, 2000);
      addTimeout('normal', normalCallback, 3000);

      jest.advanceTimersByTime(2000);
      expect(asyncErrorCallback).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1000);
      expect(normalCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero timeout via setTimeout fallback', () => {
      const callback = jest.fn();

      addTimeout('zero', callback, 0);

      jest.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledTimes(1); // Fires via setTimeout(cb, 0)
    });

    it('should handle timeout at wheel boundary', () => {
      const callback = jest.fn();
      const maxWheelTime = 600 * 1000; // 10 minutes

      addTimeout('boundary', callback, maxWheelTime);

      jest.advanceTimersByTime(maxWheelTime);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle position wraparound', () => {
      const callbacks: jest.Mock[] = [];

      // Add timeouts to force position wraparound
      for (let i = 0; i < 605; i++) {
        const callback = jest.fn();
        callbacks.push(callback);
        addTimeout(`key-${i}`, callback, (i + 1) * 1000);
      }

      // Advance 605 seconds to force wraparound
      jest.advanceTimersByTime(605 * 1000);

      // All callbacks should have fired
      callbacks.forEach((callback) => {
        expect(callback).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle removing timeout during execution', () => {
      const callback1 = jest.fn(() => {
        removeTimeout('key-2'); // Remove another timeout during execution
      });
      const callback2 = jest.fn();

      addTimeout('key-1', callback1, 3000);
      addTimeout('key-2', callback2, 3000);

      jest.advanceTimersByTime(3000);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should handle many timeouts efficiently', () => {
      const callbacks: jest.Mock[] = [];
      const timeoutCount = 1000;

      // Add 1000 timeouts
      for (let i = 0; i < timeoutCount; i++) {
        const callback = jest.fn();
        callbacks.push(callback);
        addTimeout(`perf-key-${i}`, callback, ((i % 600) + 1) * 1000);
      }

      // Advance time to execute all timeouts
      jest.advanceTimersByTime(600 * 1000);

      // All callbacks should have fired
      callbacks.forEach((callback) => {
        expect(callback).toHaveBeenCalledTimes(1);
      });
    });

    it('should batch execute timeouts in same slot', () => {
      const callbacks: jest.Mock[] = [];
      const sameSlotCount = 100;

      // Add 100 timeouts to same slot
      for (let i = 0; i < sameSlotCount; i++) {
        const callback = jest.fn();
        callbacks.push(callback);
        addTimeout(`batch-key-${i}`, callback, 5000);
      }

      jest.advanceTimersByTime(5000);

      // All callbacks should fire together
      callbacks.forEach((callback) => {
        expect(callback).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('clearAllTimeouts', () => {
    it('should clear all wheel timeouts', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      addTimeout('key-1', callback1, 2000);
      addTimeout('key-2', callback2, 4000);
      addTimeout('key-3', callback3, 6000);

      clearAllTimeouts();

      jest.advanceTimersByTime(10000);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();
    });

    it('should clear setTimeout-based timeouts', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      addTimeout('wheel-timeout', callback1, 3000);
      addTimeout('settimeout-timeout', callback2, 1500);

      clearAllTimeouts();

      jest.advanceTimersByTime(5000);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should reset wheel position', () => {
      const callback = jest.fn();

      // Advance wheel position
      addTimeout('advance', jest.fn(), 1000);
      jest.advanceTimersByTime(1000);

      clearAllTimeouts();

      // Add new timeout - should start from position 0
      addTimeout('reset-test', callback, 1000);
      jest.advanceTimersByTime(1000);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should stop wheel timer', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      addTimeout('test', jest.fn(), 5000);
      clearAllTimeouts();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle rapid add/remove cycles', () => {
      const callback = jest.fn();

      for (let i = 0; i < 100; i++) {
        addTimeout('rapid-key', callback, 3000);
        if (i % 2 === 0) {
          removeTimeout('rapid-key');
        }
      }

      jest.advanceTimersByTime(3000);

      // Only the last timeout should fire
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should maintain correct execution order', () => {
      const executionOrder: number[] = [];

      addTimeout('third', () => executionOrder.push(3), 3000);
      addTimeout('first', () => executionOrder.push(1), 1000);
      addTimeout('second', () => executionOrder.push(2), 2000);
      addTimeout('fourth', () => executionOrder.push(4), 4000);

      jest.advanceTimersByTime(5000);

      expect(executionOrder).toEqual([1, 2, 3, 4]);
    });

    it('should handle mixed wheel and setTimeout timeouts', () => {
      const wheelCallback = jest.fn();
      const setTimeoutCallback = jest.fn();

      addTimeout('wheel', wheelCallback, 2000); // Uses wheel
      addTimeout('setTimeout', setTimeoutCallback, 2500); // Uses setTimeout

      jest.advanceTimersByTime(2000);
      expect(wheelCallback).toHaveBeenCalledTimes(1);
      expect(setTimeoutCallback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);
      expect(setTimeoutCallback).toHaveBeenCalledTimes(1);
    });
  });
});
