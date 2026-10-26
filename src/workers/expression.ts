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

const describeFailure = (stage: string, ex: unknown, isDebug: boolean): string => {
  let name = 'non-Error thrown';
  let detail = '';

  try {
    if (ex instanceof Error) {
      const errorName: unknown = ex.name;

      name =
        typeof errorName === 'string' && STANDARD_ERROR_NAMES.has(errorName) ? errorName : 'Error';
    }

    if (isDebug) {
      detail = ex instanceof Error ? ex.message : String(ex);
    }
  } catch {}

  return detail ? `${stage} (${name}): ${detail}` : `${stage} (${name})`;
};

const failure = (error: string): string =>
  JSON.stringify({ result: null, error } satisfies ExpressionResponse);

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

export const handleUncaughtError = (e: Event, post: (message: string) => void): void => {
  e.preventDefault();
  post(failure('uncaught error in expression worker'));
};

export const handleUnhandledRejection = (e: Event): void => {
  e.preventDefault();
};
