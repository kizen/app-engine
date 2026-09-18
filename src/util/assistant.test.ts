import { describe, expect, it, vi } from 'vitest';
import type { SetupAssistantConfig, ValueStore } from '../types/modals.js';
import { getProcessedAssistantConfig, saveAssistantSecrets } from './assistant.js';

const configWithApiKey: SetupAssistantConfig = {
  fields: [
    { key: 'billingMode', type: 'radio', options: [{ label: 'Kizen', value: 'kizen' }] },
    { key: 'apiKey', type: 'api_key', secret: 'my_secret' },
  ],
};

describe('getProcessedAssistantConfig — api_key sanitization', () => {
  it('never lets an api_key value survive into __kizen_setup_assistant_values', async () => {
    const { partialNewConfig } = await getProcessedAssistantConfig(
      {
        billingMode: { type: 'radio', value: { label: 'Kizen', value: 'kizen' } } as ValueStore,
        apiKey: { value: 'plaintext-secret' },
      },
      configWithApiKey,
    );

    expect(partialNewConfig.__kizen_setup_assistant_values.apiKey).toEqual({
      type: 'api_key',
      hasValue: true,
    });
    expect(JSON.stringify(partialNewConfig.__kizen_setup_assistant_values)).not.toContain(
      'plaintext-secret',
    );
  });

  it('preserves hasValue: true through sanitization', async () => {
    const { partialNewConfig } = await getProcessedAssistantConfig(
      { apiKey: { hasValue: true } },
      configWithApiKey,
    );

    expect(partialNewConfig.__kizen_setup_assistant_values.apiKey).toEqual({
      type: 'api_key',
      hasValue: true,
    });
  });

  it('never lets an api_key value into __kizen_clean_config either', async () => {
    const { partialNewConfig } = await getProcessedAssistantConfig(
      { apiKey: { value: 'plaintext-secret' } },
      configWithApiKey,
    );

    expect(partialNewConfig.__kizen_clean_config.apiKey).toBeUndefined();
  });
});

describe('getProcessedAssistantConfig — secretsToCreate', () => {
  it('reports a fresh api_key value as a secret to create, not a write it performs itself', async () => {
    const { secretsToCreate, partialNewConfig } = await getProcessedAssistantConfig(
      { apiKey: { value: 'sk-live-123' } },
      configWithApiKey,
    );

    expect(secretsToCreate).toEqual([
      { fieldKey: 'apiKey', secretName: 'my_secret', value: 'sk-live-123' },
    ]);
    expect(JSON.stringify(partialNewConfig)).not.toContain('sk-live-123');
  });

  it('reports no secrets to create when nothing fresh was typed', async () => {
    const { secretsToCreate } = await getProcessedAssistantConfig(
      { apiKey: { hasValue: true } },
      configWithApiKey,
    );

    expect(secretsToCreate).toEqual([]);
  });

  it('excludes a hidden api_key field from secretsToCreate via includedKeys', async () => {
    const { secretsToCreate, partialNewConfig } = await getProcessedAssistantConfig(
      { apiKey: { value: 'sk-should-not-be-written' } },
      configWithApiKey,
      { includedKeys: ['billingMode'] },
    );

    expect(secretsToCreate).toEqual([]);
    expect(partialNewConfig.__kizen_setup_assistant_values.apiKey).toEqual({
      type: 'api_key',
      hasValue: false,
    });
    expect(JSON.stringify(partialNewConfig)).not.toContain('sk-should-not-be-written');
  });

  it('keeps hasValue for a hidden api_key field that already has a secret behind it', async () => {
    const { secretsToCreate, partialNewConfig } = await getProcessedAssistantConfig(
      { apiKey: { type: 'api_key', hasValue: true, maskedValue: 'AA****jo94' } },
      configWithApiKey,
      { includedKeys: ['billingMode'] },
    );

    expect(secretsToCreate).toEqual([]);
    expect(partialNewConfig.__kizen_setup_assistant_values.apiKey).toEqual({
      type: 'api_key',
      hasValue: true,
    });
  });

  it('throws when an api_key field with a fresh value declares no secret', async () => {
    const noSecretConfig: SetupAssistantConfig = {
      fields: [{ key: 'apiKey', type: 'api_key' }],
    };

    await expect(
      getProcessedAssistantConfig({ apiKey: { value: 'sk-live-123' } }, noSecretConfig),
    ).rejects.toThrow('does not declare a secret');
  });
});

