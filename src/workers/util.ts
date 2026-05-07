/*
 * Note - this file contains utility functions used in the worker threads for the plugin engine.
 * These functions must be self-contained and cannot rely on imports that would inadvertently
 * include React, which would break local development and bloat the worker in production.
 */

import { ACTIONS, RESPONSES } from '../communication/constants.js';
import type {
  AssistantConfigAction,
  AssistantField,
  BooleanValueStore,
  CleanValueStore,
  CurriedDynamicPromptFn,
  CustomObjectCleanValue,
  CustomObjectValueStore,
  FieldCleanValue,
  FieldValueStore,
  ModalContainer,
  NumberValueStore,
  SelectValueStore,
  SetupAssistantConfig,
  TextValueStore,
  ValueStore,
} from '../types/modals.js';
import type { CurriedKizenRequestFn } from '../types/request.js';
import type { PromiseResolve } from '../types/promise.js';
import type {
  CurriedInstallThirdPartyScriptFn,
  CurriedOpenCreateRecordFn,
  CurriedOpenCreateRelatedRecordFn,
  CurriedPostFormDataFn,
  CurriedPromptFn,
  CurriedRefreshEntityFn,
  CurriedUploadFileFn,
} from '../types/contexts.js';
import type {
  CreateRecordResponsePayload,
  CreateRelatedRecordResponsePayload,
  InstallThirdPartyScriptResponsePayload,
  PostFormDataResponsePayload,
  PromptResponsePayload,
  QueryResponsePayload,
  RefreshEntityResponsePayload,
  UploadFileResponsePayload,
} from '../types/workers.js';
import type { WorkerPromise } from './WorkerPromise.js';
import { KizenRequestError } from '../util/errors.js';
import type { UnknownJSON } from '../types/common.js';

interface KizenErrorPayload {
  __kizenError: true;
  proxyStatus: number;
  upstreamStatus?: number;
  upstreamResponse?: UnknownJSON;
  message: string;
}

export const getFieldFromAction = (action: AssistantConfigAction): AssistantField => {
  return {
    key: `action__${action.api_name}`,
    type: 'custom_object',
    label: action.name,
    allow_multiple: true,
  };
};

export const NON_INPUT_FIELD_TYPES = ['description', 'container', 'qr', 'image', 'link'];

export const getAllNestedInputsFromConfig = (
  config: SetupAssistantConfig,
  parentWhen?: string,
): AssistantField[] => {
  const regular = (config.fields ?? [])
    .filter((entry) => !NON_INPUT_FIELD_TYPES.includes(entry.type))
    .map((r) => {
      return {
        ...r,
        when: parentWhen ? `(${parentWhen}) && (${r.when ?? 'true'})` : r.when,
      };
    }) as AssistantField[];

  const containers = (config.fields ?? []).filter((entry) => entry.type === 'container');

  const recursiveRegulars = containers.flatMap((container) =>
    getAllNestedInputsFromConfig(container as ModalContainer, container.when),
  );

  const actionObjects = config.actions?.filter((action) => action.hint_object_name) ?? [];

  return [
    ...regular,
    ...recursiveRegulars,
    ...actionObjects.map((action) => {
      return {
        ...getFieldFromAction(action),
        match_hint: action.hint_object_name ?? '',
      };
    }),
  ];
};

