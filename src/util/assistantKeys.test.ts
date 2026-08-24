import { describe, expect, it } from 'vitest';
import {
  getActionContainerKey,
  getActionFieldKey,
  getActionMenuFieldKey,
  getActionMenuHeadingKey,
  isActionFieldKey,
  isActionMenuFieldKey,
  splitActionFieldKey,
  splitActionMenuFieldKey,
} from './assistantKeys.js';

describe('key builders', () => {
  it('prefixes each key with its own namespace', () => {
    expect(getActionContainerKey('deploy')).toBe('__kizen__actioncontainer__deploy');
    expect(getActionFieldKey('deploy')).toBe('__kizen__action__deploy');
    expect(getActionMenuHeadingKey('deploy')).toBe('__kizen__actionmenuheading__deploy');
    expect(getActionMenuFieldKey('deploy', 'obj123')).toBe('__kizen__actionmenu__deploy_obj123');
  });
});

describe('predicates', () => {
  it('matches its own prefix', () => {
    expect(isActionFieldKey(getActionFieldKey('deploy'))).toBe(true);
    expect(isActionMenuFieldKey(getActionMenuFieldKey('deploy', 'obj123'))).toBe(true);
  });

  it('does not collide across the sibling prefixes that share a stem', () => {
    // Every prefix shares the `__kizen__action` stem, so the trailing separator is what
    // keeps them apart. A prefix check that stopped at the stem would pass all of these.
    expect(isActionFieldKey('__kizen__actionmenu__deploy_obj123')).toBe(false);
    expect(isActionFieldKey('__kizen__actioncontainer__deploy')).toBe(false);
    expect(isActionFieldKey('__kizen__actionmenuheading__deploy')).toBe(false);
    expect(isActionMenuFieldKey('__kizen__actionmenuheading__deploy')).toBe(false);
    expect(isActionMenuFieldKey('__kizen__action__deploy')).toBe(false);
  });

  it('rejects unrelated keys', () => {
    expect(isActionFieldKey('nope')).toBe(false);
    expect(isActionMenuFieldKey('')).toBe(false);
  });
});

describe('splitActionFieldKey', () => {
  it('round-trips a built key', () => {
    expect(splitActionFieldKey(getActionFieldKey('deploy'))).toBe('deploy');
  });

  it('returns an empty string for a key it does not own', () => {
    expect(splitActionFieldKey('nope')).toBe('');
    expect(splitActionFieldKey('__kizen__actionmenu__deploy_obj123')).toBe('');
  });
});

describe('splitActionMenuFieldKey', () => {
  it('round-trips a built key', () => {
    expect(splitActionMenuFieldKey(getActionMenuFieldKey('deploy', 'obj123'))).toEqual({
      actionApiName: 'deploy',
      objectId: 'obj123',
    });
  });

  it('splits on the LAST underscore, so underscores in the action name survive', () => {
    expect(splitActionMenuFieldKey('__kizen__actionmenu__my_action_obj123')).toEqual({
      actionApiName: 'my_action',
      objectId: 'obj123',
    });
  });

  it('returns empty fields when the suffix has no underscore to split on', () => {
    expect(splitActionMenuFieldKey('__kizen__actionmenu__nounderscore')).toEqual({
      actionApiName: '',
      objectId: '',
    });
  });

  it('yields an empty objectId for a trailing underscore', () => {
    expect(splitActionMenuFieldKey('__kizen__actionmenu__abc_')).toEqual({
      actionApiName: 'abc',
      objectId: '',
    });
  });

  it('returns empty fields for a key it does not own', () => {
    expect(splitActionMenuFieldKey('__kizen__action__deploy')).toEqual({
      actionApiName: '',
      objectId: '',
    });
  });
});
