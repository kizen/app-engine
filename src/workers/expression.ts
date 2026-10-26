/*
 * Pure evaluation logic for the expression worker. Kept dependency-free (type-only imports) so the
 * worker bundle stays small and the logic can be tested without a Worker.
 */

import type { UnknownJSON } from '../types/common.js';
import type { ExpressionPayload } from '../types/workers.js';

export interface ExpressionResponse {
  result: unknown;
  error?: string;
}

const getValue = (key: string, args: Record<string, UnknownJSON>): string => {
  const rawValue = args[key];

  if (!rawValue) {
    return 'null';
  }

  const value = typeof rawValue.value !== 'undefined' ? JSON.stringify(rawValue.value) : 'null';

  return value;
};

export const interpolateValues = (
  expression: string,
  args: Record<string, UnknownJSON>,
): string => {
  const interpolated = expression.replace(/{{(.*?)}}/g, (_, key: string) => {
    return getValue(key, args);
  });

  return interpolated;
};

export const evaluateExpression = (
  expression: string,
  args: Record<string, UnknownJSON>,
  isDebug: boolean,
): unknown => {
  const fnBody = `return ${interpolateValues(expression, args)};`;

  if (isDebug) {
    console.log(`Initial expression:\n${expression}\n\nInterpreted as:\n${fnBody}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(fnBody);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return fn();
};

const STANDARD_ERROR_NAMES = new Set([
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
]);

/*
 * Exception messages describe the *interpolated* source, so they can contain record values
 * (e.g. `"Jane Doe".foo is not a function`). Outside debug mode only a fixed category is
 * reported: the failure stage plus the error's name when it is a standard built-in name.
 */
const describeFailure = (stage: string, ex: unknown, isDebug: boolean): string => {
  let name = 'non-Error thrown';
  let detail = '';

  try {
    if (ex instanceof Error) {
      // Read once: a stateful getter could pass the allowlist and then return something else.
      const errorName: unknown = ex.name;

      name =
        typeof errorName === 'string' && STANDARD_ERROR_NAMES.has(errorName) ? errorName : 'Error';
    }

    if (isDebug) {
      detail = ex instanceof Error ? ex.message : String(ex);
    }
  } catch {
    // A hostile thrown value (throwing getters / toString) still gets the fixed category.
  }

  return detail ? `${stage} (${name}): ${detail}` : `${stage} (${name})`;
};

const failure = (error: string): string =>
  JSON.stringify({ result: null, error } satisfies ExpressionResponse);

/**
 * Parses a serialized ExpressionPayload, evaluates it, and returns the serialized response.
 * Never throws: parse, evaluation, and result-serialization failures (e.g. BigInt or cyclic
 * results) all produce `{ result: null, error }`. `error` is a fixed category unless the payload
 * sets `isDebug`, in which case the raw exception message is appended.
 */
export const buildExpressionResponse = (rawPayload: string): string => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    return failure('invalid payload');
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return failure('invalid payload');
  }

  const payload = parsed as ExpressionPayload;

  const { expression, args, isDebug = false } = payload;
  let result: unknown;

  try {
    result = evaluateExpression(expression, args, isDebug);
  } catch (ex) {
    return failure(describeFailure('evaluation failed', ex, isDebug));
  }

  try {
    return JSON.stringify({ result } satisfies ExpressionResponse);
  } catch (ex) {
    return failure(describeFailure('result not serializable', ex, isDebug));
  }
};

/*
 * Global handlers for errors that escape buildExpressionResponse: plugin-authored expressions can
 * schedule async work (`setTimeout(() => {{rec}}.foo())`, `Promise.reject({{rec}})`) whose
 * exception or rejection quotes interpolated record values. Cancelling stops the browser from
 * logging the raw value from the worker context.
 */

/**
 * Cancelling an `error` event at the worker global also stops it being forwarded to the parent's
 * Worker object (HTML "report an exception": the event is re-fired at the Worker only when not
 * cancelled), so post a sanitized failure instead. The host ignores it if it already settled.
 */
export const handleUncaughtError = (e: Event, post: (message: string) => void): void => {
  e.preventDefault();
  post(failure('uncaught error in expression worker'));
};

/** Rejections are never forwarded to the parent; cancelling only suppresses console reporting. */
export const handleUnhandledRejection = (e: Event): void => {
  e.preventDefault();
};
