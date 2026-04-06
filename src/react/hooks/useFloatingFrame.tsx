import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, RefObject } from 'react';
import type {
  FloatingFrameConfig,
  FloatingFrameEmployeeConfig,
  FrameQuadrant,
  MaybeMessageError,
  WindowPosition,
} from '../../types/index.js';
import { useAppState } from '../context/appState.js';
import {
  useFloatingFrameCustomScript,
  useManualInteraction,
  usePluginCustomHTML,
} from '../index.js';
import { useToast } from '../context/toast.js';
import { runFrameScriptEventName } from '../../communication/index.js';
import { useFloatingFrameContext } from '../context/floatingFrame.js';

interface UseFloatingFrameArgs {
  currentWindow: FloatingFrameConfig;
  pathname: string;
  id: string;
  frameHeaderSize: number;
  defaultPositionGap?: number;
  viewportHeight?: number;
  hiddenByModal?: boolean;
  updateEmployeeConfig?: (
    id: string,
    minimized: boolean,
    windowPosition: WindowPosition | null,
  ) => (config: Partial<FloatingFrameEmployeeConfig>) => void;
}

export const defaultIgnorePatterns = [
  '^/$',
  '^/login*',
  '/settings/mine$',
  '/settings/others$',
  '/create-new-business$',
  '^/choose-business*',
  '^/inactive-business$',
  '^/reset$',
  '/welcome$',
  '/embed/*',
  '/create-new-business$',
  '/businessbuilder',
];

export const defaultFrameIgnoreUrls = [
  'https://js.stripe.com', // Exlude irrelevant Stripe events
];

const getQuadrant = (
  topDelta: number,
  leftDelta: number,
  bottomDelta: number,
  rightDelta: number,
): FrameQuadrant => {
  if (topDelta < bottomDelta) {
    // top
    if (leftDelta < rightDelta) {
      return 'top-left';
    } else {
      return 'top-right';
    }
  } else {
    // bottom
    if (leftDelta < rightDelta) {
      return 'bottom-left';
    } else {
      return 'bottom-right';
    }
  }
};

interface CircleProps {
  id: string;
  side: 'left' | 'right';
  circleIcon: string;
  CustomIcon: (({ className }: { className?: string }) => JSX.Element) | null;
  circleColor: string;
  onClick: () => void;
  hidden: boolean;
}

interface UseFloatingFrameResult {
  circleProps: CircleProps;
  parentProps: {
    className: string;
    dragging: boolean;
    hidden: boolean;
  };
  draggableProps: {
    onStop: (_event: unknown, context: { node: HTMLElement | null }) => void;
    onStart: () => void;
    bounds: string;
    handle: string;
    defaultPosition: { x: number; y: number };
    position: { x: number; y: number };
    disabled: boolean;
  };
  floatProps: {
    pending: boolean;
    width: number;
    dragging: boolean;
    height: number;
    isCircle: boolean;
  };
  contentProps: {
    className: string;
    dragging: boolean;
    solid: boolean;
  };
  minimized: boolean;
  pending: boolean;
  indicator: string;
  hideHeader?: boolean | undefined;
  isFixed: boolean;
  isCircle: boolean;
  outputUIRef: RefObject<HTMLDivElement>;
  scopedCss: string;
  sanitizedHtml: string | null;
  interactableScriptRef: RefObject<HTMLDivElement>;
  tooltipPosition: 'top' | 'left' | 'bottom';
  currentPluginId?: string | undefined;
  setMinimized: (minimized: boolean) => void;
  dragHandleClassName: string;
  height: number;
  script: string | undefined;
  dragging: boolean;
  frameOffset: number;
  scriptUIRef: RefObject<HTMLDivElement> | undefined;
}

