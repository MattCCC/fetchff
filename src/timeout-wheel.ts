/**
 * @module timeout-wheel
 * @description
 * Ultra-minimal timing wheel implementation optimized for max performance & many requests.
 * For most of the cases it's 4-100x faster than setTimeout and setInterval alone.
 * Provides efficient scheduling and cancellation of timeouts using a circular array.
 *
 * Position 0 → 1 → 2 → ... → 599 → 0 → 1 → 2 ...
 * Time:   0s   1s   2s        599s   600s 601s 602s
 *
 * The timing wheel consists of 600 slots (one per second for 10 min).
 * Each slot contains a list of timeout items, each associated with a unique key and callback.
 * Timeouts are scheduled by placing them in the appropriate slot based on the delay in seconds.
 * The wheel advances every second, executing and removing callbacks as their timeouts expire.
 * Defaults to setTimeout if the delay doesn't fit in the wheel (~10 minutes) or is not divisible by 1000.
 *
 * @remarks
 * - Designed for minimal footprint and simplicity.
 * - Only supports second-level granularity (minimum timeout: 1 second).
 * - Timeouts never fire early, but may fire up to 1 second late.
 * - Automatically stops the internal timer when no timeouts remain.
 */

import { MAX_DELAY_MS } from './constants';
import { noop, timeNow } from './utils';

type TimeoutCallback = () => unknown | Promise<unknown>;
type TimeoutItem = [string, TimeoutCallback]; // [key, callback]

const WHEEL_SIZE = 600; // 600 slots for 10 min (1 slot per second)
const SECOND = 1000; // 1 second in milliseconds
const wheel: TimeoutItem[][] = Array(WHEEL_SIZE)
  .fill(0)
  .map(() => []);

const keyMap = new Map<string, number | [NodeJS.Timeout | number]>();
let position = 0;
let lastTick = 0; // Time when the wheel last advanced (or started)
let timer: NodeJS.Timeout | null = null;

const handleCallback = ([key, callback]: TimeoutItem): void => {
  keyMap.delete(key);

  try {
    const result = callback();
    if (result && result instanceof Promise) {
      // Silently ignore async errors to prevent wheel from stopping
      result.catch(noop);
    }
  } catch {
    // Ignore callback errors to prevent wheel from stopping
  }
};

export const addTimeout = (
  key: string,
  cb: TimeoutCallback,
  ms: number,
): void => {
  removeTimeout(key);

  // A running wheel is already part-way through its current second, so the timeout
  // waits one more slot to never fire early. A new wheel starts its first second now.
  const seconds = ms / SECOND + (timer && timeNow() !== lastTick ? 1 : 0);

  // Fallback to setTimeout if wheel size is exceeded, ms is sub-second, or ms is not divisible by SECOND
  if (ms < SECOND || seconds >= WHEEL_SIZE || ms % SECOND !== 0) {
    keyMap.set(key, [
      setTimeout(
        handleCallback.bind(null, [key, cb]),
        Math.min(ms, MAX_DELAY_MS),
      ),
    ]); // Store timeout ID instead of slot

    return;
  }

  const slot = (position + seconds) % WHEEL_SIZE;

  wheel[slot].push([key, cb]);
  keyMap.set(key, slot);

  if (!timer) {
    lastTick = timeNow();
    timer = setInterval(() => {
      position = (position + 1) % WHEEL_SIZE;
      lastTick = timeNow();
      const slot = wheel[position];

      // Use slot.length directly (not cached) so mid-iteration mutations
      // from callbacks (e.g. removeTimeout) are handled correctly
      for (let i = 0; i < slot.length; i++) {
        handleCallback(slot[i]);
      }

      slot.length = 0; // Reuse array, avoid GC allocation

      if (!keyMap.size && timer) {
        clearInterval(timer);
        timer = null;
      }
    }, SECOND);
  }
};

export const removeTimeout = (key: string): void => {
  const slotOrTimeout = keyMap.get(key);

  if (slotOrTimeout !== undefined) {
    // It's a Timeout object from setTimeout
    if (Array.isArray(slotOrTimeout)) {
      clearTimeout(slotOrTimeout[0]);
    } else {
      const slotArr = wheel[slotOrTimeout];
      const idx = slotArr.findIndex(([k]) => k === key);

      if (idx !== -1) {
        slotArr.splice(idx, 1);
      }
    }

    keyMap.delete(key);

    if (!keyMap.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  }
};

export const clearAllTimeouts = () => {
  // Clear native setTimeout timeouts first!
  keyMap.forEach((value) => {
    if (Array.isArray(value)) {
      clearTimeout(value[0]);
    }
  });

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  keyMap.clear();

  for (let i = 0; i < WHEEL_SIZE; i++) {
    wheel[i].length = 0;
  }

  position = 0;
};
