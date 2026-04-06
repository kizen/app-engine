import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import type {
  FloatingFrameConfig,
  MaybeMessageError,
  RoutablePageConfig,
  UnknownJSON,
} from '../../types/index.js';
import { useToast } from '../context/toast.js';
import DOMPurify from 'dompurify';
import { useGenericPluginCustomScript } from './useGenericPluginCustomScript.js';

interface PluginCustomHTML {
  scopedCss: string;
  sanitizedHtml: string | null;
  outputUIRef: RefObject<HTMLDivElement>;
  interactableScriptRef: RefObject<HTMLDivElement>;
}

export const usePluginCustomHTML = (
  currentPage?: FloatingFrameConfig | RoutablePageConfig,
  args?: UnknownJSON,
): PluginCustomHTML => {
  const { showToast } = useToast();

  const outputUIRef = useRef<HTMLDivElement>(null);
  const interactableScriptRef = useRef<HTMLDivElement>(null);

  const css = currentPage?.css;

  const html = useMemo(() => {
    const rawHTML = currentPage?.html;

    return rawHTML ? DOMPurify.sanitize(rawHTML) : null;
  }, [currentPage]);

  const interactableScripts = useMemo(() => {
    return currentPage?.event_scripts ?? {};
  }, [currentPage]);

  const [executeInline, { pending: inlinePending }] = useGenericPluginCustomScript({
    onError: (e) => {
      showToast({
        message: `Script could not be executed: ${(e as MaybeMessageError)?.message ?? 'Unknown Error'}`,
        variant: 'failure',
      });
    },
    scriptUIRef: outputUIRef,
    plugin: currentPage,
  });

  const handleClick = useCallback(
    (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!inlinePending) {
        const target = e.target as HTMLElement;
        const scriptName = target.getAttribute('data-script');

        if (scriptName && interactableScripts[scriptName]) {
          void executeInline(interactableScripts[scriptName], args);
        }
      }
    },
    [inlinePending, executeInline, interactableScripts, args],
  );

  useEffect(() => {
    const e = interactableScriptRef.current;

    if (e) {
      e.addEventListener('click', handleClick);
    }

    return () => {
      if (e) {
        e.removeEventListener('click', handleClick);
      }
    };
  }, [handleClick, currentPage]);

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
