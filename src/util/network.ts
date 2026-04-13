import type { KizenNetworkResponse, KizenProxySuccessResponse } from '../types/request.js';
import type { UnknownJSON } from '../types/common.js';

export const getModifiedResponse = (
  response: KizenNetworkResponse<KizenProxySuccessResponse>,
): {
  response: KizenNetworkResponse;
  upstreamStatus: number;
  upstreamResponse: unknown;
} => {
  const modifiedResponse = {
    ...response,
    data: response.data.body ?? response.data,
    status: response.data.status_code ?? response.status,
  };

  return {
    response: modifiedResponse,
    upstreamStatus: modifiedResponse.status,
    upstreamResponse: response.data.body,
  };
};

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
    super(overrideMessage ?? `Request failed with status code ${String(upstreamStatus)}`);
    this.name = 'KizenRequestError';
    this.proxyStatus = proxyStatus;
    this.upstreamStatus = upstreamStatus;
    this.upstreamResponse = upstreamResponse;
  }
}

export const createKizenRequestError = (
  proxyStatus: number,
  upstreamStatus?: number,
  upstreamResponse?: UnknownJSON,
): KizenRequestError => {
  return new KizenRequestError(proxyStatus, upstreamStatus, upstreamResponse);
};

export const createKizenProxyError = (
  proxyStatus?: number,
  proxyError?: string,
): KizenRequestError => {
  return new KizenRequestError(
    proxyStatus ?? 500,
    undefined,
    undefined,
    proxyError ?? 'An unknown error occurred in the proxy',
  );
};

export const handleKizenNetworkResponse = (
  originalResponse: KizenNetworkResponse<KizenProxySuccessResponse>,
): KizenNetworkResponse<UnknownJSON> => {
  const { response, upstreamStatus, upstreamResponse } = getModifiedResponse(originalResponse);

  const isErrorCode = upstreamStatus >= 400;

  if (isErrorCode) {
    throw createKizenRequestError(200, upstreamStatus, upstreamResponse as UnknownJSON);
  }

  return response as KizenNetworkResponse<UnknownJSON>;
};
