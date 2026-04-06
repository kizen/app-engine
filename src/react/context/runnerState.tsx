import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import { INDICATOR_TYPE } from '../../communication/constants.js';

const RunnerStateContext = createContext<RunnerStateContextValue | null>(null);

type GetNewStateFn = (currentState: RunnerStateEntry) => RunnerStateEntry;

interface RunnerStateContextValue {
  getRunnerStateUpdater: (key: string) => (getNewState: GetNewStateFn) => void;
  getRunnerState: (key?: string) => RunnerStateEntry;
}

interface RunnerStateEntry {
  indicator: INDICATOR_TYPE;
  hidden: boolean;
  pending: boolean;
}

type RunnerState = Record<string, RunnerStateEntry>;

interface RunnerStateWrapperProps {
  children: (showLoadingIndicator: boolean) => ReactNode;
}

export const RunnerStateWrapper: FC<RunnerStateWrapperProps> = ({ children }) => {
  const [runnerState, setRunnerState] = useState<RunnerState>({});

  const getRunnerStateUpdater = useCallback(
    (key: string) => (getNewState: GetNewStateFn) => {
      setRunnerState((prev: RunnerState) => {
        const result = {
          ...prev,
          [key]: getNewState(
            prev[key] ?? { indicator: INDICATOR_TYPE.NONE, hidden: false, pending: false },
          ),
        };
        return result;
      });
    },
    [],
  );

  const getRunnerState = useCallback(
    (key?: string) => {
      if (!key || !runnerState[key]) {
        return {
          indicator: INDICATOR_TYPE.NONE,
          hidden: false,
          pending: false,
        };
      }
      return {
        ...runnerState[key],
      };
    },
    [runnerState],
  );

  const showLoadingIndicator = useMemo(() => {
    const keys = Object.keys(runnerState);
    return (
      keys.length > 0 && keys.some((name) => runnerState[name]?.indicator === INDICATOR_TYPE.BLOCK)
    );
  }, [runnerState]);

  return (
    <RunnerStateContext.Provider
      value={{
        getRunnerStateUpdater,
        getRunnerState,
      }}
    >
      {children(showLoadingIndicator)}
    </RunnerStateContext.Provider>
  );
};

export const useRunnerState = (): RunnerStateContextValue => {
  const context = useContext(RunnerStateContext);

  if (!context) {
    throw new Error('useRunnerState must be used within a RunnerStateWrapper');
  }

  return context;
};
