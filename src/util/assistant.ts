import type { UnknownJSON } from '../types/common.js';
import type { CleanValueStore, SetupAssistantConfig, ValueStore } from '../types/modals.js';
import { cleanConfig } from '../workers/util.js';
import { getHash } from './encode.js';

const ACTION_PREFIX = 'action';
const ACTION_MENU_PREFIX = `${ACTION_PREFIX}__menu`;

export const getActionContainerKey = (actionApiName: string): string => {
  return `${ACTION_PREFIX}__container__${actionApiName}`;
};

export const getActionFieldKey = (actionApiName: string): string => {
  return `${ACTION_PREFIX}__${actionApiName}`;
};

export const getActionMenuKey = (actionApiName: string): string => {
  return `${ACTION_MENU_PREFIX}__${actionApiName}`;
};

export const getActionMenuHeadingKey = (actionApiName: string): string => {
  return `${ACTION_MENU_PREFIX}_heading__${actionApiName}`;
};

export const getActionMenuFieldKey = (actionApiName: string, objectId?: string): string => {
  return `${getActionMenuKey(actionApiName)}_${objectId ?? ''}`;
};

export const isActionFieldKey = (key: string): boolean => {
  return key.startsWith(`${ACTION_PREFIX}__`);
};

export const isActionMenuFieldKey = (key: string): boolean => {
  return key.startsWith(`${ACTION_MENU_PREFIX}__`);
};

export const splitActionMenuFieldKey = (
  key: string,
): { actionApiName: string; objectId?: string } => {
  if (!isActionMenuFieldKey(key)) {
    return { actionApiName: '', objectId: '' };
  }

  const suffix = key.slice(`${ACTION_MENU_PREFIX}__`.length);
  const lastUnderscore = suffix.lastIndexOf('_');

  if (lastUnderscore === -1) {
    return { actionApiName: '', objectId: '' };
  }

  const apiName = suffix.slice(0, lastUnderscore);
  const objectId = suffix.slice(lastUnderscore + 1);

  return {
    actionApiName: apiName,
    objectId,
  };
};

export const getProcessedAssistantConfig = (
  currentAssistantConfig: Record<string, UnknownJSON>,
  setupAssistantConfig: SetupAssistantConfig,
): {
  partialNewConfig: {
    __kizen_setup_assistant_values: Record<string, ValueStore>;
    __kizen_setup_assistant_hash: number;
    __kizen_clean_config: CleanValueStore;
  };
  actionsToLink: Record<
    string,
    {
      menuFlags?: Record<string, boolean>;
    }
  >;
} => {
  const actionsToLink: Record<
    string,
    {
      menuFlags?: Record<string, boolean>;
    }
  > = {};

  const configValuesToSet: Record<string, ValueStore> = {};

  const configKeys = Object.keys(currentAssistantConfig);

  const configHash = getHash(JSON.stringify(setupAssistantConfig));

  for (const configKey of configKeys) {
    if (isActionFieldKey(configKey)) {
      if (isActionMenuFieldKey(configKey)) {
        const { actionApiName, objectId } = splitActionMenuFieldKey(configKey);

        if (actionApiName && objectId) {
          const actionKey = getActionFieldKey(actionApiName);

          const existing = actionsToLink[actionKey] ?? {};
          actionsToLink[actionKey] = {
            ...existing,
            menuFlags: {
              ...(existing.menuFlags ?? {}),
              [objectId]: Boolean(currentAssistantConfig[configKey]?.value),
            },
          };
        }
      } else {
        actionsToLink[configKey] = {
          ...actionsToLink[configKey],
          ...currentAssistantConfig[configKey],
        };
      }
    } else if (currentAssistantConfig[configKey]) {
      configValuesToSet[configKey] = currentAssistantConfig[configKey];
    }
  }

  const cleanConfigValue = cleanConfig(setupAssistantConfig, configValuesToSet);

  return {
    partialNewConfig: {
      __kizen_setup_assistant_values: configValuesToSet,
      __kizen_setup_assistant_hash: configHash,
      __kizen_clean_config: cleanConfigValue,
    },
    actionsToLink,
  };
};
