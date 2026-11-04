import { describe, expect, it } from 'vitest';
import { CODING_ASSISTANT_PROMPT_MAX_LENGTH } from '../communication/constants.js';
import { isValidCodingAssistantRequest } from './codingAssistant.js';

describe('isValidCodingAssistantRequest', () => {
  it.each([
    ['unknown profile', 'unknown-profile', 'Build it', false],
    ['numeric prompt', 'business-app', 42, false],
    ['undefined prompt', 'business-app', undefined, false],
    ['empty prompt', 'business-app', '', false],
    ['whitespace-only prompt', 'business-app', ' \n\t ', false],
    [
      'prompt at the max length',
      'business-app',
      'a'.repeat(CODING_ASSISTANT_PROMPT_MAX_LENGTH),
      true,
    ],
    [
      'prompt over the max length',
      'business-app',
      'a'.repeat(CODING_ASSISTANT_PROMPT_MAX_LENGTH + 1),
      false,
    ],
    ['valid business-app prompt', 'business-app', 'Build a deal tracker', true],
  ])('%s', (_name, profile, prompt, expected) => {
    expect(isValidCodingAssistantRequest(profile, prompt)).toBe(expected);
  });
});
