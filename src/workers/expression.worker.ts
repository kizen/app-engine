import type { UnknownJSON } from '../types/common.js';
import type { ExpressionPayload } from '../types/workers.js';

const interpolateValues = (expression: string, args: Record<string, UnknownJSON>): string => {
  const interpolated = expression.replace(/{{(.*?)}}/g, (_, key: string) => {
    return getValue(key, args);
  });

  return interpolated;
};

const evaluateExpression = (
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

const getValue = (key: string, args: Record<string, UnknownJSON>): string => {
  const rawValue = args[key];

  if (!rawValue) {
    return 'null';
  }

  const value = typeof rawValue.value !== 'undefined' ? JSON.stringify(rawValue.value) : 'null';

  return value;
};

self.onmessage = (e: MessageEvent<string>): void => {
  const data = JSON.parse(e.data) as ExpressionPayload;

  const { expression, args, isDebug = false } = data;

  const result = evaluateExpression(expression, args, isDebug);

  self.postMessage(JSON.stringify({ result }));
};
