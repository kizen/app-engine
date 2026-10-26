import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnknownJSON } from '../types/common.js';
import { buildExpressionResponse, interpolateValues } from './expression.js';

const payload = (expression: string, args: Record<string, UnknownJSON> = {}): string =>
  JSON.stringify({ expression, args });

const respond = (expression: string, args: Record<string, UnknownJSON> = {}): unknown =>
  JSON.parse(buildExpressionResponse(payload(expression, args)));

describe('interpolateValues', () => {
  it('substitutes present values as JSON and missing args as null', () => {
    expect(interpolateValues('{{a}} + {{b}}', { a: { value: 'x' } })).toBe('"x" + null');
  });

  it('substitutes null for an arg whose value is undefined', () => {
    expect(interpolateValues('{{a}}', { a: {} })).toBe('null');
  });
});

const SECRET = 'secret-record-data';

const respondDebug = (expression: string, args: Record<string, UnknownJSON> = {}): unknown =>
  JSON.parse(buildExpressionResponse(JSON.stringify({ expression, args, isDebug: true })));

describe('buildExpressionResponse', () => {
  it('returns the evaluated result for a valid expression', () => {
    expect(respond('{{a}} > 1', { a: { value: 2 } })).toEqual({ result: true });
  });

  it('returns object results intact', () => {
    expect(respond('{ k: {{a}} }', { a: { value: [1, 2] } })).toEqual({ result: { k: [1, 2] } });
  });

  it('reports a fixed category when the expression throws', () => {
    // Missing arg interpolates to null, so reading a property off it throws a TypeError.
    expect(respond('{{missing}}.value', {})).toEqual({
      result: null,
      error: 'evaluation failed (TypeError)',
    });
  });

  it('reports a fixed category for a syntax error', () => {
    expect(respond('(((')).toEqual({ result: null, error: 'evaluation failed (SyntaxError)' });
  });

  it('reports a non-standard error name as plain Error', () => {
    const expression = `(() => { const e = new Error('x'); e.name = {{rec}}; throw e; })()`;

    expect(respond(expression, { rec: { value: SECRET } })).toEqual({
      result: null,
      error: 'evaluation failed (Error)',
    });
  });

  it('reports a fixed category when a non-Error value is thrown', () => {
    expect(respond('(() => { throw {{rec}}; })()', { rec: { value: SECRET } })).toEqual({
      result: null,
      error: 'evaluation failed (non-Error thrown)',
    });
  });

  it('reports a serialization failure when the result is a BigInt', () => {
    expect(respond('10n')).toEqual({ result: null, error: 'result not serializable (TypeError)' });
  });

  it('reports a serialization failure when the result is cyclic', () => {
    expect(respond('(() => { const o = {}; o.self = o; return o; })()')).toEqual({
      result: null,
      error: 'result not serializable (TypeError)',
    });
  });

  it.each(['null', '42', '"str"', '[]', 'true'])(
    'reports an invalid payload for non-object JSON %s',
    (raw) => {
      expect(JSON.parse(buildExpressionResponse(raw))).toEqual({
        result: null,
        error: 'invalid payload',
      });
    },
  );

  it('reports an invalid payload for non-JSON input', () => {
    expect(JSON.parse(buildExpressionResponse('not json'))).toEqual({
      result: null,
      error: 'invalid payload',
    });
  });

  it.each([
    ['a method call on an interpolated value', '{{rec}}.map(x => x)'],
    ['JSON.parse of an interpolated value', 'JSON.parse({{rec}})'],
    ['a method call on a bare quoted value', '{{rec}}.foo()'],
  ])('never includes record values from %s outside debug', (_, expression) => {
    const response = respond(expression, { rec: { value: SECRET } }) as { error: string };

    expect(response.error).toMatch(/^evaluation failed \((TypeError|SyntaxError)\)$/);
    expect(JSON.stringify(response)).not.toContain(SECRET);
  });

  describe('with isDebug', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    it('appends the raw exception message', () => {
      const response = respondDebug('{{rec}}.foo()', { rec: { value: SECRET } }) as {
        result: unknown;
        error: string;
      };

      expect(response.result).toBeNull();
      expect(response.error).toMatch(/^evaluation failed \(TypeError\): /);
      expect(response.error).toContain(SECRET);
    });

    it('appends a thrown non-Error value', () => {
      expect(respondDebug('(() => { throw "boom"; })()')).toEqual({
        result: null,
        error: 'evaluation failed (non-Error thrown): boom',
      });
    });

    it('appends the serialization error message', () => {
      const response = respondDebug('10n') as { error: string };

      expect(response.error).toMatch(/^result not serializable \(TypeError\): ./);
    });
  });
});
