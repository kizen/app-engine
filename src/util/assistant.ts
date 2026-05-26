import type { CleanValueStore, SetupAssistantConfig, ValueStore } from '../types/modals.js';
import { cleanConfig } from '../workers/util.js';
import {
  getActionFieldKey,
  isActionFieldKey,
  isActionMenuFieldKey,
  splitActionMenuFieldKey,
} from './assistantKeys.js';
import { getHash } from './encode.js';

type ActionsToLink = Record<string, ValueStore & { menuFlags?: Record<string, boolean> }>;

export const getProcessedAssistantConfig = (
  currentAssistantConfig: Record<string, ValueStore | undefined>,
  setupAssistantConfig: SetupAssistantConfig,
): {
  partialNewConfig: {
    __kizen_setup_assistant_values: Record<string, ValueStore>;
    __kizen_setup_assistant_hash: number;
    __kizen_clean_config: CleanValueStore;
  };
  actionsToLink: ActionsToLink;
} => {
  const actionsToLink: ActionsToLink = {};
  const configValuesToSet: Record<string, ValueStore> = {};

  const configKeys = Object.keys(currentAssistantConfig);
  const configHash = getHash(JSON.stringify(setupAssistantConfig));

  for (const configKey of configKeys) {
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
    } else if (isActionFieldKey(configKey)) {
      actionsToLink[configKey] = {
        ...actionsToLink[configKey],
        ...currentAssistantConfig[configKey],
      };
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
