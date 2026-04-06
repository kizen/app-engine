import { createContext, useCallback, useContext, type FC } from 'react';

const HistoryContext = createContext<HistoryContextValue | null>(null);

export interface HistoryWrapperProps {
  children: React.ReactNode;
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
}

interface HistoryContextValue {
  push: (path: string) => void;
  replace: (path: string) => void;
}

export const HistoryWrapper: FC<HistoryWrapperProps> = ({ children, onNavigate }) => {
  const push = useCallback(
    (path: string) => {
      onNavigate(path, { replace: false });
    },
    [onNavigate],
  );

  const replace = useCallback(
    (path: string) => {
      onNavigate(path, { replace: true });
    },
    [onNavigate],
  );

  return (
    <HistoryContext.Provider
      value={{
        push,
        replace,
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = (): HistoryContextValue => {
  const context = useContext(HistoryContext);

  if (!context) {
    throw new Error('useHistory must be used within an HistoryWrapper');
  }

  return context;
};
