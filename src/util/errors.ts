import type { UnknownJSON } from '../types/common.js';

export class KizenRequestError extends Error {
  public proxyStatus: number;
  public upstreamStatus?: number | undefined;
  public upstreamResponse?: UnknownJSON | undefined;

  constructor(
    proxyStatus: number,
    upstreamStatus?: number,
    upstreamResponse?: UnknownJSON,
    overrideMessage?: string,
  ) {
    super(
      overrideMessage ??
        (upstreamResponse?.error as { message?: string } | undefined)?.message ??
        (upstreamStatus
          ? `Request failed with status code ${String(upstreamStatus)}`
          : `Request failed with proxy status code ${String(proxyStatus)}`),
    );

    this.name = 'KizenRequestError';
    this.proxyStatus = proxyStatus;
    this.upstreamStatus = upstreamStatus;
    this.upstreamResponse = upstreamResponse;

    Object.setPrototypeOf(this, KizenRequestError.prototype);
  }
}
