import { describe, expect, it } from 'vitest';
import type { KizenNetworkResponse, KizenProxySuccessResponse } from '../types/request.js';
import { KizenRequestError } from './errors.js';
import {
  createKizenProxyError,
  createKizenRequestError,
  getModifiedResponse,
  handleKizenNetworkResponse,
} from './network.js';

const proxyResponse = (
  data: KizenProxySuccessResponse,
  status = 200,
): KizenNetworkResponse<KizenProxySuccessResponse> => ({ data, status });

describe('getModifiedResponse', () => {
  it('unwraps the proxy envelope onto data and status', () => {
    const result = getModifiedResponse(proxyResponse({ body: { id: 1 }, status_code: 201 }, 200));

    expect(result.response.data).toEqual({ id: 1 });
    expect(result.response.status).toBe(201);
    expect(result.upstreamStatus).toBe(201);
    expect(result.upstreamResponse).toEqual({ id: 1 });
  });

  it('falls back to the proxy status when the envelope has no status_code', () => {
    const result = getModifiedResponse(proxyResponse({ body: { id: 1 } }, 204));

    expect(result.response.status).toBe(204);
    expect(result.upstreamStatus).toBe(204);
  });

  it('treats a null body as absent and surfaces the whole envelope as data', () => {
    // `response.data.body ?? response.data` means a genuinely null upstream body is
    // indistinguishable from a missing one, and the envelope itself leaks through as data.
    const result = getModifiedResponse(proxyResponse({ body: null, status_code: 200 }, 200));

    expect(result.response.data).toEqual({ body: null, status_code: 200 });
    expect(result.upstreamResponse).toBeNull();
  });
});

describe('createKizenRequestError', () => {
  it('builds a KizenRequestError from the proxy and upstream statuses', () => {
    const error = createKizenRequestError(200, 422, { error: { message: 'invalid' } });

    expect(error).toBeInstanceOf(KizenRequestError);
    expect(error.message).toBe('invalid');
    expect(error.proxyStatus).toBe(200);
    expect(error.upstreamStatus).toBe(422);
  });
});

describe('createKizenProxyError', () => {
  it('defaults to a 500 with a generic proxy message', () => {
    const error = createKizenProxyError();

    expect(error.proxyStatus).toBe(500);
    expect(error.message).toBe('An unknown error occurred in the proxy');
    expect(error.upstreamStatus).toBeUndefined();
    expect(error.upstreamResponse).toBeUndefined();
  });

  it('uses the supplied status and message', () => {
    const error = createKizenProxyError(503, 'proxy is down');

    expect(error.proxyStatus).toBe(503);
    expect(error.message).toBe('proxy is down');
  });
});

describe('handleKizenNetworkResponse', () => {
  it('returns the unwrapped response for a success status', () => {
    const result = handleKizenNetworkResponse(
      proxyResponse({ body: { ok: true }, status_code: 200 }),
    );

    expect(result.data).toEqual({ ok: true });
    expect(result.status).toBe(200);
  });

  it('returns at the 399/400 boundary and throws just past it', () => {
    expect(() =>
      handleKizenNetworkResponse(proxyResponse({ body: { ok: true }, status_code: 399 })),
    ).not.toThrow();
    expect(() =>
      handleKizenNetworkResponse(proxyResponse({ body: { detail: 'nope' }, status_code: 400 })),
    ).toThrow(KizenRequestError);
  });

  it('reports proxyStatus 200 on the thrown error, because the PROXY call succeeded', () => {
    // A thrown error here means the proxy round-trip worked and the upstream request failed,
    // so the proxy status is deliberately hard-coded to 200 rather than echoing the upstream.
    let thrown: unknown;

    try {
      handleKizenNetworkResponse(
        proxyResponse({ body: { error: { message: 'upstream blew up' } }, status_code: 500 }, 200),
      );
    } catch (ex) {
      thrown = ex;
    }

    expect(thrown).toBeInstanceOf(KizenRequestError);
    const error = thrown as KizenRequestError;

    expect(error.proxyStatus).toBe(200);
    expect(error.upstreamStatus).toBe(500);
    expect(error.message).toBe('upstream blew up');
  });
});
