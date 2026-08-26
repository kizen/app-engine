import { describe, expect, it } from 'vitest';
import { deserializeConsoleArg, serializeConsoleArg } from './console.js';

const roundTrip = (value: unknown): unknown => deserializeConsoleArg(serializeConsoleArg(value));

describe('structured-clone-safe passthrough', () => {
  it('leaves primitives untouched', () => {
    expect(roundTrip('hello')).toBe('hello');
    expect(roundTrip(42)).toBe(42);
    expect(roundTrip(true)).toBe(true);
    expect(roundTrip(null)).toBeNull();
  });

  it('walks nested objects and arrays', () => {
    expect(roundTrip({ a: [1, { b: 'two' }] })).toEqual({ a: [1, { b: 'two' }] });
  });
});

describe('markers that round-trip to an equivalent value', () => {
  it('restores undefined', () => {
    expect(serializeConsoleArg(undefined)).toEqual({ __kzConsole: 'undefined' });
    expect(roundTrip(undefined)).toBeUndefined();
    expect(roundTrip({ a: undefined })).toEqual({ a: undefined });
  });

  it('restores a BigInt', () => {
    expect(serializeConsoleArg(10n)).toEqual({ __kzConsole: 'bigint', value: '10' });
    expect(roundTrip(10n)).toBe(10n);
  });

  it('restores a Date', () => {
    const date = new Date('2024-03-01T12:34:56.000Z');

    expect(serializeConsoleArg(date)).toEqual({
      __kzConsole: 'date',
      value: '2024-03-01T12:34:56.000Z',
    });
    expect(roundTrip(date)).toEqual(date);
  });

  it('restores a RegExp with its source and flags', () => {
    expect(serializeConsoleArg(/ab+c/gi)).toEqual({ __kzConsole: 'regexp', value: '/ab+c/gi' });

    const result = roundTrip(/ab+c/gi);

    expect(result).toBeInstanceOf(RegExp);
    expect((result as RegExp).source).toBe('ab+c');
    expect((result as RegExp).flags).toBe('gi');
  });

  it('restores an Error, including its subclass name', () => {
    const original = new TypeError('bad type');
    const result = roundTrip(original);

    expect(result).toBeInstanceOf(Error);
    expect((result as Error).name).toBe('TypeError');
    expect((result as Error).message).toBe('bad type');
    expect((result as Error).stack).toBe(original.stack);
  });
});

describe('markers that round-trip to a lossy stand-in', () => {
  it('turns a Symbol into its description string', () => {
    expect(serializeConsoleArg(Symbol('x'))).toEqual({ __kzConsole: 'symbol', value: 'Symbol(x)' });
    expect(roundTrip(Symbol('x'))).toBe('Symbol(x)');
  });

  it('turns a named function into a label', () => {
    function namedFn(): void {
      /* empty */
    }

    expect(roundTrip(namedFn)).toBe('[Function: namedFn]');
  });

  it('labels an unnamed function "anonymous"', () => {
    // A function returned rather than assigned gets no inferred name.
    const makeAnonymous = (): (() => void) => () => {
      /* empty */
    };
    const anonymous = makeAnonymous();

    expect(anonymous.name).toBe('');
    expect(roundTrip(anonymous)).toBe('[Function: anonymous]');
  });

  it('reports an invalid Date as unserializable rather than throwing', () => {
    // toISOString() throws a RangeError on an invalid Date.
    expect(serializeConsoleArg(new Date(NaN))).toEqual({
      __kzConsole: 'unserializable',
      reason: 'invalid Date',
    });
    expect(roundTrip(new Date(NaN))).toBe('[Unserializable: invalid Date]');
  });
});

describe('cycles', () => {
  it('replaces a true self-reference with a circular marker instead of overflowing', () => {
    const cyclic: Record<string, unknown> = { name: 'root' };
    cyclic.self = cyclic;

    expect(() => serializeConsoleArg(cyclic)).not.toThrow();
    expect(serializeConsoleArg(cyclic)).toEqual({
      name: 'root',
      self: { __kzConsole: 'circular' },
    });
    expect(roundTrip(cyclic)).toEqual({ name: 'root', self: '[Circular]' });
  });
});

describe('marker collisions in user data', () => {
  it('passes an object with an unrecognised __kzConsole tag through as a plain object', () => {
    const collision = { __kzConsole: 'bogus', a: 1 };

    expect(serializeConsoleArg(collision)).toEqual(collision);
    expect(roundTrip(collision)).toEqual(collision);
  });
});
