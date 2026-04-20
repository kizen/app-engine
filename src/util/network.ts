import type { KizenNetworkResponse, KizenProxySuccessResponse } from '../types/request.js';
import type { UnknownJSON } from '../types/common.js';
import { KizenRequestError } from './errors.js';

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
    // If we manually throw an error, it means the proxy request succeeded but the upstream request failed.
    // In this case, always indicate a 200 status for the proxy.
    throw createKizenRequestError(200, upstreamStatus, upstreamResponse as UnknownJSON);
  }

  return response as KizenNetworkResponse<UnknownJSON>;
};