export const useFloatingFrame = (params: UseFloatingFrameArgs): UseFloatingFrameResult => {
  const {
    currentWindow,
    pathname,
    id,
    frameHeaderSize,
    defaultPositionGap = 0,
    viewportHeight = window.innerHeight,
    hiddenByModal,
    updateEmployeeConfig: maybeUpdateEmployeeConfig,
  } = params;

  const scriptUIRef = useRef<HTMLDivElement>(null);
  const hasRunScript = useRef(false);

  const { showToast } = useToast();
  const { installedPluginAPINamesToIds, clientObject } = useAppState();

  const { touchFloatingFrame, floatingFrameOffset } = useFloatingFrameContext();

  const frameOffset = floatingFrameOffset[id] ?? -1;

  const hideOnMinimized = currentWindow.minimized_style === 'none';

  // If we hide on minimized, treat it as the circle type (as opposed to bar)
  const isCircle = currentWindow.minimized_style === 'circle' || hideOnMinimized;

  const isBottomRightFixed = currentWindow.default_position === 'bottom-right-fixed';

  const isBottomLeftFixed = currentWindow.default_position === 'bottom-left-fixed';

  const isFixed = isBottomRightFixed || isBottomLeftFixed;

  const circleIcon = currentWindow.minimized_config?.icon ?? 'action-drag-handle';
  const circleColor = currentWindow.minimized_config?.color ?? 'blue';

  const additionalArgs = useMemo(() => {
    const splits = pathname.split('/');

    const first = splits[1];
    const second = splits[2];

    if (first === 'client') {
      return {
        objectId: clientObject?.id,
        entityId: second,
      };
    }

    if (first === 'custom-objects') {
      return {
        objectId: second,
        entityId: splits[3],
      };
    }
  }, [clientObject, pathname]);

  const isHiddenByPattern = useMemo(() => {
    const matchers = currentWindow.match;
    const ignore = currentWindow.ignore;

    if (matchers?.length && !matchers.some((m: string) => new RegExp(m).test(pathname))) {
      return true;
    }

    if (
      defaultIgnorePatterns
        .concat(ignore ?? [])
        .filter(Boolean)
        .some((m) => {
          try {
            return new RegExp(m).test(pathname);
          } catch {
            return false;
          }
        })
    ) {
      return true;
    }

    return false;
  }, [currentWindow, pathname]);

  const currentPluginId = currentWindow.plugin_api_name
    ? installedPluginAPINamesToIds[currentWindow.plugin_api_name]
    : '';

  const [minimized, _setMinimized] = useState(
    () => currentWindow.employee_config?.[id]?.minimized ?? false,
  );

  const script = currentWindow.script;
  const type = currentWindow.type;
  const args = currentWindow.args;
  const messageHandlerScript = currentWindow.message_handler;

  const width = currentWindow.width ?? 0;

  const [height, setHeight] = useState(() => {
    const viewportHeight = window.innerHeight;
    return Math.min(currentWindow.height ?? 0, viewportHeight - frameHeaderSize);
  });

  const [windowPosition, setWindowPosition] = useState<WindowPosition | null>(null);

  const defaultPosition = currentWindow.default_position;

  const getDesiredPosition = useCallback(
    (assumeExpanded: boolean) => {
      const position = currentWindow.employee_config?.[id]?.position;

      if (!position?.quadrant) {
        const maxAllowedLeft = window.innerWidth - width;
        let maxAllowedTop = window.innerHeight - height - frameHeaderSize;
        if (minimized && !assumeExpanded) {
          maxAllowedTop = window.innerHeight - frameHeaderSize;
        }

        if (position) {
          try {
            const coords = position;
            if (coords.left > maxAllowedLeft) {
              coords.left = maxAllowedLeft;
            }
            if (coords.top > maxAllowedTop) {
              coords.top = maxAllowedTop;
            }

            if (coords.left < 0) {
              coords.left = defaultPositionGap;
            }

            if (coords.top < 0) {
              coords.top = defaultPositionGap;
            }

            return coords;
          } catch {
            // Ignore and move on
          }
        }

        let defaultLeft = maxAllowedLeft;
        if (defaultPosition === 'bottom-left') {
          defaultLeft = defaultPositionGap;
        }

        return { left: defaultLeft, top: maxAllowedTop - defaultPositionGap };
      } else if (position.quadrant === 'top-left') {
        const left = position.deltas?.left ?? 0;
        const top = position.deltas?.top ?? 0;

        return { ...position, left, top };
      } else if (position.quadrant === 'top-right') {
        const left = window.innerWidth - width - (position.deltas?.right ?? 0);
        const top = position.deltas?.top ?? 0;

        return { ...position, left, top };
      } else if (position.quadrant === 'bottom-left') {
        const left = position.deltas?.left ?? 0;
        const top =
          window.innerHeight -
          (minimized ? 0 : height) -
          (position.deltas?.bottom ?? 0) -
          frameHeaderSize;

        return { ...position, left, top };
      } else {
        const left = window.innerWidth - width - (position.deltas?.right ?? 0);
        const top =
          window.innerHeight -
          (minimized ? 0 : height) -
          (position.deltas?.bottom ?? 0) -
          frameHeaderSize;

        return { ...position, left, top };
      }

      return { ...position, left: 0, top: 0 };
    },
    [
      currentWindow,
      id,
      defaultPosition,
      minimized,
      width,
      height,
      frameHeaderSize,
      defaultPositionGap,
    ],
  );

  const getPosition = useCallback(
    (assumeExpanded: boolean) => {
      const position = getDesiredPosition(assumeExpanded);

      const isBottom = ['bottom-right', 'bottom-left'].includes(position.quadrant ?? '');

      const calculatedHeight = isBottom && minimized ? 0 : height;

      if (position.left < 0) {
        position.left = 0;
      } else if (position.left > window.innerWidth - width) {
        position.left = window.innerWidth - width;
      }

      if (position.top < 0) {
        position.top = 0;
      } else if (position.top > window.innerHeight - calculatedHeight) {
        position.top = window.innerHeight - calculatedHeight;
      }

      return position;
    },
    [getDesiredPosition, width, height, minimized],
  );

  useEffect(() => {
    const currentHeight = currentWindow.height ?? 0;
    if (currentHeight > viewportHeight) {
      setHeight(viewportHeight - frameHeaderSize);
      const position = getDesiredPosition(true);
      position.top = 0;
      setWindowPosition(position);
    } else {
      setHeight(currentHeight);
    }
  }, [currentWindow.height, getDesiredPosition, viewportHeight, frameHeaderSize]);

  const [delayedModalHide, setDelayedModalHide] = useState(minimized);
  const [circleMinimized, setCircleMinimized] = useState(minimized && isCircle);

  const animationDelay = height * 0.0005 * 1000; // match animation duration for floating frames

  const setMinimized = (min: boolean): void => {
    _setMinimized(min);

    // delay animation for minizimation to circle
    if (min && isCircle) {
      setTimeout(() => {
        setCircleMinimized(min);
      }, animationDelay);
    } else if (isCircle) {
      setCircleMinimized(min);
    }
    // delay hiding frame if a modal is open to show animation
    if (hiddenByModal) {
      setTimeout(() => {
        setDelayedModalHide(min);
      }, animationDelay);
    } else {
      setDelayedModalHide(min);
    }
    if (windowPosition?.quadrant === 'bottom-left' || windowPosition?.quadrant === 'bottom-right') {
      if (min) {
        setWindowPosition((p) => {
          if (!p) {
            return null;
          }

          return {
            ...p,
            top: p.top + height,
          };
        });
      } else {
        setWindowPosition((p) => {
          if (!p) {
            return null;
          }
          const windowHeight = window.innerHeight;
          const movePositionUp = p.top >= 0 && p.top + height <= windowHeight;
          return {
            ...p,
            top: movePositionUp ? p.top : p.top - height,
          };
        });
      }
    }

    maybeUpdateEmployeeConfig?.(id, minimized, windowPosition)({ minimized: min });
  };

  const [
    execute,
    { pending, hidden: hiddenByScript, indicator, triggerHidden, hideHeader: hideHeaderByScript },
  ] = useFloatingFrameCustomScript({
    onError: (e) => {
      showToast({
        message: `'Plugin error': ${(e as MaybeMessageError)?.message ?? ''}`,
        variant: 'failure',
      });
    },
    scriptUIRef,
    plugin: currentWindow,
    onChangeMinimized: (minimized: boolean) => {
      setMinimized(minimized);
    },
  });

  const hideHeader = useMemo(() => hideHeaderByScript && isFixed, [hideHeaderByScript, isFixed]);

  const tooltipPosition = useMemo(() => {
    if (!windowPosition) return 'top';

    const { left, top } = windowPosition;
    const windowWidth = window.innerWidth;

    // we are only concerned with right and top since these edges will cause overflow
    const atRightEdge = windowWidth - (left + width) < 40;
    const atTopEdge = top < 40;

    if (atRightEdge) {
      return 'left';
    }
    if (atTopEdge) {
      return 'bottom';
    }

    return 'top';
  }, [windowPosition, width]);

  const resolveCircleEl = useCallback(() => {
    const currentSide = isBottomLeftFixed ? 'left' : 'right';
    const elementId = `${currentWindow.plugin_api_name}-${currentWindow.api_name}-trigger-${currentSide}`;
    const el = document.getElementById(elementId);
    return el;
  }, [isBottomLeftFixed, currentWindow]);

  const computeFixedPosition = useCallback(() => {
    if (!isFixed) return;
    const circleEl = resolveCircleEl();
    if (!circleEl) return;

    const rect = circleEl.getBoundingClientRect();
    const contentHeight = minimized ? 0 : height;
    const headerH = hideHeader ? 0 : frameHeaderSize;

    let top = rect.top - (contentHeight + headerH) - defaultPositionGap;
    let left = isBottomLeftFixed ? rect.left : rect.right - width;

    // clamp to viewport using the FULL frame height (content + header)
    const fullFrameHeight = contentHeight + headerH;
    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - fullFrameHeight);

    left = Math.min(Math.max(0, left), maxLeft);
    top = Math.min(Math.max(0, top), maxTop);

    setWindowPosition({
      left,
      top,
      quadrant: isBottomLeftFixed ? 'bottom-left' : 'bottom-right',
      deltas: {
        top,
        left,
        right: window.innerWidth - (left + width),
        bottom: window.innerHeight - (top + fullFrameHeight),
      },
    });
  }, [
    isFixed,
    isBottomLeftFixed,
    height,
    minimized,
    width,
    hideHeader,
    resolveCircleEl,
    frameHeaderSize,
    defaultPositionGap,
  ]);

  useEffect(() => {
    if (isFixed) {
      computeFixedPosition();
    }
  }, [isFixed, height, minimized, computeFixedPosition]);

  useEffect(() => {
    if (!isFixed) return;

    computeFixedPosition();

    const bodyRO = new ResizeObserver(() => {
      computeFixedPosition();
    });

    bodyRO.observe(document.body);

    return () => {
      bodyRO.disconnect();
    };
  }, [isFixed, computeFixedPosition]);

  useEffect(() => {
    if (!hasRunScript.current && script && type === 'script' && !isHiddenByPattern) {
      hasRunScript.current = true;
      execute(script, { ...args });
    }
  }, [execute, script, type, args, isHiddenByPattern]);

  // This is the handler for events triggered by another piece of the integration,
  // like a full-page routable screen. It should not be confused with the click handler,
  // or the frame message handler.
  useEffect(() => {
    const handleRunFrameScriptFromInteraction = (e?: Event): void => {
      const event = e as
        | {
            detail?: {
              recipient?: { frame?: string; plugin?: string; script?: string };
              args?: Record<string, unknown>;
            };
          }
        | undefined;

      if (event?.detail?.recipient?.frame === currentWindow.api_name) {
        const payload = event.detail;

        if (payload.recipient?.plugin !== currentWindow.plugin_api_name) {
          return;
        }

        if (payload.recipient.script && currentWindow.event_scripts?.[payload.recipient.script]) {
          const script = currentWindow.event_scripts[payload.recipient.script] ?? '';

          execute(script, {
            ...payload.args,
            ...args,
            ...additionalArgs,
          });
        }
      }
    };

    window.addEventListener(runFrameScriptEventName, handleRunFrameScriptFromInteraction);

    return () => {
      window.removeEventListener(runFrameScriptEventName, handleRunFrameScriptFromInteraction);
    };
  }, [currentWindow, execute, args, additionalArgs]);

  // Used when actively moving the floating window, to prevent accidentally
  // losing focus to an iframe or other element
  const [dragging, setDragging] = useState(false);

  const dragEnd = (
    _event: unknown,
    context: {
      node: HTMLElement | null;
    },
  ): void => {
    setDragging(false);
    touchFloatingFrame(id);
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (context.node) {
      const rect = context.node.getBoundingClientRect();
      const left = rect.left;
      const top = rect.top;
      const bottom = top + rect.height;
      const right = left + rect.width;

      const topDelta = top;
      const bottomDelta = windowHeight - bottom;
      const leftDelta = left;
      const rightDelta = windowWidth - right;

      const quadrant = getQuadrant(topDelta, leftDelta, bottomDelta, rightDelta);

      const result = {
        left,
        right,
        top,
        quadrant,
        deltas: {
          top: topDelta,
          bottom: bottomDelta,
          left: leftDelta,
          right: rightDelta,
        },
      };

      setWindowPosition(result);

      maybeUpdateEmployeeConfig?.(id, minimized, windowPosition)({ position: result });
    }
  };

  useEffect(() => {
    const handleUpdate = (): void => {
      if (isFixed) {
        computeFixedPosition();
      } else {
        setWindowPosition(getPosition(false));
      }
    };

    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isFixed, computeFixedPosition, getPosition]);

  // This is the handler for click events coming from the floating frame.
  useManualInteraction(execute, currentWindow, scriptUIRef, pending, args);

  // This is the handler for frame messages coming from the iframe inside the floaing frame.
  useEffect(() => {
    const handleMessageEvent = (ev: MessageEvent): void => {
      if (
        ev.source !== window &&
        messageHandlerScript &&
        !defaultFrameIgnoreUrls.includes(ev.origin)
      ) {
        execute(messageHandlerScript, {
          ...args,
          eventData: ev.data,
        });
      }
    };

    window.addEventListener('message', handleMessageEvent);

    return () => {
      window.removeEventListener('message', handleMessageEvent);
    };
  }, [execute, args, messageHandlerScript]);

  const { outputUIRef, scopedCss, sanitizedHtml, interactableScriptRef } = usePluginCustomHTML(
    currentWindow,
    {},
  );

  const hidden = !delayedModalHide
    ? hiddenByScript || isHiddenByPattern
    : hiddenByScript || isHiddenByPattern || hiddenByModal;

  const parentClassName = `floating-window-parent--${id}`;
  const dragHandleClassName = `floating-drag-handle--${id}`;
  const contentClassName = `floating-window-content--${id}`;
  let currentSide: 'left' | 'right' =
    currentWindow.employee_config?.[id]?.position?.quadrant?.split('-')[1] === 'right'
      ? 'right'
      : 'left';

  if (isBottomLeftFixed) {
    currentSide = 'left';
  } else if (isBottomRightFixed) {
    currentSide = 'right';
  }

  const customIconDataUrl = currentWindow.minimized_config?.customIcon;

  let CustomIcon = null;
  if (customIconDataUrl?.startsWith('data:image/')) {
    CustomIcon = ({ className = '' }: { className?: string }) => (
      <img
        src={customIconDataUrl}
        alt={currentWindow.title || 'Open Frame'}
        className={`object-cover select-none pointer-events-none ${className}`}
      />
    );
  }

  if (!windowPosition) {
    setWindowPosition(getPosition(false));
  }

  return {
    circleProps: {
      id,
      side: currentSide,
      circleIcon,
      CustomIcon,
      circleColor,
      onClick: () => {
        setMinimized(!minimized);
      },

      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      hidden: Boolean(hidden || isHiddenByPattern || hideOnMinimized || triggerHidden),
    },
    parentProps: {
      className: parentClassName,
      dragging,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      hidden: hidden || circleMinimized || isHiddenByPattern || hideOnMinimized,
    },
    draggableProps: {
      onStop: dragEnd,
      onStart: () => {
        setDragging(true);
      },
      bounds: `.${parentClassName}`,
      handle: `.${dragHandleClassName}`,
      defaultPosition: {
        x: windowPosition?.left ?? 0,
        y: windowPosition?.top ?? 0,
      },
      position: {
        x: windowPosition?.left ?? 0,
        y: windowPosition?.top ?? 0,
      },
      disabled: isFixed,
    },
    floatProps: {
      pending,
      width,
      dragging,
      height,
      isCircle: isCircle && minimized,
    },
    contentProps: {
      className: contentClassName,
      dragging,
      solid: true,
    },
    minimized,
    pending,
    indicator,
    hideHeader,
    isFixed,
    isCircle,
    outputUIRef,
    scopedCss,
    sanitizedHtml,
    interactableScriptRef,
    tooltipPosition,
    currentPluginId,
    setMinimized,
    dragHandleClassName,
    height,
    script,
    dragging,
    frameOffset,
    scriptUIRef,
  };
};
