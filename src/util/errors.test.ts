import { describe, expect, it } from 'vitest';
import { KizenRequestError } from './errors.js';

describe('KizenRequestError message precedence', () => {
  it('prefers an explicit override over everything else', () => {
    const error = new KizenRequestError(
      200,
      500,
      { error: { message: 'upstream said no' } },
      'override wins',
    );

    expect(error.message).toBe('override wins');
  });

  it('falls back to the upstream response error message', () => {
    const error = new KizenRequestError(200, 500, { error: { message: 'upstream said no' } });

    expect(error.message).toBe('upstream said no');
  });

  it('falls back to the upstream status when there is no upstream message', () => {
    const error = new KizenRequestError(200, 404);

    expect(error.message).toBe('Request failed with status code 404');
  });

  it('falls back to the proxy status when there is no upstream status', () => {
    const error = new KizenRequestError(502);

    expect(error.message).toBe('Request failed with proxy status code 502');
  });

  it('treats upstreamStatus 0 as absent and reports the PROXY status instead', () => {
    // The check at errors.ts is truthiness, not `!== undefined`, so a 0 upstream status
    // (a network-level failure with no HTTP response) reports the proxy status.
    const error = new KizenRequestError(504, 0);

    expect(error.message).toBe('Request failed with proxy status code 504');
    expect(error.upstreamStatus).toBe(0);
  });
});

describe('KizenRequestError shape', () => {
  it('is recognisable as both an Error and a KizenRequestError', () => {
    const error = new KizenRequestError(200, 400, { detail: 'bad' });

    // Object.setPrototypeOf in the constructor is what keeps `instanceof` working after
    // the class is downleveled by the bundler.
    expect(error).toBeInstanceOf(KizenRequestError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('KizenRequestError');
  });

  it('retains the proxy status, upstream status and upstream response', () => {
    const upstreamResponse = { detail: 'bad' };
    const error = new KizenRequestError(200, 400, upstreamResponse);

    expect(error.proxyStatus).toBe(200);
    expect(error.upstreamStatus).toBe(400);
    expect(error.upstreamResponse).toBe(upstreamResponse);
  });
});