export const cleanConfig = (
  setupAssistantConfig: SetupAssistantConfig,
  configValues: Record<string, ValueStore>,
): CleanValueStore => {
  const flattened = getAllNestedInputsFromConfig(setupAssistantConfig);

  const configReference: Record<string, AssistantField> = flattened.reduce((acc, curr) => {
    return {
      ...acc,
      [curr.key]: curr,
    };
  }, {});

  const configKeysToClean = Object.keys(configValues);

  const cleanConfig: CleanValueStore = {};

  configKeysToClean.forEach((key) => {
    const value = configValues[key];
    const configReferenceValue = configReference[key];

    if (!configReferenceValue?.type) {
      return;
    }

    switch (configReferenceValue.type) {
      case 'boolean':
        const consideredValue = value as BooleanValueStore | undefined;

        if (!consideredValue) {
          return;
        }

        cleanConfig[key] = consideredValue.value;

        return;
      case 'custom_object': {
        const consideredValue = value as CustomObjectValueStore | undefined;

        if (!consideredValue) {
          return;
        }

        cleanConfig[key] = {
          objectId: consideredValue.value?.id,
          objectName: consideredValue.value?.objectName,
        } as CustomObjectCleanValue;

        return;
      }
      case 'field': {
        const consideredValue = value as FieldValueStore | undefined;

        if (!consideredValue?.value) {
          return;
        }

        if (Array.isArray(consideredValue.value)) {
          cleanConfig[key] = consideredValue.value.map((item) => ({
            fieldId: item.value,
            fieldName: item.label,
            objectId: consideredValue.associatedObject?.id,
            objectName: consideredValue.associatedObject?.name,
          })) as FieldCleanValue;
        } else if (
          typeof consideredValue.value === 'object' &&
          typeof consideredValue.associatedObject === 'object'
        ) {
          cleanConfig[key] = {
            fieldId: consideredValue.value.value,
            fieldName: consideredValue.value.label,
            objectId: consideredValue.associatedObject.id,
            objectName: consideredValue.associatedObject.name,
          } as FieldCleanValue;
        }
        return;
      }
      case 'number': {
        const consideredValue = value as NumberValueStore | undefined;

        if (!consideredValue) {
          return;
        }

        try {
          const parsed = Number(consideredValue.value);

          if (!parsed && parsed !== 0) {
            return;
          }

          cleanConfig[key] = parsed;
        } catch {
          cleanConfig[key] = NaN;
        }

        return;
      }
      case 'select': {
        const consideredValue = value as SelectValueStore | undefined;

        if (!consideredValue) {
          return;
        }

        cleanConfig[key] = consideredValue.value;
        return;
      }
      case 'text': {
        const consideredValue = value as TextValueStore | undefined;

        const textValue = consideredValue?.value;

        if (textValue) {
          cleanConfig[key] = textValue;
          return;
        }

        const defaultValue = configReferenceValue.default;

        if (defaultValue) {
          cleanConfig[key] = defaultValue;
        }

        return;
      }
      case 'description':
      case 'container':
      case 'qr':
      case 'image':
      case 'link':
        return;
    }

    return value?.value;
  });

  return cleanConfig;
};

export const kizenRequestHandler: CurriedKizenRequestFn =
  (instance, promises) => (method) => async (url, payload, options) => {
    return new Promise((resolve, reject) => {
      const id = promises.register(resolve as PromiseResolve, reject);

      instance.postMessage(
        JSON.stringify({
          action: ACTIONS.QUERY_REQUEST,
          id,
          method,
          url,
          payload,
          options,
        }),
      );
    });
  };

export const postFormDataHandler: CurriedPostFormDataFn =
  (instance, promises) =>
  (url, payload, createNewTab = true) => {
    return new Promise((resolve, reject) => {
      const id = promises.register(resolve, reject);

      instance.postMessage(
        JSON.stringify({
          action: ACTIONS.POSTFORMDATA_REQUEST,
          url,
          id,
          payload,
          createNewTab,
        }),
      );
    });
  };

export const promptHandler: CurriedPromptFn = (instance, promises) => (config) => {
  return new Promise((resolve, reject) => {
    const id = promises.register(resolve, reject);
    instance.postMessage(
      JSON.stringify({
        action: ACTIONS.PROMPT_REQUEST,
        id,
        config,
      }),
    );
  });
};

export const dynamicPromptHandler: CurriedDynamicPromptFn = (instance, promises) => (config) => {
  return new Promise((resolve, reject) => {
    const id = promises.register(resolve as PromiseResolve, reject);
    instance.postMessage(
      JSON.stringify({
        action: ACTIONS.DYNAMIC_PROMPT_REQUEST,
        id,
        config,
      }),
    );
  });
};

export const uploadFileHandler: CurriedUploadFileFn = (instance, promises) => (payload) => {
  return new Promise((resolve, reject) => {
    const id = promises.register(resolve, reject);
    instance.postMessage(
      JSON.stringify({
        action: ACTIONS.UPLOADFILE_REQUEST,
        id,
        payload,
      }),
    );
  });
};

