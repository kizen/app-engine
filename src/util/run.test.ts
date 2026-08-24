import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ROUTE_CHANGE_INTERNAL_EVENT } from '../communication/constants.js';
import {
  buildCodeRunnerFunction,
  emitRouteChange,
  findMatchingAction,
  generateExecutionKey,
  generateUUIDV4,
  getPartialLocation,
} from './run.js';

/*
 * The body produced by buildCodeRunnerFunction reads __setup, __cleanup, onError and console off
 * `this`, so it has to be invoked with .call(). A bare fn() leaves `this` undefined and throws.
 */
type ConsoleMock = Mock<(...args: unknown[]) => void>;

interface RunnerContext {
  __setup: Mock<() => void>;
  __cleanup: Mock<(result?: unknown) => void>;
  onError: Mock<(error: unknown) => void>;
  console: { log: ConsoleMock; warn: ConsoleMock; error: ConsoleMock };
}

const makeContext = (): RunnerContext => ({
  __setup: vi.fn<() => void>(),
  __cleanup: vi.fn<(result?: unknown) => void>(),
  onError: vi.fn<(error: unknown) => void>(),
  console: {
    log: vi.fn<(...args: unknown[]) => void>(),
    warn: vi.fn<(...args: unknown[]) => void>(),
    error: vi.fn<(...args: unknown[]) => void>(),
  },
});

describe('getPartialLocation', () => {
  it('mirrors exactly the eight location fields', () => {
    const location = getPartialLocation();

    expect(Object.keys(location).sort()).toEqual([
      'hash',
      'host',
      'href',
      'origin',
      'pathname',
      'port',
      'protocol',
      'search',
    ]);
    expect(location).toEqual({
      host: window.location.host,
      hash: window.location.hash,
      href: window.location.href,
      origin: window.location.origin,
      pathname: window.location.pathname,
      search: window.location.search,
      port: window.location.port,
      protocol: window.location.protocol,
    });
  });
});

