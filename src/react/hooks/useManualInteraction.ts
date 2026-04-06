import { useCallback, useEffect, useMemo } from 'react';
import type { ExecuteFloatingFrameScript, ExecuteGenericScript } from '../../index.js';

export const useManualInteraction = (
  execute: ExecuteFloatingFrameScript | ExecuteGenericScript,
  currentPage?: { event_scripts?: Record<string, string> },
  elementRef?: { current: HTMLElement | null },
  pending?: boolean,
  args: Record<string, unknown> = {},
): void => {
  const interactableScripts = useMemo(() => {
    return currentPage?.event_scripts ?? {};
  }, [currentPage]);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!pending) {
        const target = e.target as HTMLElement;
        const scriptName = target.getAttribute('data-script');
        if (scriptName && interactableScripts[scriptName]) {
          void execute(interactableScripts[scriptName], { ...args });
        }
      }
    },
    [pending, execute, interactableScripts, args],
  );

  useEffect(() => {
    const e = elementRef?.current;

    if (e) {
      e.addEventListener('click', handleClick);
    }

    return () => {
      if (e) {
        e.removeEventListener('click', handleClick);
      }
    };
  }, [handleClick, currentPage, elementRef]);
};
