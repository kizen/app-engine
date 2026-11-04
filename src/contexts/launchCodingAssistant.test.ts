import { describe, expect, it, vi } from 'vitest';
import { BaseWorkerContext } from './BaseWorkerContext.js';
import { WorkerManager } from '../WorkerManager.js';
import { WorkerPromise } from '../workers/WorkerPromise.js';
import { handleCommonResponse, launchCodingAssistantHandler } from '../workers/util.js';
import type { Instance, WorkerContextArgs } from '../types/contexts.js';
import type { OnLaunchCodingAssistantFn } from '../types/run.js';

// Connects a worker-side context to a host-side WorkerManager in memory, so a call
// travels context -> request message -> host handler -> response message -> context.
const connect = (onLaunchCodingAssistant?: OnLaunchCodingAssistantFn): BaseWorkerContext => {
  const promises = new WorkerPromise({});

  const worker = {
    onmessage: null as ((e: MessageEvent) => void) | null,
    postMessage: (message: string) => {
      const { action } = JSON.parse(message) as { action: string };
      handleCommonResponse(action, { data: message } as MessageEvent<string>, promises);
    },
  };

  new WorkerManager({
    worker: worker as unknown as Worker,
    done: () => undefined,
    sessionData: {},
    pluginComponentId: 'test-plugin',
    onShowCreateRecordModal: undefined,
    onShowCreateRelatedRecordModal: undefined,
    appPath: '',
    onLaunchCodingAssistant,
  });

  const instance = {
    postMessage: (message: string) => {
      worker.onmessage?.({ data: message } as MessageEvent);
    },
  } as unknown as Instance;

  return new BaseWorkerContext({
    kizenRequest: () => vi.fn(),
    instance,
    launchCodingAssistant: launchCodingAssistantHandler(instance, promises),
  } as unknown as WorkerContextArgs);
};

describe('this.launchCodingAssistant', () => {
  it('passes the profile and prompt to the host handler and returns its boolean, or false without a handler', async () => {
    const handler = vi.fn<OnLaunchCodingAssistantFn>(() => Promise.resolve(true));

    await expect(
      connect(handler).launchCodingAssistant('business-app', 'Build a deal tracker'),
    ).resolves.toBe(true);
    expect(handler).toHaveBeenCalledWith({
      profile: 'business-app',
      initialPrompt: 'Build a deal tracker',
    });

    await expect(
      connect(undefined).launchCodingAssistant('business-app', 'Build a deal tracker'),
    ).resolves.toBe(false);
  });
});
