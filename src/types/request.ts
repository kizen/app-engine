import type { KizenRequestError } from '../util/errors.js';
import type { WorkerPromise } from '../workers/WorkerPromise.js';
import type { UnknownJSON } from './common.js';
import type { Instance } from './contexts.js';

export type KizenRequestFnHandler<T = unknown> = (
  url: string,
  payload: unknown,
  options?: unknown,
) => Promise<T>;

export type KizenRequestFn = <T>(method: string) => KizenRequestFnHandler<T>;

export type CurriedKizenRequestFn = (instance: Instance, promises: WorkerPromise) => KizenRequestFn;
export interface RequestOptions {
  headers?: Record<string, string>;
  returnErrors?: boolean;
  credentials?: 'include';
}

export type GetOptions = RequestOptions & {
  ignoreCache?: boolean;
};

export interface GetReturnValue {
  data: UnknownJSON;
}

export interface PostReturnValue {
  data: UnknownJSON;
}

export interface PatchReturnValue {
  data: UnknownJSON;
}

export interface PutReturnValue {
  data: UnknownJSON;
}

export interface DeleteReturnValue {
  data: UnknownJSON;
}

export type RequestWithErrorsResponse = [UnknownJSON | null, KizenRequestError | null];

export type OnNetworkErrorFn = (error: unknown) => void;

export interface KizenProxySuccessResponse {
  body?: unknown;
  status_code?: number;
}

export interface KizenNetworkResponse<T = unknown> {
  data: T;
  status: number;
}
