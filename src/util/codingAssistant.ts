import {
  CODING_ASSISTANT_PROFILES,
  CODING_ASSISTANT_PROMPT_MAX_LENGTH,
} from '../communication/constants.js';
import type { CodingAssistantProfile } from '../types/contexts.js';
import type { LaunchCodingAssistantArgs } from '../types/run.js';

/*
 * Validates the arguments to `this.launchCodingAssistant` and returns the args for the
 * host's `onLaunchCodingAssistant` handler, or `null` when the request is invalid. Used on
 * the worker side before posting the request, and again by the WorkerManager since the
 * worker runs untrusted plugin code and can post any `initialPrompt`.
 *
 * Invalid: an unknown profile, a prompt that is present but not a string, or a prompt
 * longer than CODING_ASSISTANT_PROMPT_MAX_LENGTH characters. A missing, empty, or
 * whitespace-only prompt is valid and means "open with no initial message": the
 * `initialPrompt` key is omitted from the result. Any other prompt is kept unchanged.
 */
export const parseCodingAssistantRequest = (
  profile: unknown,
  initialPrompt: unknown,
): LaunchCodingAssistantArgs | null => {
  if (!CODING_ASSISTANT_PROFILES.includes(profile as CodingAssistantProfile)) {
    return null;
  }

  const validProfile = profile as CodingAssistantProfile;

  if (initialPrompt === undefined) {
    return { profile: validProfile };
  }

  if (
    typeof initialPrompt !== 'string' ||
    initialPrompt.length > CODING_ASSISTANT_PROMPT_MAX_LENGTH
  ) {
    return null;
  }

  return initialPrompt.trim().length > 0
    ? { profile: validProfile, initialPrompt }
    : { profile: validProfile };
};
