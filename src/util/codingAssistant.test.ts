import { describe, expect, it } from 'vitest';
import { CODING_ASSISTANT_PROMPT_MAX_LENGTH } from '../communication/constants.js';
import { parseCodingAssistantRequest } from './codingAssistant.js';

describe('parseCodingAssistantRequest', () => {
  it.each([
    ['unknown profile', 'unknown-profile', 'Build it'],
    ['unknown profile with no prompt', 'unknown-profile', undefined],
    ['numeric prompt', 'business-app', 42],
    ['null prompt', 'business-app', null],
    ['object prompt', 'business-app', { text: 'Build it' }],
    [
      'prompt over the max length',
      'business-app',
      'a'.repeat(CODING_ASSISTANT_PROMPT_MAX_LENGTH + 1),
    ],
    [
      'whitespace-only prompt over the max length',
      'business-app',
      ' '.repeat(CODING_ASSISTANT_PROMPT_MAX_LENGTH + 1),
    ],
  ])('returns null for an invalid request: %s', (_name, profile, prompt) => {
    expect(parseCodingAssistantRequest(profile, prompt)).toBeNull();
  });

  it.each([
    ['undefined prompt', undefined],
    ['empty prompt', ''],
    ['whitespace-only prompt', ' \n\t '],
  ])('omits the initialPrompt key for a blank prompt: %s', (_name, prompt) => {
    const args = parseCodingAssistantRequest('business-app', prompt);

    expect(args).toEqual({ profile: 'business-app' });
    expect(args && 'initialPrompt' in args).toBe(false);
  });

  it.each([
    ['valid business-app prompt', 'Build a deal tracker'],
    ['prompt with surrounding whitespace, kept untrimmed', '  Build it  '],
    ['prompt at the max length', 'a'.repeat(CODING_ASSISTANT_PROMPT_MAX_LENGTH)],
  ])('passes a non-blank prompt through unchanged: %s', (_name, prompt) => {
    expect(parseCodingAssistantRequest('business-app', prompt)).toEqual({
      profile: 'business-app',
      initialPrompt: prompt,
    });
  });
});
