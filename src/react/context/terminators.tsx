import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type FC,
  type ReactNode,
} from 'react';
import type { TerminatorContent, Terminators } from '../../types/run.js';

interface TerminatorsContextValue {
  terminators: Terminators;
  cleanupWorkers: () => void;
}

const TerminatorsContext = createContext<TerminatorsContextValue | null>(null);

export const TerminatorsWrapper: FC<{
  children: ReactNode;
}> = ({ children }) => {
  const terminators = useRef({} as TerminatorContent);

  const cleanupWorkers = useCallback(() => {
    Object.keys(terminators.current).forEach((key) => {
      terminators.current[key]?.forEach((fn) => {
        fn();
      });
      terminators.current[key] = [];
    });
  }, []);

  useEffect(() => {
    return () => {
      cleanupWorkers();
    };
  }, [cleanupWorkers]);

  return (
    <TerminatorsContext.Provider value={{ terminators, cleanupWorkers }}>
      {children}
    </TerminatorsContext.Provider>
  );
};

export const useTerminators = (): TerminatorsContextValue => {
  const context = useContext(TerminatorsContext);

  if (!context) {
    throw new Error('useTerminators must be used within a TerminatorsWrapper');
  }

  return context;
};
