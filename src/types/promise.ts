export type PromiseResolve = (value: unknown) => void;
export type PromiseReject = (reason?: unknown) => void;

export interface PromiseState {
  resolve: PromiseResolve;
  reject: PromiseReject;
}

export type PromiseMap = Map<string, PromiseState>;
