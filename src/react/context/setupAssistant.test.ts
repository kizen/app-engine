import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as RunModule from '../../run.js';
import type { UnknownJSON } from '../../types/common.js';
import type { SetupAssistantConfig } from '../../types/modals.js';
import { AppStateWrapper } from './appState.js';
import {
  getStateAccessorKey,
  resolveInferredObjectId,
  SetupAssistantController,
  useSetupAssistant,
} from './setupAssistant.js';

type SetupAssistantContextValue = ReturnType<typeof useSetupAssistant>;

// Set per test to drive `when` transitions; left unset the real evaluator runs, so the
// other suites behave exactly as they did before.
const expressionOverride = vi.hoisted(() => ({
  current: undefined as ((expression: string, values: UnknownJSON) => Promise<boolean>) | undefined,
}));

vi.mock('../../run.js', async (importOriginal) => {
  const actual = await importOriginal<typeof RunModule>();

  return {
    ...actual,
    runExpression: (expression: string, values: UnknownJSON) =>
      expressionOverride.current
        ? expressionOverride.current(expression, values)
        : actual.runExpression(expression, values),
  };
});

const globals = globalThis as unknown as Record<string, unknown>;

interface CustomObjectDetails {
  id: string;
  objectName: string;
  fields: { id: string; name: string; displayName: string }[];
}

const objectsByApiName: Record<string, { id: string; object_name: string }[]> = {
  recordings: [{ id: 'obj-1', object_name: 'Recordings' }],
  transcripts: [{ id: 'obj-2', object_name: 'Transcripts' }],
};

const detailsByObjectId: Record<string, CustomObjectDetails> = {
  'obj-1': {
    id: 'obj-1',
    objectName: 'Recordings',
    fields: [
      { id: 'field-1', name: 'title', displayName: 'Title' },
      { id: 'field-2', name: 'duration', displayName: 'Duration' },
    ],
  },
  'obj-2': {
    id: 'obj-2',
    objectName: 'Transcripts',
    fields: [{ id: 'field-3', name: 'title', displayName: 'Transcript Title' }],
  },
};

let container: HTMLDivElement | undefined;
let root: Root | undefined;
let capturedContext: SetupAssistantContextValue | undefined;

const ContextProbe = (): null => {
  capturedContext = useSetupAssistant();

  return null;
};

interface RenderResult {
  getObjectByAPIName: ReturnType<
    typeof vi.fn<(apiName: string) => Promise<{ id: string; object_name: string }[] | undefined>>
  >;
  getCustomObjectDetails: ReturnType<
    typeof vi.fn<(objectId: string) => Promise<CustomObjectDetails>>
  >;
  latestState: Record<string, unknown>;
  getState: () => Record<string, unknown>;
  context: SetupAssistantContextValue;
}

