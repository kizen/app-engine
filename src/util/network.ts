import { AxiosError, type AxiosResponse } from 'axios';
import type { KizenProxySuccessResponse } from '../types/request.js';

// Kizen's proxy always responds with a 200 status code, even if the upstream request fails.
export const isProxyRequestSuccess = (response: AxiosResponse): boolean => {
  return response.status === 200;
};

export const getModifiedResponse = (
  response: AxiosResponse<KizenProxySuccessResponse>,
): { response: AxiosResponse; code: number } => {
  if (!isProxyRequestSuccess(response)) {
    return { response, code: response.status };
  }

  const modifiedResponse = {
    ...response,
    data: response.data.body ?? response.data,
    status: response.data.status_code ?? response.status,
  };

  return { response: modifiedResponse, code: modifiedResponse.status };
};

export const handleAxiosResponse = (
  originalResponse: AxiosResponse<KizenProxySuccessResponse>,
): AxiosResponse => {
  const { response, code } = getModifiedResponse(originalResponse);

  const isErrorCode = code >= 400;

  if (isErrorCode) {
    throw new AxiosError(
      `Request failed with status code ${String(code)}`,
      undefined,
      response.config,
      response.request,
      response,
    );
  }

  return response;
};
