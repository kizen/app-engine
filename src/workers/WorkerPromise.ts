import type { PromiseMap, PromiseReject, PromiseResolve, PromiseState } from '../types/promise.js';
import { generateUUIDV4 } from '../util/run.js';

export class WorkerPromise {
  private promises: PromiseMap;
  private isDebug: boolean;

  constructor({ isDebug = false }: { isDebug?: boolean }) {
    this.promises = new Map();
    this.isDebug = isDebug;
  }

  private delete(id: string): void {
    if (this.isDebug) {
      console.log(`Deleting promise ${id}`);
    }
    this.promises.delete(id);
  }

  private get(id: string): PromiseState | undefined {
    if (this.isDebug) {
      console.log(`Getting promise ${id}`);
    }
    return this.promises.get(id);
  }

  private set(id: string, resolve: PromiseResolve, reject: PromiseReject): void {
    this.promises.set(id, { resolve, reject });
  }

  private id(): string {
    return generateUUIDV4();
  }

  public register(resolve: PromiseResolve, reject: PromiseReject): string {
    const id = this.id();
    this.set(id, resolve, reject);

    return id;
  }

  public resolve(id: string, data?: unknown): void {
    this.get(id)?.resolve(data);
    this.delete(id);
  }

  public reject(id: string, reason?: unknown): void {
    this.get(id)?.reject(reason);
    this.delete(id);
  }
}
