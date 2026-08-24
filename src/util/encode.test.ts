import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHash, getStableHash } from './encode.js';

const cyclic = (): Record<string, unknown> => {
  const obj: Record<string, unknown> = { name: 'root' };
  obj.self = obj;

  return obj;
};

afterEach(() => {
  localStorage.clear();
});

describe('getHash', () => {
  it('hashes the empty string to 0', () => {
    expect(getHash('')).toBe(0);
  });

  it('defaults to the empty string when called with no argument', () => {
    expect(getHash()).toBe(0);
  });

  it('is deterministic', () => {
    expect(getHash('hello world')).toBe(getHash('hello world'));
  });

  it('distinguishes different inputs', () => {
    expect(getHash('hello')).not.toBe(getHash('world'));
  });

  it('stays inside the signed 32-bit range', () => {
    const inputs = [
      'a',
      'hello world',
      'x'.repeat(5000),
      JSON.stringify({ deeply: { nested: 1 } }),
    ];

    for (const input of inputs) {
      const hash = getHash(input);

      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(-2147483648);
      expect(hash).toBeLessThanOrEqual(2147483647);
    }
  });
});

describe('getStableHash', () => {
  it('is independent of key insertion order', () => {
    // This is the whole reason for stable stringification.
    expect(getStableHash({ a: 1, b: 2 })).toBe(getStableHash({ b: 2, a: 1 }));
    expect(getStableHash({ a: { x: 1, y: 2 }, b: 2 })).toBe(
      getStableHash({ b: 2, a: { y: 2, x: 1 } }),
    );
  });

  it('still distinguishes different values', () => {
    expect(getStableHash({ a: 1 })).not.toBe(getStableHash({ a: 2 }));
  });

  it('hashes undefined to 0, via stringify returning undefined and getHash defaulting', () => {
    expect(getStableHash(undefined)).toBe(0);
  });

  it('returns a fresh random hash when the value cannot be stringified', () => {
    // A cycle makes json-stable-stringify throw. The fallback is deliberately random so that
    // an unhashable value always compares as changed — so this must never be snapshotted.
    const results = new Set<number>();

    expect(() => {
      for (let i = 0; i < 5; i += 1) {
        results.add(getStableHash(cyclic()));
      }
    }).not.toThrow();

    expect(results.size).toBeGreaterThan(1);
  });

  it('warns on an unstringifiable value only when the debug flag is on', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* swallow the warning under test */
    });

    getStableHash(cyclic());
    expect(warn).not.toHaveBeenCalled();

    localStorage.setItem('kizen-flag-script-runner-logging', 'true');
    getStableHash(cyclic());
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe('Failed to stringify object for hashing:');
  });
});
