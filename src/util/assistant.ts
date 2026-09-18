import type {
  ApiKeyValueStore,
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

export interface SecretToCreate {
  fieldKey: string;
  secretName: string;
  value: string;
}

export interface SaveSecretParams {
  pluginApiName: string;
  secretName: string;
  value: string;
}

export type SaveSecretFn = (params: SaveSecretParams) => Promise<void>;

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
    const entry = currentAssistantConfig[field.key] as ApiKeyValueStore | undefined;

    if (!entry) {
      continue;
    }

    // Drop the plaintext value while keeping hasValue, so the field doesn't
    // look empty if/when it's shown again.
    if (includedKeySet && !includedKeySet.has(field.key)) {
      sanitized[field.key] = { type: 'api_key', hasValue: Boolean(entry.hasValue) };
      continue;
    }

    if (entry.value) {
      if (!field.secret) {
        throw new Error(`api_key field "${field.key}" does not declare a secret`);
      }

      secretsToCreate.push({ fieldKey: field.key, secretName: field.secret, value: entry.value });
      sanitized[field.key] = { type: 'api_key', hasValue: true };
    } else {
      sanitized[field.key] = {
        type: 'api_key',
        hasValue: Boolean(entry.hasValue),
      };
    }
  }

  return { sanitized, secretsToCreate };
};

export interface ProcessAssistantConfigOptions {
  /** Required together with `saveSecret` - identifies the plugin each secret belongs to. */
  pluginApiName?: string;
  includedKeys?: string[];
  /** When provided, each fresh api_key value is persisted via this callback before it's
   * stripped from the returned config, so callers don't need a second pass over
   * `secretsToCreate` (which is still returned, for callers that persist it themselves). */
  saveSecret?: SaveSecretFn;
}

export const getProcessedAssistantConfig = async (
  currentAssistantConfig: Record<string, ValueStore | undefined>,
  setupAssistantConfig: SetupAssistantConfig,
  options?: ProcessAssistantConfigOptions,
): Promise<{
  partialNewConfig: {
    __kizen_setup_assistant_values: Record<string, ValueStore>;
    __kizen_setup_assistant_hash: number;
    __kizen_clean_config: CleanValueStore;
  };
  actionsToLink: ActionsToLink;
  secretsToCreate: SecretToCreate[];
}> => {
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
    options?.includedKeys,
  );

  if (options?.saveSecret) {
    for (const secret of secretsToCreate) {
      await options.saveSecret({
        pluginApiName: options.pluginApiName ?? '',
        secretName: secret.secretName,
        value: secret.value,
      });
    }
  }

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
