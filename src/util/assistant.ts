import type {
  AssistantField,
  CleanValueStore,
  SetupAssistantConfig,
  ValueStore,
} from '../types/modals.js';
import { cleanConfig, getAllNestedInputsFromConfig } from '../workers/util.js';
import {
  getActionFieldKey,
  isActionFieldKey,
  isActionMenuFieldKey,
  splitActionMenuFieldKey,
} from './assistantKeys.js';
import { getHash } from './encode.js';

type ActionsToLink = Record<string, ValueStore & { menuFlags?: Record<string, boolean> }>;

interface ApiKeyRawEntry {
  value?: string;
  hasValue?: boolean;
}

export interface SecretToCreate {
  fieldKey: string;
  secretName: string;
  value: string;
}

interface ExtractedApiKeySecrets {
  sanitized: Record<string, ValueStore | undefined>;
  secretsToCreate: SecretToCreate[];
}

const extractApiKeySecrets = (
  currentAssistantConfig: Record<string, ValueStore | undefined>,
  setupAssistantConfig: SetupAssistantConfig,
  includedKeys?: string[],
): ExtractedApiKeySecrets => {
  const apiKeyFields = getAllNestedInputsFromConfig(setupAssistantConfig).filter(
    (field): field is AssistantField & { type: 'api_key' } => field.type === 'api_key',
  );

  if (apiKeyFields.length === 0) {
    return { sanitized: currentAssistantConfig, secretsToCreate: [] };
  }

  const includedKeySet = includedKeys ? new Set(includedKeys) : undefined;
  const sanitized = { ...currentAssistantConfig };
  const secretsToCreate: SecretToCreate[] = [];

  for (const field of apiKeyFields) {
    if (includedKeySet && !includedKeySet.has(field.key)) {
      Reflect.deleteProperty(sanitized, field.key);
      continue;
    }

    const entry = currentAssistantConfig[field.key] as ApiKeyRawEntry | undefined;

    if (!entry) {
      continue;
    }

    if (entry.value) {
      if (!field.secret) {
        throw new Error(`api_key field "${field.key}" does not declare a secret`);
      }

      secretsToCreate.push({ fieldKey: field.key, secretName: field.secret, value: entry.value });
      sanitized[field.key] = { type: 'api_key', hasValue: true } as unknown as ValueStore;
    } else {
      sanitized[field.key] = {
        type: 'api_key',
        hasValue: Boolean(entry.hasValue),
      } as unknown as ValueStore;
    }
  }

  return { sanitized, secretsToCreate };
};

export const getProcessedAssistantConfig = (
  currentAssistantConfig: Record<string, ValueStore | undefined>,
  setupAssistantConfig: SetupAssistantConfig,
  includedKeys?: string[],
): {
  partialNewConfig: {
    __kizen_setup_assistant_values: Record<string, ValueStore>;
    __kizen_setup_assistant_hash: number;
    __kizen_clean_config: CleanValueStore;
  };
  actionsToLink: ActionsToLink;
  secretsToCreate: SecretToCreate[];
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

  const { sanitized: sanitizedConfigValues, secretsToCreate } = extractApiKeySecrets(
    configValuesToSet,
    setupAssistantConfig,
    includedKeys,
  );
  const cleanConfigValue = cleanConfig(
    setupAssistantConfig,
    sanitizedConfigValues as Record<string, ValueStore>,
  );

  return {
    partialNewConfig: {
      __kizen_setup_assistant_values: sanitizedConfigValues as Record<string, ValueStore>,
      __kizen_setup_assistant_hash: configHash,
      __kizen_clean_config: cleanConfigValue,
    },
    actionsToLink,
    secretsToCreate,
  };
};

export interface SaveSecretParams {
  pluginApiName: string;
  secretName: string;
  value: string;
}

export type SaveSecretFn = (params: SaveSecretParams) => Promise<void>;

export const saveAssistantSecrets = async (
  currentAssistantConfig: Record<string, ValueStore | undefined>,
  setupAssistantConfig: SetupAssistantConfig,
  pluginApiName: string,
  saveSecret: SaveSecretFn,
  includedKeys?: string[],
): Promise<Record<string, ValueStore | undefined>> => {
  const { sanitized, secretsToCreate } = extractApiKeySecrets(
    currentAssistantConfig,
    setupAssistantConfig,
    includedKeys,
  );

  for (const secret of secretsToCreate) {
    await saveSecret({
      pluginApiName,
      secretName: secret.secretName,
      value: secret.value,
    });
  }

  return sanitized;
};
