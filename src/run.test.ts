import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPRESSION_TIMEOUT_MS, runExpression, runObjectExpression } from './run.js';
import { buildExpressionResponse } from './workers/expression.js';

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: ((e: MessageEvent) => void) | null = null;
  postMessage = vi.fn<(message: unknown) => void>();
  terminate = vi.fn<() => void>();

  constructor() {
    FakeWorker.instances.push(this);
  }

  respond(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  fail(message: string): ErrorEvent {
    const event = new ErrorEvent('error', { message, cancelable: true });

    this.onerror?.(event);

    return event;
  }
}

/** Runs the real worker logic on whatever the host posts, then replies like the real worker. */
class EvaluatingWorker extends FakeWorker {
  override postMessage = vi.fn<(message: unknown) => void>((message) => {
    this.respond(buildExpressionResponse(message as string));
  });
}

const SECRET = 'secret-record-data';

const latestWorker = (): FakeWorker => {
  const worker = FakeWorker.instances.at(-1);

  if (!worker) {
    throw new Error('No worker was created');
  }

  return worker;
};

/** Resolves to the settled value, or the sentinel if the promise is still pending. */
const PENDING = Symbol('pending');

const peek = async <T>(promise: Promise<T>): Promise<T | typeof PENDING> =>
  Promise.race([promise, Promise.resolve(PENDING)]);

describe('runUnknownExpression (via runExpression)', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('posts the expression and values to the worker', () => {
    void runExpression('{{a}} > 1', { a: { value: 2 } });

    const posted = JSON.parse(latestWorker().postMessage.mock.calls[0]?.[0] as string) as unknown;

    expect(posted).toEqual({
      expression: '{{a}} > 1',
      args: { a: { value: 2 } },
      isDebug: false,
    });
  });

  it('resolves the worker result and terminates on success', async () => {
    const promise = runObjectExpression('x', {});
    const worker = latestWorker();

    worker.respond(JSON.stringify({ result: { k: 1 } }));

    await expect(promise).resolves.toEqual({ k: 1 });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  describe.each([
    ['a method call on an interpolated value', '{{rec}}.map(x => x)'],
    ['JSON.parse of an interpolated value', 'JSON.parse({{rec}})'],
    ['a method call on a bare quoted value', '{{rec}}.foo()'],
  ])('real worker failure from %s', (_, expression) => {
    beforeEach(() => {
      vi.stubGlobal('Worker', EvaluatingWorker);
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
      localStorage.removeItem('kizen-flag-script-runner-logging');
    });

    it('resolves null and warns with the expression but no record values', async () => {
      await expect(runExpression(expression, { rec: { value: SECRET } })).resolves.toBeNull();

      expect(latestWorker().terminate).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);

      const message = String(warn.mock.calls[0]?.[0]);

      expect(message).toContain('evaluation failed');
      expect(message).toContain(expression);
      expect(message).not.toMatch(/evaluation failed \(\w+\):/);
      expect(message).not.toContain(SECRET);
    });

    it('includes the raw exception detail only when debug logging is enabled', async () => {
      localStorage.setItem('kizen-flag-script-runner-logging', 'true');

      await expect(runExpression(expression, { rec: { value: SECRET } })).resolves.toBeNull();

      const message = String(warn.mock.calls[0]?.[0]);

      // Proves the fixture really leaks through the raw message, so the non-debug test is meaningful.
      expect(message).toMatch(/evaluation failed \(\w+\): ./);
      expect(message).toContain(SECRET);
    });
  });

  it('forwards the worker error category for an error payload', async () => {
    const promise = runExpression('x', {});

    latestWorker().respond(
      JSON.stringify({ result: null, error: 'evaluation failed (TypeError)' }),
    );

    await expect(promise).resolves.toBeNull();
    expect(String(warn.mock.calls[0]?.[0])).toContain('evaluation failed (TypeError)');
  });

  it('resolves null and terminates on a malformed (non-JSON) response', async () => {
    const promise = runExpression('x', {});
    const worker = latestWorker();

    worker.respond('not json');

    await expect(promise).resolves.toBeNull();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('resolves null and terminates on a JSON response that is not an object', async () => {
    const promise = runExpression('x', {});
    const worker = latestWorker();

    worker.respond('null');

    await expect(promise).resolves.toBeNull();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('resolves null, terminates, cancels the event, and warns on worker onerror', async () => {
    const promise = runExpression('x', {});
    const worker = latestWorker();

    const event = worker.fail(`Uncaught TypeError: "${SECRET}".foo is not a function`);

    expect(event.defaultPrevented).toBe(true);

    await expect(promise).resolves.toBeNull();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).not.toContain(SECRET);
  });

  it('resolves null and terminates on onmessageerror', async () => {
    const promise = runExpression('x', {});
    const worker = latestWorker();

    worker.onmessageerror?.({} as MessageEvent);

    await expect(promise).resolves.toBeNull();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('resolves null, terminates, and warns when the worker never responds', async () => {
    vi.useFakeTimers();

    const promise = runExpression('x', {});
    const worker = latestWorker();

    expect(EXPRESSION_TIMEOUT_MS).toBe(20000);

    vi.advanceTimersByTime(EXPRESSION_TIMEOUT_MS - 1);

    expect(await peek(promise)).toBe(PENDING);
    expect(worker.terminate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    await expect(promise).resolves.toBeNull();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain(`${String(EXPRESSION_TIMEOUT_MS)}ms`);
  });

  it('clears the timeout once settled', async () => {
    vi.useFakeTimers();

    const promise = runExpression('x', {});

    latestWorker().respond(JSON.stringify({ result: true }));

    await expect(promise).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settles only once when several failure signals arrive', async () => {
    vi.useFakeTimers();

    const promise = runExpression('x', {});
    const worker = latestWorker();

    worker.respond(JSON.stringify({ result: true }));
    worker.fail('late error');
    worker.respond(JSON.stringify({ result: false }));
    vi.advanceTimersByTime(EXPRESSION_TIMEOUT_MS);

    await expect(promise).resolves.toBe(true);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('resolves null when the Worker constructor throws', async () => {
    vi.stubGlobal(
      'Worker',
      vi.fn(function () {
        throw new Error(`Workers unavailable ${SECRET}`);
      }),
    );

    await expect(runExpression('x', {})).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).not.toContain(SECRET);
  });

  it('resolves null and terminates when postMessage throws', async () => {
    class ThrowingPostWorker extends FakeWorker {
      override postMessage = vi.fn<(message: unknown) => void>(() => {
        throw new Error('DataCloneError');
      });
    }

    vi.stubGlobal('Worker', ThrowingPostWorker);

    await expect(runExpression('x', {})).resolves.toBeNull();
    expect(latestWorker().terminate).toHaveBeenCalledTimes(1);
  });
});
