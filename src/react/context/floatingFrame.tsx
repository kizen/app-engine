import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { TouchFloatingFrame } from './index.js';

export interface FloatingFrameContextValue {
  touchFloatingFrame: TouchFloatingFrame;
  floatingFrameOffset: Record<string, number>;
}

export interface FloatingFrameWrapperProps {
  children: (hiddenByModal: boolean) => React.ReactNode;
}

const FloatingFrameContext = createContext<FloatingFrameContextValue | null>(null);

export const FloatingFrameWrapper: React.FC<FloatingFrameWrapperProps> = ({ children }) => {
  const [floatingFrameOrder, setFloatingFrameOrder] = useState<string[]>([]);
  const [hiddenByModal, setHiddenByModal] = useState(false);

  const touchFloatingFrame = useCallback<TouchFloatingFrame>((id, cb) => {
    setFloatingFrameOrder((prev) => {
      const res = prev.filter((i) => i !== id);
      const done = [id, ...res];

      cb?.(done);

      return done;
    });
  }, []);

  const floatingFrameOffset = useMemo(() => {
    return [...floatingFrameOrder].reverse().reduce((acc, id, index) => {
      return {
        ...acc,
        [id]: index,
      };
    }, {});
  }, [floatingFrameOrder]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const modal = document.querySelector('div[role="dialog"]');
      if (modal) {
        setHiddenByModal(true);
      } else {
        setHiddenByModal(false);
      }
    });

    observer.observe(document.body, {
      childList: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <FloatingFrameContext.Provider
      value={{
        touchFloatingFrame,
        floatingFrameOffset,
      }}
    >
      {children(hiddenByModal)}
    </FloatingFrameContext.Provider>
  );
};

export const useFloatingFrameContext = (): FloatingFrameContextValue => {
  const context = useContext(FloatingFrameContext);

  if (!context) {
    throw new Error('useFloatingFrame must be used within a FloatingFrameWrapper');
  }

  return context;
};