const flushAsyncWork = async (): Promise<void> => {
  // The inference pass is a chain of awaited fetches kicked off during render. The iteration count
  // must exceed the number of awaits in that chain - under-flushing leaves state empty and the
  // assertions fail with no hint as to why.
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const renderController = async (
  config: SetupAssistantConfig,
  overrides?: {
    getObjectByAPIName?: (
      apiName: string,
    ) => Promise<{ id: string; object_name: string }[] | undefined>;
  },
): Promise<RenderResult> => {
  const getObjectByAPIName = vi.fn<
    (apiName: string) => Promise<{ id: string; object_name: string }[] | undefined>
  >(overrides?.getObjectByAPIName ?? ((apiName) => Promise.resolve(objectsByApiName[apiName])));

  const getCustomObjectDetails = vi.fn<(objectId: string) => Promise<CustomObjectDetails>>(
    (objectId) => {
      const details = detailsByObjectId[objectId];

      if (!details) {
        return Promise.reject(new Error(`Unknown object ${objectId}`));
      }

      return Promise.resolve(details);
    },
  );

  const onStateChange = vi.fn<(state: Record<string, unknown>) => void>();

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const renderRoot = root;

  await act(async () => {
    renderRoot.render(
      createElement(AppStateWrapper, {
        user: { id: 'user-1', crm_client_id: 'client-1' },
        teamMember: {
          id: 'tm-1',
          full_name: 'Test User',
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
          phone: '',
          created: '2026-01-01',
        },
        business: { id: 'business-1' },
        appPath: '/',
        children: () =>
          createElement(SetupAssistantController, {
            config,
            onStateChange,
            getObjectByAPIName,
            getCustomObjectDetails,
            children: createElement(ContextProbe),
          }),
      }),
    );

    await Promise.resolve();
  });

  await flushAsyncWork();

  const getState = (): Record<string, unknown> => onStateChange.mock.calls.at(-1)?.[0] ?? {};

  if (!capturedContext) {
    throw new Error('SetupAssistantController never rendered its context');
  }

  return {
    getObjectByAPIName,
    getCustomObjectDetails,
    latestState: getState(),
    getState,
    context: capturedContext,
  };
};

beforeEach(() => {
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  capturedContext = undefined;
  expressionOverride.current = undefined;
});

afterEach(() => {
  const mountedRoot = root;

  if (mountedRoot) {
    act(() => {
      mountedRoot.unmount();
    });
  }

  container?.remove();
  root = undefined;
  container = undefined;
  globals.IS_REACT_ACT_ENVIRONMENT = false;
});

describe('getStateAccessorKey', () => {
  it('extracts the referenced key from an accessor', () => {
    expect(getStateAccessorKey('{{recordingObjectId}}')).toBe('recordingObjectId');
    expect(getStateAccessorKey('{{ recordingObjectId }}')).toBe('recordingObjectId');
  });

  it('returns undefined for literal values', () => {
    expect(getStateAccessorKey('obj-1')).toBeUndefined();
    expect(getStateAccessorKey('{{unterminated')).toBeUndefined();
  });
});

describe('initial config inference', () => {
  it('infers fields for an object matched in the same pass', async () => {
    const { getCustomObjectDetails, latestState } = await renderController({
      fields: [
        { key: 'recordingObjectId', type: 'custom_object', match_hint: 'recordings' },
        {
          key: 'titleField',
          type: 'field',
          object_id: '{{recordingObjectId}}',
          match_hint: 'title',
        },
      ],
    });

    expect(getCustomObjectDetails).toHaveBeenCalledWith('obj-1');
    expect(latestState.recordingObjectId).toEqual({
      type: 'custom_object',
      value: { id: 'obj-1', objectName: 'Recordings' },
    });
    expect(latestState.titleField).toEqual({
      type: 'field',
      value: { value: 'field-1', label: 'Title' },
      associatedObject: { id: 'obj-1', name: 'Recordings' },
    });
  });

  it('infers fields for an allow_multiple object matched in the same pass', async () => {
    const { latestState } = await renderController({
      fields: [
        {
          key: 'recordingObjectId',
          type: 'custom_object',
          match_hint: 'recordings',
          allow_multiple: true,
        },
        {
          key: 'durationField',
          type: 'field',
          object_id: '{{recordingObjectId}}',
          match_hint: 'duration',
        },
      ],
    });

    expect(latestState.recordingObjectId).toEqual({
      type: 'custom_object',
      value: [{ id: 'obj-1', objectName: 'Recordings' }],
    });
    expect(latestState.durationField).toEqual({
      type: 'field',
      value: { value: 'field-2', label: 'Duration' },
      associatedObject: { id: 'obj-1', name: 'Recordings' },
    });
  });

  it('still resolves a literal object_id', async () => {
    const { getCustomObjectDetails, latestState } = await renderController({
      fields: [{ key: 'titleField', type: 'field', object_id: 'obj-2', match_hint: 'title' }],
    });

    expect(getCustomObjectDetails).toHaveBeenCalledWith('obj-2');
    expect(latestState.titleField).toEqual({
      type: 'field',
      value: { value: 'field-3', label: 'Transcript Title' },
      associatedObject: { id: 'obj-2', name: 'Transcripts' },
    });
  });

  it('leaves fields alone when the object cannot be matched', async () => {
    const { getObjectByAPIName, getCustomObjectDetails, latestState } = await renderController({
      fields: [
        { key: 'unknownObjectId', type: 'custom_object', match_hint: 'not_a_real_object' },
        {
          key: 'titleField',
          type: 'field',
          object_id: '{{unknownObjectId}}',
          match_hint: 'title',
        },
      ],
    });

    expect(getObjectByAPIName).toHaveBeenCalledWith('not_a_real_object');
    expect(getCustomObjectDetails).not.toHaveBeenCalled();
    expect(latestState.titleField).toBeUndefined();
  });
});

describe('resolveInferredObjectId', () => {
  const accessor = '{{recordingObjectId}}';
  const resolvedObjects = { recordingObjectId: { id: 'obj-1', objectName: 'Recordings' } };

  it('resolves from the same-pass matches when state is still empty', () => {
    // The KZN-18356 shape: the object match has been queued into state but not applied yet
    expect(
      resolveInferredObjectId({
        objectIdAccessor: accessor,
        resolvedObjects,
        state: {},
      }),
    ).toBe('obj-1');
  });

  it('returns undefined with no matches and empty state', () => {
    expect(
      resolveInferredObjectId({
        objectIdAccessor: accessor,
        state: {},
      }),
    ).toBeUndefined();
  });

  it('prefers forceObjectId over everything else', () => {
    expect(
      resolveInferredObjectId({
        objectIdAccessor: accessor,
        forceObjectId: 'forced-obj',
        resolvedObjects,
        state: {
          recordingObjectId: { type: 'custom_object', value: { id: 'state-obj' } },
        },
      }),
    ).toBe('forced-obj');
  });

  it('interpolates from state when there is no same-pass match', () => {
    expect(
      resolveInferredObjectId({
        objectIdAccessor: accessor,
        state: {
          recordingObjectId: { type: 'custom_object', value: { id: 'state-obj' } },
        },
      }),
    ).toBe('state-obj');
  });

  it('interpolates an allow_multiple object from state', () => {
    expect(
      resolveInferredObjectId({
        objectIdAccessor: accessor,
        state: {
          recordingObjectId: { type: 'custom_object', value: [{ id: 'state-obj' }] },
        },
      }),
    ).toBe('state-obj');
  });

  it('passes a literal object_id through untouched', () => {
    expect(
      resolveInferredObjectId({
        objectIdAccessor: 'obj-2',
        resolvedObjects,
        state: {},
      }),
    ).toBe('obj-2');
  });
});

describe('inference failure recovery', () => {
  it('clears inferencePending when the object lookup rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { context } = await renderController(
      {
        fields: [{ key: 'recordingObjectId', type: 'custom_object', match_hint: 'recordings' }],
      },
      { getObjectByAPIName: () => Promise.reject(new Error('boom')) },
    );

    warn.mockRestore();

    // A rejection that escapes handleConfigInference leaves the host stuck behind its
    // blocking loader for the life of the modal.
    expect(context.inferencePending).toBe(false);
  });
});