export const installThirdPartyScriptHandler: CurriedInstallThirdPartyScriptFn =
  (instance, promises) => (url, args) => {
    return new Promise((resolve, reject) => {
      const id = promises.register(resolve as PromiseResolve, reject);
      instance.postMessage(
        JSON.stringify({
          action: ACTIONS.INSTALL_THIRD_PARTY_SCRIPT_REQUEST,
          url,
          id,
          args,
        }),
      );
    });
  };

export const refreshEntityHandler: CurriedRefreshEntityFn =
  (instance, promises) => (entityId: string) => {
    return new Promise((resolve, reject) => {
      const id = promises.register(resolve, reject);
      instance.postMessage(
        JSON.stringify({
          action: ACTIONS.REFRESH_ENTITY,
          id,
          entityId,
        }),
      );
    });
  };

export const openCreateRecordHandler: CurriedOpenCreateRecordFn =
  (instance, promises) => (objectId: string) => {
    return new Promise((resolve, reject) => {
      const id = promises.register(resolve, reject);
      instance.postMessage(
        JSON.stringify({
          action: ACTIONS.OPEN_CREATE_RECORD_MODAL_REQUEST,
          id,
          entityId: objectId,
        }),
      );
    });
  };

export const openCreateRelatedRecordHandler: CurriedOpenCreateRelatedRecordFn =
  (instance, promises) => (objectId: string, relatedEntityId: string) => {
    return new Promise((resolve, reject) => {
      const id = promises.register(resolve, reject);
      instance.postMessage(
        JSON.stringify({
          action: ACTIONS.OPEN_CREATE_RELATED_RECORD_MODAL_REQUEST,
          id,
          objectId,
          relatedEntityId,
        }),
      );
    });
  };

export const handleCommonResponse = (
  action: string,
  e: MessageEvent<string>,
  promises: WorkerPromise,
): void => {
  switch (action) {
    case RESPONSES.QUERY_RESPONSE: {
      const { id, data, error } = JSON.parse(e.data) as QueryResponsePayload;
      if (error) {
        const reconstructed =
          typeof error === 'object' && '__kizenError' in error
            ? new KizenRequestError(
                (error as KizenErrorPayload).proxyStatus,
                (error as KizenErrorPayload).upstreamStatus,
                (error as KizenErrorPayload).upstreamResponse,
                (error as KizenErrorPayload).message,
              )
            : error;

        promises.reject(id, reconstructed);
      } else {
        promises.resolve(id, data);
      }

      break;
    }
    case RESPONSES.POSTFORMDATA_RESPONSE: {
      const { id, success } = JSON.parse(e.data) as PostFormDataResponsePayload;
      if (success) {
        promises.resolve(id);
      } else {
        promises.reject(id);
      }

      break;
    }

    case RESPONSES.UPLOADFILE_RESPONSE: {
      const { id, data, error } = JSON.parse(e.data) as UploadFileResponsePayload;
      if (data) {
        promises.resolve(id, data);
      } else {
        promises.reject(id, error);
      }

      break;
    }

    case RESPONSES.INSTALL_THIRD_PARTY_SCRIPT_RESPONSE: {
      const { id, data } = JSON.parse(e.data) as InstallThirdPartyScriptResponsePayload;
      if (data.success) {
        promises.resolve(id, data);
      } else {
        promises.reject(id);
      }

      break;
    }

    case RESPONSES.PROMPT_RESPONSE: {
      const { id, data } = JSON.parse(e.data) as PromptResponsePayload;
      promises.resolve(id, data);

      break;
    }

    case RESPONSES.CREATE_RECORD_RESPONSE: {
      const { id, data } = JSON.parse(e.data) as CreateRecordResponsePayload;
      promises.resolve(id, data);

      break;
    }

    case RESPONSES.CREATE_RELATED_RECORD_RESPONSE: {
      const { id, data } = JSON.parse(e.data) as CreateRelatedRecordResponsePayload;
      promises.resolve(id, data);

      break;
    }

    case RESPONSES.REFRESH_ENTITY_RESPONSE: {
      const { id, data } = JSON.parse(e.data) as RefreshEntityResponsePayload;
      if (data.success) {
        promises.resolve(id, true);
      } else {
        promises.reject(id);
      }

      break;
    }
  }
};
