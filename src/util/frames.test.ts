import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as FramesModule from './frames.js';
import {
  buildIframeURLWithProxy,
  filterAllowList,
  filterSandboxList,
  FRAME_PROXY_DOMAIN_DEV,
  FRAME_PROXY_DOMAIN_PROD,
  getParentFrameAllowParam,
  isFrameProxyOrigin,
  unwrapProxyMessage,
} from './frames.js';

const PROD_ORIGIN = `https://${FRAME_PROXY_DOMAIN_PROD}`;
const DEV_ORIGIN = `https://${FRAME_PROXY_DOMAIN_DEV}`;

const messageFrom = (origin: string, data: unknown): MessageEvent =>
  new MessageEvent('message', { origin, data });

describe('isFrameProxyOrigin', () => {
  it('recognises both proxy domains and nothing else', () => {
    expect(isFrameProxyOrigin(PROD_ORIGIN)).toBe(true);
    expect(isFrameProxyOrigin(DEV_ORIGIN)).toBe(true);
    expect(isFrameProxyOrigin('https://example.com')).toBe(false);
    // Scheme is part of the comparison.
    expect(isFrameProxyOrigin(`http://${FRAME_PROXY_DOMAIN_PROD}`)).toBe(false);
  });
});

describe('unwrapProxyMessage', () => {
  it('passes a message from a non-proxy origin straight through', () => {
    const data = { some: 'payload' };

    expect(unwrapProxyMessage(messageFrom('https://example.com', data))).toEqual({
      handled: true,
      data,
    });
  });

  it('unwraps a valid proxy envelope down to its data', () => {
    const envelope = {
      plugin_api_name: 'my_plugin',
      source_url: 'https://example.com/app',
      event: 'message',
      data: { hello: 'world' },
      _kizen_proxy_nonce: 'nonce',
    };

    expect(unwrapProxyMessage(messageFrom(PROD_ORIGIN, envelope))).toEqual({
      handled: true,
      data: { hello: 'world' },
    });
  });

  it('declines a proxy envelope whose event is not "message"', () => {
    for (const event of ['loaded', 'error']) {
      const envelope = {
        plugin_api_name: 'my_plugin',
        source_url: 'https://example.com/app',
        event,
        _kizen_proxy_nonce: 'nonce',
      };

      expect(unwrapProxyMessage(messageFrom(PROD_ORIGIN, envelope))).toEqual({ handled: false });
    }
  });

  it('declines non-object data from a proxy origin', () => {
    expect(unwrapProxyMessage(messageFrom(PROD_ORIGIN, 'a bare string'))).toEqual({
      handled: false,
    });
    expect(unwrapProxyMessage(messageFrom(PROD_ORIGIN, null))).toEqual({ handled: false });
    expect(unwrapProxyMessage(messageFrom(PROD_ORIGIN, 42))).toEqual({ handled: false });
  });
});

describe('buildIframeURLWithProxy', () => {
  it('routes a plain URL through the production proxy', () => {
    const result = buildIframeURLWithProxy('https://example.com/app?a=1');

    expect(result).toEqual({
      url: `${PROD_ORIGIN}?url=${encodeURIComponent('https://example.com/app?a=1')}&allow=`,
      isUsingProxy: true,
    });
  });

  it('routes through the dev proxy in dev mode', () => {
    const result = buildIframeURLWithProxy('https://example.com/app', { useDevMode: true });

    expect(result.url.startsWith(`${DEV_ORIGIN}?url=`)).toBe(true);
    expect(result.isUsingProxy).toBe(true);
  });

  it('encodes the allow string into the proxy URL', () => {
    const result = buildIframeURLWithProxy('https://example.com/app', {}, 'camera *; microphone *');

    expect(result.url).toBe(
      `${PROD_ORIGIN}?url=${encodeURIComponent('https://example.com/app')}&allow=${encodeURIComponent('camera *; microphone *')}`,
    );
  });

  it('leaves an already-proxied URL verbatim rather than double-wrapping it', () => {
    const alreadyProxied = `${PROD_ORIGIN}?url=${encodeURIComponent('https://example.com/app')}&allow=`;

    expect(buildIframeURLWithProxy(alreadyProxied)).toEqual({
      url: alreadyProxied,
      isUsingProxy: true,
    });
  });

  it('returns the URL verbatim and unproxied when the proxy is explicitly skipped', () => {
    expect(
      buildIframeURLWithProxy('https://example.com/app', { __dangerouslySkipProxy: true }),
    ).toEqual({ url: 'https://example.com/app', isUsingProxy: false });
  });

  it('warns and yields an empty URL for an unparseable input', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* swallow the warning under test */
    });

    expect(buildIframeURLWithProxy('not a url')).toEqual({ url: '', isUsingProxy: false });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('Failed to parse URL: not a url');
  });
});

