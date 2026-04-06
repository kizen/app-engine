import { useEffect } from 'react';
import type { PartialLocation } from '../../types/common.js';
import { getStableHash } from '../../util/encode.js';
import {
  IFRAME_PREFIX,
  ROUTE_CHANGE_IFRAME_EVENT,
  ROUTE_CHANGE_INTERNAL_EVENT,
} from '../../communication/constants.js';
import { isFlagEnabled } from '../../util/flags.js';

export const useLocationChange = (): void => {
  useEffect(() => {
    let previousEventHash: number | null = null;

    const listener = (e: CustomEventInit<{ location: PartialLocation }>): void => {
      if (!e.detail?.location) {
        return;
      }

      const locationHash = getStableHash(e.detail.location);

      if (locationHash === previousEventHash) {
        return;
      }

      previousEventHash = locationHash;

      const frames: NodeListOf<HTMLIFrameElement> = document.querySelectorAll(
        `iframe[id^=${IFRAME_PREFIX}-]`,
      );

      frames.forEach((frame) => {
        let targetOrigin = null;

        try {
          const url = new URL(frame.src, window.location.href);

          targetOrigin = url.origin;
        } catch (error) {
          const isDebug = isFlagEnabled('script-runner-logging');

          if (isDebug) {
            console.warn(
              'Failed to parse iframe src for location change message target origin:',
              error,
            );
          }
          targetOrigin = null;
        }

        if (!targetOrigin) {
          return;
        }

        frame.contentWindow?.postMessage(
          {
            action: ROUTE_CHANGE_IFRAME_EVENT,
            location: e.detail?.location,
          },
          targetOrigin,
        );
      });
    };

    window.addEventListener(ROUTE_CHANGE_INTERNAL_EVENT, listener);

    return () => {
      window.removeEventListener(ROUTE_CHANGE_INTERNAL_EVENT, listener);
    };
  }, []);
};
