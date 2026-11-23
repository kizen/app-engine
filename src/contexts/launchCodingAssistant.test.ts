import { describe, expect, it, vi } from 'vitest';
import { CODING_ASSISTANT_PROMPT_MAX_LENGTH } from '../communication/constants.js';
import { BaseWorkerContext } from './BaseWorkerContext.js';
import { WorkerManager } from '../WorkerManager.js';
import { WorkerPromise } from '../workers/WorkerPromise.js';
import { handleCommonResponse, launchCodingAssistantHandler } from '../workers/util.js';
import type {
  CurriedLaunchCodingAssistantFn,
  Instance,
  WorkerContextArgs,
} from '../types/contexts.js';
import type { OnLaunchCodingAssistantFn } from '../types/run.js';

// Connects a worker-side context to a host-side WorkerManager in memory, so a call
// travels context -> request message -> host handler -> response message -> context.
const connect = (
  onLaunchCodingAssistant?: OnLaunchCodingAssistantFn,
): BaseWorkerContext & { rawLaunch: ReturnType<CurriedLaunchCodingAssistantFn> } => {
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

  const rawLaunch = launchCodingAssistantHandler(instance, promises);
  const context = new BaseWorkerContext({
    kizenRequest: () => vi.fn(),
    instance,
    launchCodingAssistant: rawLaunch,
  } as unknown as WorkerContextArgs);

  // `rawLaunch` posts the request message without worker-side validation, like a plugin
  // posting the message itself.
  return Object.assign(context, { rawLaunch });
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

  it.each([
    ['no prompt', []],
    ['an undefined prompt', [undefined]],
    ['an empty prompt', ['']],
    ['a whitespace-only prompt', [' \n\t ']],
  ] as const)(
    'opens with no initial message when called with %s: the host handler gets only the profile',
    async (_name, promptArgs) => {
      const handler = vi.fn<OnLaunchCodingAssistantFn>(() => Promise.resolve(true));

      await expect(
        connect(handler).launchCodingAssistant('business-app', ...promptArgs),
      ).resolves.toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      const args = handler.mock.calls[0]?.[0];
      expect(args).toEqual({ profile: 'business-app' });
      expect(args && 'initialPrompt' in args).toBe(false);
    },
  );

  it("resolves a blank-prompt launch to the host handler's boolean", async () => {
    const handler = vi.fn<OnLaunchCodingAssistantFn>(() => false);

    await expect(connect(handler).launchCodingAssistant('business-app')).resolves.toBe(false);
    expect(handler).toHaveBeenCalledWith({ profile: 'business-app' });
  });

  it.each([
    ['a missing prompt', undefined],
    ['an empty prompt', ''],
    ['a whitespace-only prompt', ' \n\t '],
  ])('WorkerManager omits initialPrompt for a raw request with %s', async (_name, prompt) => {
    const handler = vi.fn<OnLaunchCodingAssistantFn>(() => Promise.resolve(true));

    // `rawLaunch` skips worker-side normalization; an undefined prompt is dropped from
    // the posted JSON, so the request arrives with no `initialPrompt` key at all.
    await expect(connect(handler).rawLaunch('business-app', prompt)).resolves.toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    const args = handler.mock.calls[0]?.[0];
    expect(args).toEqual({ profile: 'business-app' });
    expect(args && 'initialPrompt' in args).toBe(false);
  });

  it('passes a non-blank prompt through unchanged, surrounding whitespace included', async () => {
    const handler = vi.fn<OnLaunchCodingAssistantFn>(() => Promise.resolve(true));
    const context = connect(handler);

    await expect(context.launchCodingAssistant('business-app', '  Build it  ')).resolves.toBe(true);
    await expect(context.rawLaunch('business-app', '  Build it  ')).resolves.toBe(true);
    expect(handler.mock.calls).toEqual([
      [{ profile: 'business-app', initialPrompt: '  Build it  ' }],
      [{ profile: 'business-app', initialPrompt: '  Build it  ' }],
    ]);
  });

  it.each([
    ['unknown profile', 'unknown-profile', 'Build it'],
    ['unknown profile with no prompt', 'unknown-profile', undefined],
    ['numeric prompt', 'business-app', 42],
    ['null prompt', 'business-app', null],
    ['over-long prompt', 'business-app', 'a'.repeat(CODING_ASSISTANT_PROMPT_MAX_LENGTH + 1)],
  ])(
    'resolves false without calling the host handler for an invalid request: %s',
    async (_name, profile, prompt) => {
      const handler = vi.fn<OnLaunchCodingAssistantFn>(() => Promise.resolve(true));
      const context = connect(handler);

      // Worker-side validation rejects it, and WorkerManager re-validates a raw posted message.
      await expect(context.launchCodingAssistant(profile as never, prompt as never)).resolves.toBe(
        false,
      );
      await expect(context.rawLaunch(profile as never, prompt as never)).resolves.toBe(false);
      expect(handler).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'throws',
      () => {
        throw new Error('boom');
      },
    ],
    ['rejects', () => Promise.reject(new Error('boom'))],
    ['returns false', () => false],
    ['returns a truthy non-boolean', () => 'yes'],
  ])('resolves false when the host handler %s', async (_name, impl) => {
    const handler = vi.fn(impl) as unknown as OnLaunchCodingAssistantFn;

    await expect(connect(handler).launchCodingAssistant('business-app')).resolves.toBe(false);
    await expect(
      connect(handler).launchCodingAssistant('business-app', 'Build a deal tracker'),
    ).resolves.toBe(false);
  });
});
