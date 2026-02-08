/* eslint-disable @typescript-eslint/no-explicit-any */
import { getRetryAfterMs } from '../src/retry-handler';

describe('getRetryAfterMs', () => {
  it('returns null if response is null', () => {
    expect(getRetryAfterMs(null)).toBeNull();
  });

  it('returns null if headers are missing', () => {
    expect(getRetryAfterMs({ headers: undefined } as any)).toBeNull();
  });

  it('returns null if retry-after header is missing', () => {
    expect(getRetryAfterMs({ headers: {} } as any)).toBeNull();
  });

  it('parses seconds value correctly', () => {
    expect(getRetryAfterMs({ headers: { 'retry-after': '10' } } as any)).toBe(
      10000,
    );
  });

  it('parses zero seconds correctly', () => {
    expect(getRetryAfterMs({ headers: { 'retry-after': '0' } } as any)).toBe(0);
  });

  it('parses HTTP-date correctly (future date)', () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = getRetryAfterMs({ headers: { 'retry-after': future } } as any);
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThanOrEqual(5000);
  });

  it('returns 0 for HTTP-date in the past', () => {
    const past = new Date(Date.now() - 10000).toUTCString();
    expect(getRetryAfterMs({ headers: { 'retry-after': past } } as any)).toBe(
      0,
    );
  });

  it('returns null for invalid retry-after value', () => {
    expect(
      getRetryAfterMs({ headers: { 'retry-after': 'not-a-date' } } as any),
    ).toBeNull();
  });

  it('parses ratelimit-reset-after header', () => {
    expect(
      getRetryAfterMs({ headers: { 'ratelimit-reset-after': '5' } } as any),
    ).toBe(5000);
  });

  it('parses x-ratelimit-reset-after header', () => {
    expect(
      getRetryAfterMs({ headers: { 'x-ratelimit-reset-after': '3' } } as any),
    ).toBe(3000);
  });

  it('parses ratelimit-reset-at header with future date', () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = getRetryAfterMs({
      headers: { 'ratelimit-reset-at': future },
    } as any);
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThanOrEqual(5000);
  });

  it('parses x-ratelimit-reset-at header with future date', () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = getRetryAfterMs({
      headers: { 'x-ratelimit-reset-at': future },
    } as any);
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThanOrEqual(5000);
  });

  it('returns null for invalid ratelimit-reset-at value', () => {
    expect(
      getRetryAfterMs({
        headers: { 'ratelimit-reset-at': 'not-a-date' },
      } as any),
    ).toBeNull();
  });
});
