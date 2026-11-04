import {
  CODING_ASSISTANT_PROFILES,
  CODING_ASSISTANT_PROMPT_MAX_LENGTH,
} from '../communication/constants.js';
import type { CodingAssistantProfile } from '../types/contexts.js';

/*
 * Validates the arguments to `this.launchCodingAssistant`. Used on the worker side
 * before posting the request, and again by the WorkerManager since the worker
 * runs untrusted plugin code. The prompt must contain non-whitespace text and be
 * at most CODING_ASSISTANT_PROMPT_MAX_LENGTH characters.
 */
export const isValidCodingAssistantRequest = (profile: unknown, initialPrompt: unknown): boolean =>
  CODING_ASSISTANT_PROFILES.includes(profile as CodingAssistantProfile) &&
  typeof initialPrompt === 'string' &&
  initialPrompt.trim().length > 0 &&
  initialPrompt.length <= CODING_ASSISTANT_PROMPT_MAX_LENGTH;