describe('reInferFieldsForObject', () => {
  const twoObjectConfig: SetupAssistantConfig = {
    fields: [
      { key: 'recordingObjectId', type: 'custom_object', match_hint: 'recordings' },
      { key: 'transcriptObjectId', type: 'custom_object', match_hint: 'transcripts' },
      {
        key: 'durationField',
        type: 'field',
        object_id: '{{recordingObjectId}}',
        match_hint: 'duration',
      },
      {
        key: 'transcriptTitleField',
        type: 'field',
        object_id: '{{transcriptObjectId}}',
        match_hint: 'title',
      },
    ],
  };

  it('only re-infers fields belonging to the requested object', async () => {
    const { context, getState } = await renderController(twoObjectConfig);

    expect(getState().transcriptTitleField).toEqual({
      type: 'field',
      value: { value: 'field-3', label: 'Transcript Title' },
      associatedObject: { id: 'obj-2', name: 'Transcripts' },
    });

    await act(async () => {
      await context.reInferFieldsForObject('recordingObjectId', 'obj-1');
    });

    // Without the key filter, forceObjectId applies to every inferrable field, so the
    // transcript field gets repointed at the recordings object.
    expect(getState().transcriptTitleField).toEqual({
      type: 'field',
      value: { value: 'field-3', label: 'Transcript Title' },
      associatedObject: { id: 'obj-2', name: 'Transcripts' },
    });
    expect(getState().durationField).toEqual({
      type: 'field',
      value: { value: 'field-2', label: 'Duration' },
      associatedObject: { id: 'obj-1', name: 'Recordings' },
    });
  });

  it('resolves against a forced object id rather than the state copy', async () => {
    const { context, getState } = await renderController(twoObjectConfig);

    // Callers that just queued a functional setState cannot rely on inferenceState.current,
    // so the new object id has to be honoured when passed directly.
    await act(async () => {
      await context.reInferFieldsForObject('transcriptObjectId', 'obj-1');
    });

    expect(getState().transcriptTitleField).toEqual({
      type: 'field',
      value: { value: 'field-1', label: 'Title' },
      associatedObject: { id: 'obj-1', name: 'Recordings' },
    });
  });
});

