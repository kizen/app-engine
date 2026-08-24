import { afterEach, describe, expect, it } from 'vitest';
import { isFlagEnabled } from './flags.js';

afterEach(() => {
  localStorage.clear();
});

describe('isFlagEnabled', () => {
  it('reads from the kizen-flag- namespace in localStorage', () => {
    localStorage.setItem('kizen-flag-my-feature', 'true');

    expect(isFlagEnabled('my-feature')).toBe(true);
    // The bare identifier is not consulted.
    expect(localStorage.getItem('my-feature')).toBeNull();
  });

  it('is false when the flag was never set', () => {
    expect(isFlagEnabled('my-feature')).toBe(false);
  });

  it('requires the exact string "true"', () => {
    for (const value of ['TRUE', 'True', '1', '', 'yes', 'false']) {
      localStorage.setItem('kizen-flag-my-feature', value);
      expect(isFlagEnabled('my-feature')).toBe(false);
    }
  });

  it('does not treat a different flag as enabled', () => {
    localStorage.setItem('kizen-flag-other-feature', 'true');

    expect(isFlagEnabled('my-feature')).toBe(false);
  });
});