describe('generateUUIDV4', () => {
  it('produces a v4-shaped UUID', () => {
    // The implementation is Date + Math.random based, not crypto, so only the shape is a contract.
    expect(generateUUIDV4()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('does not collide across 1000 calls', () => {
    const ids = new Set<string>();

    for (let i = 0; i < 1000; i += 1) {
      ids.add(generateUUIDV4());
    }

    expect(ids.size).toBe(1000);
  });
});

describe('generateExecutionKey', () => {
  it('yields three separators when there is no plugin config at all', () => {
    expect(generateExecutionKey()).toBe('---');
    expect(generateExecutionKey(undefined)).toBe('---');
  });

  it('joins the four identifying fields in order', () => {
    expect(
      generateExecutionKey({
        plugin_api_name: 'my_plugin',
        api_name: 'my_action',
        id: 'id1',
        script_id: 'script1',
      }),
    ).toBe('my_plugin-id1-my_action-script1');
  });

  it('substitutes empty strings for missing optional fields', () => {
    expect(generateExecutionKey({ plugin_api_name: 'my_plugin', api_name: 'my_action' })).toBe(
      'my_plugin--my_action-',
    );
  });
});

describe('emitRouteChange', () => {
  const listeners: EventListener[] = [];

  const listen = (listener: EventListener): void => {
    listeners.push(listener);
    window.addEventListener(ROUTE_CHANGE_INTERNAL_EVENT, listener);
  };

  afterEach(() => {
    // emitRouteChange dispatches on the jsdom window shared by every test in this file.
    while (listeners.length > 0) {
      const listener = listeners.pop();

      if (listener) {
        window.removeEventListener(ROUTE_CHANGE_INTERNAL_EVENT, listener);
      }
    }
  });

  it('dispatches one event carrying the current partial location', () => {
    const listener = vi.fn();

    listen(listener);
    emitRouteChange();

    expect(listener).toHaveBeenCalledTimes(1);

    const event = listener.mock.calls[0]?.[0] as CustomEvent<{ location: { origin: string } }>;

    expect(event.type).toBe(ROUTE_CHANGE_INTERNAL_EVENT);
    expect(event.detail.location.origin).toBe(window.location.origin);
  });
});

describe('buildCodeRunnerFunction — a script that succeeds', () => {
  it('runs setup, then hands the return value to cleanup, without reporting an error', async () => {
    const ctx = makeContext();
    const { fn } = buildCodeRunnerFunction('return 42');

    await fn.call(ctx);

    expect(ctx.__setup).toHaveBeenCalledTimes(1);
    expect(ctx.__cleanup).toHaveBeenCalledTimes(1);
    expect(ctx.__cleanup).toHaveBeenCalledWith(42);
    expect(ctx.onError).not.toHaveBeenCalled();
  });

  it('cleans up with undefined for a script that returns nothing', async () => {
    const ctx = makeContext();
    const { fn } = buildCodeRunnerFunction('');

    await fn.call(ctx);

    expect(ctx.__setup).toHaveBeenCalledTimes(1);
    expect(ctx.__cleanup).toHaveBeenCalledWith(undefined);
    expect(ctx.onError).not.toHaveBeenCalled();
  });

  it('awaits an async script before cleaning up', async () => {
    const ctx = makeContext();
    const { fn } = buildCodeRunnerFunction('return await Promise.resolve("done")');

    await fn.call(ctx);

    expect(ctx.__cleanup).toHaveBeenCalledWith('done');
  });

  it('exposes the injected console to the script instead of the real one', async () => {
    const ctx = makeContext();
    const { fn } = buildCodeRunnerFunction('console.log("from the script"); return 1');

    await fn.call(ctx);

    expect(ctx.console.log).toHaveBeenCalledWith('from the script');
  });
});

describe('buildCodeRunnerFunction — a script that throws at runtime', () => {
  it('reports the error and STILL cleans up, in that order', async () => {
    const ctx = makeContext();
    const { fn } = buildCodeRunnerFunction('throw new Error("boom")');

    await fn.call(ctx);

    expect(ctx.__setup).toHaveBeenCalledTimes(1);
    expect(ctx.onError).toHaveBeenCalledTimes(1);
    expect(ctx.__cleanup).toHaveBeenCalledTimes(1);

    const error = ctx.onError.mock.calls[0]?.[0] as Error;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('boom');

    // The cleanup lives in a `finally`, so the ordering — report, then clean up — is the contract.
    const onErrorOrder = ctx.onError.mock.invocationCallOrder[0] ?? -1;
    const cleanupOrder = ctx.__cleanup.mock.invocationCallOrder[0] ?? -1;

    expect(onErrorOrder).toBeLessThan(cleanupOrder);
    expect(ctx.__cleanup).toHaveBeenCalledWith(undefined);
  });

  it('embeds the original script in the function body', () => {
    const { functionBody } = buildCodeRunnerFunction('throw new Error("boom")');

    expect(functionBody).toContain('throw new Error("boom")');
    expect(functionBody).not.toContain('syntax error');
  });
});

describe('buildCodeRunnerFunction — a script that fails to parse', () => {
  it('falls back to a stand-in body at CONSTRUCTION time', () => {
    const { functionBody } = buildCodeRunnerFunction('const = ;');

    // Construction of the AsyncFunction throws, so the returned body is the fallback, not the
    // script — this is a different code path from a script that parses and then throws.
    expect(functionBody).toContain('syntax error');
    expect(functionBody).not.toContain('const = ;');
  });

  it('reports a syntax error and cleans up when invoked', async () => {
    const ctx = makeContext();
    const { fn } = buildCodeRunnerFunction('const = ;');

    await fn.call(ctx);

    expect(ctx.__setup).toHaveBeenCalledTimes(1);
    expect(ctx.onError).toHaveBeenCalledTimes(1);
    expect(ctx.onError).toHaveBeenCalledWith({
      message: 'The script has a syntax error and could not be parsed',
    });
    // The fallback body calls __cleanup with no arguments at all.
    expect(ctx.__cleanup).toHaveBeenCalledWith();
  });
});

describe('findMatchingAction', () => {
  const actions = [
    { apiName: 'standalone' },
    { apiName: 'deploy', pluginApp: { apiName: 'my_plugin' } },
  ];

  it('returns null — not undefined — when no apiName is supplied', () => {
    expect(findMatchingAction(actions)).toBeNull();
    expect(findMatchingAction(actions, '')).toBeNull();
  });

  it('matches a "plugin.action" name against the plugin-scoped action', () => {
    expect(findMatchingAction(actions, 'my_plugin.deploy')).toEqual({
      apiName: 'deploy',
      pluginApp: { apiName: 'my_plugin' },
    });
  });

  it('returns undefined — not null — when nothing matches', () => {
    expect(findMatchingAction(actions, 'my_plugin.missing')).toBeUndefined();
    expect(findMatchingAction(actions, 'other_plugin.deploy')).toBeUndefined();
  });
});