describe('re-inferring a when-gated object', () => {
  it('does not repoint fields that belong to a different object', async () => {
    let recordingLookups = 0;

    const { context, getState } = await renderController(
      {
        fields: [
          {
            key: 'recordingObjectId',
            type: 'custom_object',
            match_hint: 'recordings',
            when: '{{configureMapping}} === true',
          },
          { key: 'transcriptObjectId', type: 'custom_object', match_hint: 'transcripts' },
          {
            key: 'durationField',
            type: 'field',
            object_id: '{{recordingObjectId}}',
            match_hint: 'duration',
          },
          {
            key: 'transcriptTitleField',
            type: 'field',
            object_id: '{{transcriptObjectId}}',
            match_hint: 'title',
          },
        ],
      },
      {
        getObjectByAPIName: (apiName) => {
          // The recordings object is unmatched on the initial pass, so the when transition
          // is what actually triggers the re-infer.
          if (apiName === 'recordings') {
            recordingLookups += 1;

            return Promise.resolve(recordingLookups === 1 ? [] : objectsByApiName.recordings);
          }

          return Promise.resolve(objectsByApiName[apiName]);
        },
      },
    );

    expect(getState().recordingObjectId).toBeUndefined();

    expressionOverride.current = () => Promise.resolve(false);
    await act(async () => {
      await context.evaluateExpression('{{configureMapping}} === true', 'recordingObjectId');
    });

    expressionOverride.current = () => Promise.resolve(true);
    await act(async () => {
      await context.evaluateExpression('{{configureMapping}} === true', 'recordingObjectId');
    });
    await flushAsyncWork();

    expect(getState().recordingObjectId).toEqual({
      type: 'custom_object',
      value: { id: 'obj-1', objectName: 'Recordings' },
    });
    expect(getState().durationField).toEqual({
      type: 'field',
      value: { value: 'field-2', label: 'Duration' },
      associatedObject: { id: 'obj-1', name: 'Recordings' },
    });
    // The re-infer must not reach the transcript field - it belongs to another object.
    expect(getState().transcriptTitleField).toEqual({
      type: 'field',
      value: { value: 'field-3', label: 'Transcript Title' },
      associatedObject: { id: 'obj-2', name: 'Transcripts' },
    });
  });
});

describe('objectIdFilter key matching', () => {
  it('does not treat a longer key that contains the filter as a match', async () => {
    const { context, getState } = await renderController({
      fields: [
        { key: 'recordingObjectId', type: 'custom_object', match_hint: 'recordings' },
        { key: 'recordingObjectIdBackup', type: 'custom_object', match_hint: 'transcripts' },
        {
          key: 'backupTitleField',
          type: 'field',
          object_id: '{{recordingObjectIdBackup}}',
          match_hint: 'title',
        },
      ],
    });

    await act(async () => {
      await context.reInferFieldsForObject('recordingObjectId', 'obj-1');
    });

    // A substring test would match "{{recordingObjectIdBackup}}" and repoint it at obj-1.
    expect(getState().backupTitleField).toEqual({
      type: 'field',
      value: { value: 'field-3', label: 'Transcript Title' },
      associatedObject: { id: 'obj-2', name: 'Transcripts' },
    });
  });
});

describe('re-infer object lookup failure', () => {
  it('does not reject when the host lookup fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { context, getState } = await renderController(
      {
        fields: [
          {
            key: 'recordingObjectId',
            type: 'custom_object',
            match_hint: 'recordings',
            when: '{{configureMapping}} === true',
          },
        ],
      },
      { getObjectByAPIName: () => Promise.reject(new Error('boom')) },
    );

    expressionOverride.current = () => Promise.resolve(false);
    await act(async () => {
      await context.evaluateExpression('{{configureMapping}} === true', 'recordingObjectId');
    });

    expressionOverride.current = () => Promise.resolve(true);
    await act(async () => {
      await context.evaluateExpression('{{configureMapping}} === true', 'recordingObjectId');
    });
    await flushAsyncWork();

    expect(getState().recordingObjectId).toBeUndefined();
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});
