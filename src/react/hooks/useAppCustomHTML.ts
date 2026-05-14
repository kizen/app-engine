import { useRef, type RefObject } from 'react';
import type {
  FloatingFrameConfig,
  MaybeMessageError,
  RoutablePageConfig,
  UnknownJSON,
} from '../../types/index.js';
import { useToast } from '../context/toast.js';
import { useTranslation } from '../context/translation.js';
import { useGenericAppCustomScript } from './useGenericAppCustomScript.js';
import { useManualInteraction } from './useManualInteraction.js';
import { usePluginSafeHTML } from './usePluginSafeHTML.js';

interface PluginCustomHTML {
  scopedCss: string;
  sanitizedHtml: string | null;
  outputUIRef: RefObject<HTMLDivElement>;
  interactableScriptRef: RefObject<HTMLDivElement>;
}

export const useAppCustomHTML = (
  currentPage?: FloatingFrameConfig | RoutablePageConfig,
  args?: UnknownJSON,
): PluginCustomHTML => {
  const { showToast } = useToast();
  const { t } = useTranslation();

  const outputUIRef = useRef<HTMLDivElement>(null);
  const interactableScriptRef = useRef<HTMLDivElement>(null);

  const css = currentPage?.css;

  const { html } = usePluginSafeHTML(currentPage?.html);

  const [executeInline, { pending: inlinePending }] = useGenericAppCustomScript({
    onError: (e) => {
      showToast({
        message: `${t('Script could not be executed:')} ${(e as MaybeMessageError)?.message ?? 'Unknown Error'}`,
        variant: 'failure',
      });
    },
    scriptUIRef: outputUIRef,
    plugin: currentPage,
  });

  useManualInteraction(executeInline, currentPage, interactableScriptRef, inlinePending, args as Record<string, unknown>);

  return {
    scopedCss: `
        @scope {
          ${css ?? ''}
        }
    `,
    sanitizedHtml: html,
    outputUIRef,
    interactableScriptRef,
  };
};
