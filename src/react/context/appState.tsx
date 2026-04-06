import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import type {
  PartialBusiness,
  PartialClientObject,
  PartialTeamMember,
  PartialUser,
  UnknownJSON,
} from '../../types/common.js';

const AppStateContext = createContext<AppStateContextValue | null>(null);

export interface AppStateWrapperProps {
  bootstrapPlugins?: {
    id: string;
    api_name: string;
  }[];
  userConfigs?: { config: UnknownJSON; api_name: string }[];
  children: (context: {
    waitingOnRouteScript: boolean;
    hasFinishedBootstrapping: boolean;
  }) => ReactNode;
  user: PartialUser;
  teamMember: PartialTeamMember;
  business: PartialBusiness;
  clientObject: PartialClientObject;
  appPath: string;
}

export type RouteScriptRunState = Record<
  string,
  {
    waitingOnRouteScript: boolean;
  }
>;
interface AppStateContextValue {
  installedPluginAPINamesToIds: Record<string, string>;
  userConfigsByApiName: Record<string, UnknownJSON>;
  user: PartialUser;
  teamMember: PartialTeamMember;
  business: PartialBusiness;
  clientObject: PartialClientObject;
  appPath: string;
  onInitialBootstrap: () => void;
  setRouteScriptRunState: React.Dispatch<React.SetStateAction<RouteScriptRunState>>;
}

export const AppStateWrapper: FC<AppStateWrapperProps> = ({
  children,
  bootstrapPlugins = [],
  userConfigs = [],
  user,
  teamMember,
  business,
  clientObject,
  appPath,
}) => {
  // Track whether the app has become fully visible already, since we don't want to show a blocking loader
  // if a plugin is later enabled after the initial load
  const [hasFinishedBootstrapping, setHasFinishedBootstrapping] = useState(false);

  const [routeScriptRunState, setRouteScriptRunState] = useState<RouteScriptRunState>({});

  const waitingOnRouteScript = useMemo(() => {
    return Object.values(routeScriptRunState).some((state) => state.waitingOnRouteScript);
  }, [routeScriptRunState]);

  const installedPluginAPINamesToIds = useMemo(() => {
    return bootstrapPlugins.reduce((acc, plugin) => {
      return {
        ...acc,
        [plugin.api_name]: plugin.id,
      };
    }, {});
  }, [bootstrapPlugins]);

  const userConfigsByApiName = useMemo(() => {
    return userConfigs.reduce((acc, item) => {
      return {
        ...acc,
        [item.api_name]: item.config,
      };
    }, {});
  }, [userConfigs]);

  const onInitialBootstrap = useCallback(() => {
    setHasFinishedBootstrapping(true);
  }, []);

  return (
    <AppStateContext.Provider
      value={{
        installedPluginAPINamesToIds,
        userConfigsByApiName,
        user,
        teamMember,
        business,
        clientObject,
        appPath,
        onInitialBootstrap,
        setRouteScriptRunState,
      }}
    >
      {children({
        waitingOnRouteScript,
        hasFinishedBootstrapping,
      })}
    </AppStateContext.Provider>
  );
};

export const useAppState = (): AppStateContextValue => {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error('useAppState must be used within an AppStateWrapper');
  }

  return context;
};
