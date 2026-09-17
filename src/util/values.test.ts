import { describe, expect, it } from 'vitest';
import { replaceConfigValues } from './values.js';

describe('replaceConfigValues', () => {
  it('returns an empty string when given nothing', () => {
    expect(replaceConfigValues()).toBe('');
    expect(replaceConfigValues('')).toBe('');
  });

  it('leaves bare sibling-key accessors untouched', () => {
    expect(replaceConfigValues('{{enableReports}} === true')).toBe('{{enableReports}} === true');
  });

  it('rewrites single-segment config and userConfig accessors', () => {
    expect(replaceConfigValues('Boolean({{config.enableReports}})')).toBe(
      'Boolean({{config__enableReports}})',
    );
    expect(replaceConfigValues('Boolean({{userConfig.showReportsForMe}})')).toBe(
      'Boolean({{userConfig__showReportsForMe}})',
    );
  });

  it('flattens a nested plan accessor to a single underscored key', () => {
    expect(replaceConfigValues('{{plan.general.allow_external_keys}} === true')).toBe(
      '{{plan__general__allow_external_keys}} === true',
    );
  });

  it('flattens an entitlement accessor', () => {
    expect(replaceConfigValues('Boolean({{entitlement.beta}})')).toBe(
      'Boolean({{entitlement__beta}})',
    );
  });

  it('rewrites every reserved namespace occurring in the same expression', () => {
    expect(
      replaceConfigValues(
        '{{plan.general.allow_external_keys}} === true && Boolean({{config.apiKeyMode}}) && Boolean({{entitlement.beta}})',
      ),
    ).toBe(
      '{{plan__general__allow_external_keys}} === true && Boolean({{config__apiKeyMode}}) && Boolean({{entitlement__beta}})',
    );
  });

  it('does not touch an unrelated dotted-looking literal', () => {
    expect(replaceConfigValues('{{someKey}}.value === "full"')).toBe(
      '{{someKey}}.value === "full"',
    );
  });
});