describe('getProcessedAssistantConfig — saveSecret option', () => {
  it('persists a fresh api_key value via saveSecret before returning', async () => {
    const saveSecret = vi.fn().mockResolvedValue(undefined);

    const { partialNewConfig } = await getProcessedAssistantConfig(
      { apiKey: { value: 'sk-live-123' } },
      configWithApiKey,
      { pluginApiName: 'my_plugin', saveSecret },
    );

    expect(saveSecret).toHaveBeenCalledWith({
      pluginApiName: 'my_plugin',
      secretName: 'my_secret',
      value: 'sk-live-123',
    });
    expect(partialNewConfig.__kizen_setup_assistant_values.apiKey).toEqual({
      type: 'api_key',
      hasValue: true,
    });
    expect(JSON.stringify(partialNewConfig)).not.toContain('sk-live-123');
  });

  it('does not call saveSecret for a field the user never touched', async () => {
    const saveSecret = vi.fn().mockResolvedValue(undefined);

    await getProcessedAssistantConfig({ apiKey: { hasValue: true } }, configWithApiKey, {
      pluginApiName: 'my_plugin',
      saveSecret,
    });

    expect(saveSecret).not.toHaveBeenCalled();
  });

  it('propagates a saveSecret failure and never resolves with the write silently dropped', async () => {
    const saveSecret = vi.fn().mockRejectedValue(new Error('network error'));

    await expect(
      getProcessedAssistantConfig({ apiKey: { value: 'sk-live-123' } }, configWithApiKey, {
        pluginApiName: 'my_plugin',
        saveSecret,
      }),
    ).rejects.toThrow('network error');
  });
});

describe('saveAssistantSecrets', () => {
  it('writes a fresh value via saveSecret and strips it from the returned config', async () => {
    const saveSecret = vi.fn().mockResolvedValue(undefined);

    const result = await saveAssistantSecrets(
      { apiKey: { value: 'sk-live-123' } },
      configWithApiKey,
      'my_plugin',
      saveSecret,
    );

    expect(saveSecret).toHaveBeenCalledWith({
      pluginApiName: 'my_plugin',
      secretName: 'my_secret',
      value: 'sk-live-123',
    });
    expect(result.apiKey).toEqual({ type: 'api_key', hasValue: true });
    expect(JSON.stringify(result)).not.toContain('sk-live-123');
  });

  it('rejects and writes nothing when the secret write fails', async () => {
    const saveSecret = vi.fn().mockRejectedValue(new Error('network error'));

    await expect(
      saveAssistantSecrets(
        { apiKey: { value: 'sk-live-123' } },
        configWithApiKey,
        'my_plugin',
        saveSecret,
      ),
    ).rejects.toThrow('network error');
  });

  it('throws without calling saveSecret when the field declares no secret', async () => {
    const noSecretConfig: SetupAssistantConfig = {
      fields: [{ key: 'apiKey', type: 'api_key' }],
    };
    const saveSecret = vi.fn().mockResolvedValue(undefined);

    await expect(
      saveAssistantSecrets(
        { apiKey: { value: 'sk-live-123' } },
        noSecretConfig,
        'my_plugin',
        saveSecret,
      ),
    ).rejects.toThrow('does not declare a secret');

    expect(saveSecret).not.toHaveBeenCalled();
  });

  it('does not call saveSecret for a field the user never touched', async () => {
    const saveSecret = vi.fn().mockResolvedValue(undefined);

    const result = await saveAssistantSecrets({}, configWithApiKey, 'my_plugin', saveSecret);

    expect(saveSecret).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it('leaves an already-saved secret (hasValue, no fresh value) untouched by saveSecret', async () => {
    const saveSecret = vi.fn().mockResolvedValue(undefined);

    const result = await saveAssistantSecrets(
      { apiKey: { hasValue: true } },
      configWithApiKey,
      'my_plugin',
      saveSecret,
    );

    expect(saveSecret).not.toHaveBeenCalled();
    expect(result.apiKey).toEqual({ type: 'api_key', hasValue: true });
  });

  it('strips the plaintext value but keeps hasValue when excluded from includedKeys', async () => {
    const saveSecret = vi.fn().mockResolvedValue(undefined);

    const result = await saveAssistantSecrets(
      { apiKey: { value: 'sk-should-not-be-written' } },
      configWithApiKey,
      'my_plugin',
      saveSecret,
      ['billingMode'],
    );

    expect(saveSecret).not.toHaveBeenCalled();
    expect(result.apiKey).toEqual({ type: 'api_key', hasValue: false });
    expect(JSON.stringify(result)).not.toContain('sk-should-not-be-written');
  });

  it('still writes a visible field when includedKeys is provided and contains it', async () => {
    const saveSecret = vi.fn().mockResolvedValue(undefined);

    const result = await saveAssistantSecrets(
      { apiKey: { value: 'sk-live-123' } },
      configWithApiKey,
      'my_plugin',
      saveSecret,
      ['billingMode', 'apiKey'],
    );

    expect(saveSecret).toHaveBeenCalledTimes(1);
    expect(result.apiKey).toEqual({ type: 'api_key', hasValue: true });
  });

  it('passes through configs with no api_key fields unchanged', async () => {
    const saveSecret = vi.fn().mockResolvedValue(undefined);
    const config: SetupAssistantConfig = {
      fields: [{ key: 'name', type: 'text' }],
    };
    const input = { name: { value: 'hello' } };

    const result = await saveAssistantSecrets(input, config, 'my_plugin', saveSecret);

    expect(result).toBe(input);
    expect(saveSecret).not.toHaveBeenCalled();
  });
});
