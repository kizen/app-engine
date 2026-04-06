import { useRef } from 'react';
import { useToast } from '../context/toast.js';
import { useAppState } from '../context/appState.js';
import { useRecordDetailCustomScript } from '../hooks/useRecordDetailCustomScript.js';
import type { MaybeMessageError } from '../../types/common.js';
import type { CommonPluginDefinition, RouteScriptConfig } from '../../types/index.js';

interface RouteScriptRunnerProps {
  pathname: string;
  routeScripts: RouteScriptConfig[];
}

const getRouteMatcher = (
  objectId: string,
  clientObjectId: string,
): { isClient: boolean; exp: RegExp } => {
  if (objectId === clientObjectId || objectId === 'client') {
    return { isClient: true, exp: new RegExp(`^/client/([a-zA-Z0-9-]+)/.*$`) };
  }

  return {
    isClient: false,
    exp: new RegExp(`^/custom-objects/${objectId}/([a-zA-Z0-9-]+).*$`),
  };
};

const getPluginStateKey = (item: CommonPluginDefinition): string => {
  return `${item.plugin_api_name}-${item.api_name}`;
};

export const RouteScriptRunner = (props: RouteScriptRunnerProps): null => {
  const { showToast } = useToast();
  const { pathname, routeScripts } = props;

  const previousPathname = useRef('');

  const { clientObject, setRouteScriptRunState } = useAppState();
  const clientObjectId = clientObject.id;

  const [executeScript] = useRecordDetailCustomScript({
    onError: (e) => {
      showToast({
        message: `Action could not run: ${(e as MaybeMessageError)?.message ?? ''}`,
        variant: 'failure',
      });
    },
    // Only route script handlers need to be able to release a blocking script, since they're the only type that
    // can block the app rendering.
    onReleaseBlockingScript: (executionPlugin) => {
      if (executionPlugin) {
        const key = getPluginStateKey(executionPlugin as CommonPluginDefinition);
        setRouteScriptRunState((state) => {
          return {
            ...state,
            [key]: {
              ...state[key],
              waitingOnRouteScript: false,
            },
          };
        });
      }
    },
    entityId: '',
    objectId: '',
  });

  const getRunnerStateForScript = (
    checkPath: string,
    checkObjectId: string,
  ): { canRunScript: true; entityId: string; customObjectId: string } | { canRunScript: false } => {
    const { exp, isClient } = getRouteMatcher(checkObjectId, clientObjectId);

    const match = exp.exec(checkPath);

    if (match?.[1]) {
      return {
        canRunScript: true,
        entityId: match[1],
        customObjectId: isClient ? clientObjectId : checkObjectId,
      };
    }

    return {
      canRunScript: false,
    };
  };

  const handlePathChange = (previousPath = '', currentPath = ''): void => {
    const runQueue = routeScripts
      .map((script) => {
        return {
          ...getRunnerStateForScript(currentPath, script.custom_object.id),
          ...script,
        };
      })
      .filter(
        (
          q,
        ): q is RouteScriptConfig & {
          canRunScript: true;
          entityId: string;
          customObjectId: string;
        } => {
          if (!q.canRunScript) {
            return false;
          }

          if (q.routes?.length) {
            return q.routes.some((pattern) => {
              return new RegExp(pattern).test(currentPath);
            });
          }

          return true;
        },
      );

    runQueue.forEach((item) => {
      const itemKey = getPluginStateKey(item);

      setRouteScriptRunState((state) => {
        return {
          ...state,
          [itemKey]: {
            ...state[itemKey],
            waitingOnRouteScript: item.blocking,
          },
        };
      });
      void executeScript(
        item.script,
        {
          previousRoute: previousPath,
          currentRoute: currentPath,
        },
        item,
        {
          entityId: item.entityId,
          objectId: item.customObjectId,
        },
      ).then(() => {
        setRouteScriptRunState((state) => {
          return {
            ...state,
            [itemKey]: {
              ...state[itemKey],
              waitingOnRouteScript: false,
            },
          };
        });
      });
    });
  };

  if (previousPathname.current !== pathname && clientObjectId) {
    const previousValue = previousPathname.current;
    previousPathname.current = pathname;

    handlePathChange(previousValue, pathname);
  }

  return null;
};