describe('filterAllowList / filterSandboxList', () => {
  it('keeps allowed entries and drops the rest', () => {
    expect(filterAllowList(['camera', 'microphone', 'geolocation', 'payment'])).toEqual([
      'camera',
      'microphone',
    ]);
    expect(
      filterSandboxList(['allow-scripts', 'allow-top-navigation', 'allow-same-origin']),
    ).toEqual(['allow-scripts', 'allow-same-origin']);
  });

  it('keeps an allowed field carrying a wildcard origin', () => {
    // Permissions-Policy entries are "<field> <allowlist>", e.g. `camera *`, so the allow filter
    // matches on the field name rather than the whole entry.
    expect(filterAllowList(['camera *', 'microphone *'])).toEqual(['camera *', 'microphone *']);
  });

  it('returns an empty list when nothing is allowed', () => {
    expect(filterAllowList([])).toEqual([]);
    expect(filterAllowList(['geolocation'])).toEqual([]);
    expect(filterSandboxList([])).toEqual([]);
  });
});

describe('getParentFrameAllowParam', () => {
  it('builds the full wildcard allow header', () => {
    expect(getParentFrameAllowParam()).toBe(
      'microphone *; speaker-selection *; autoplay *; camera *; display-capture *; hid *',
    );
  });
});

describe('the __LOCAL_PROXY_ORIGIN__ build-time override', () => {
  // `hasLocalProxy` is captured in a module-scope IIFE, so it is frozen at first import and can
  // only be re-evaluated by resetting the module registry and importing again.
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const importWithLocalProxy = async (origin: string): Promise<typeof FramesModule> => {
    vi.stubGlobal('__LOCAL_PROXY_ORIGIN__', origin);
    vi.resetModules();

    return import('./frames.js');
  };

  it('treats a localhost origin as a proxy origin and routes iframes through it', async () => {
    const frames = await importWithLocalProxy('http://localhost:8080');

    expect(frames.isFrameProxyOrigin('http://localhost:8080')).toBe(true);
    expect(frames.buildIframeURLWithProxy('https://example.com/app')).toEqual({
      url: `http://localhost:8080?url=${encodeURIComponent('https://example.com/app')}&allow=`,
      isUsingProxy: true,
    });
  });

  it('still recognises the hosted proxy domains when a local proxy is configured', async () => {
    const frames = await importWithLocalProxy('http://127.0.0.1:8080');

    expect(frames.isFrameProxyOrigin('http://127.0.0.1:8080')).toBe(true);
    expect(frames.isFrameProxyOrigin(PROD_ORIGIN)).toBe(true);
  });

  it('ignores a non-localhost origin, so it cannot be pointed at an arbitrary host', async () => {
    const frames = await importWithLocalProxy('https://evil.example.com');

    expect(frames.isFrameProxyOrigin('https://evil.example.com')).toBe(false);
    expect(frames.buildIframeURLWithProxy('https://example.com/app').url).toBe(
      `${PROD_ORIGIN}?url=${encodeURIComponent('https://example.com/app')}&allow=`,
    );
  });

  it('ignores an unparseable origin', async () => {
    const frames = await importWithLocalProxy('not a url');

    expect(
      frames.buildIframeURLWithProxy('https://example.com/app').url.startsWith(PROD_ORIGIN),
    ).toBe(true);
  });
});
