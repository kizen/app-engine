import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetupAssistantConfig } from '../../types/modals.js';
import { AppStateWrapper } from './appState.js';
import {
  getStateAccessorKey,
  resolveInferredObjectId,
  SetupAssistantController,
} from './setupAssistant.js';

const globals = globalThis as unknown as Record<string, unknown>;

interface CustomObjectDetails {
  id: string;
  objectName: string;
  fields: { id: string; name: string; displayName: string }[];
}

const objectsByApiName: Record<string, { id: string; object_name: string }[]> = {
  recordings: [{ id: 'obj-1', object_name: 'Recordings' }],
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

interface RenderResult {
  getObjectByAPIName: ReturnType<
    typeof vi.fn<(apiName: string) => Promise<{ id: string; object_name: string }[] | undefined>>
  >;
  getCustomObjectDetails: ReturnType<
    typeof vi.fn<(objectId: string) => Promise<CustomObjectDetails>>
  >;
  latestState: Record<string, unknown>;
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

const renderController = async (config: SetupAssistantConfig): Promise<RenderResult> => {
  const getObjectByAPIName = vi.fn<
    (apiName: string) => Promise<{ id: string; object_name: string }[] | undefined>
  >((apiName) => Promise.resolve(objectsByApiName[apiName]));

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
            children: null,
          }),
      }),
    );

    await Promise.resolve();
  });

  await flushAsyncWork();

  const latestState = onStateChange.mock.calls.at(-1)?.[0] ?? {};

  return { getObjectByAPIName, getCustomObjectDetails, latestState };
};

beforeEach(() => {
  globals.IS_REACT_ACT_ENVIRONMENT = true;
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
