import { ROUTE_CHANGE_INTERNAL_EVENT } from '../communication/constants.js';
import type { PartialLocation } from '../types/common.js';
import type { CommonExecutionPlugin, CommonPluginDefinition } from '../types/run.js';
import type { AsyncFunctionConstructor, BuiltAsyncFn } from '../types/workers.js';

export const getPartialLocation = (): PartialLocation => {
  return {
    host: window.location.host,
    hash: window.location.hash,
    href: window.location.href,
    origin: window.location.origin,
    pathname: window.location.pathname,
    search: window.location.search,
    port: window.location.port,
    protocol: window.location.protocol,
  };
};

export const generateUUIDV4 = (): string => {
  let d = new Date().getTime();

  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    d += performance.now();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = ((d + Math.random() * 16) % 16) | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const AsyncFunction = (
  Object.getPrototypeOf(async function () {
    /* empty */
  }) as { constructor: AsyncFunctionConstructor }
).constructor;

export const getFnWithReturn = (script: string): BuiltAsyncFn => {
  const functionBody = `
    const __cleanup = this.__cleanup.bind(this);
    const __error = this.onError.bind(this);
    let __kizen_internal_result;
    {
      this.__setup();
    }
    try {
        __kizen_internal_result = await (async () => { ${script} })();
    } catch (ex) {
        __error(ex);
    } finally {
        __cleanup(__kizen_internal_result);
    }
  `;

  try {
    const fn = new AsyncFunction(functionBody);

    return { fn, functionBody };
  } catch {
    const errorFnBody = `
      this.__setup();
      this.onError({ message: "The script has a syntax error and could not be parsed" });
      this.__cleanup();
    `;

    const fn = new AsyncFunction(errorFnBody);

    return { fn, functionBody: errorFnBody };
  }
};

export const getFn = (script: string): BuiltAsyncFn => {
  const functionBody = `
    const __cleanup = this.__cleanup.bind(this);
    const __error = this.onError.bind(this);
    {
      this.__setup();
    }
    try {
        ${script}
    } catch (ex) {
        __error(ex);
    } finally {
        __cleanup();
    }
  `;

  try {
    const fn = new AsyncFunction(functionBody);

    return { fn, functionBody };
  } catch {
    const errorFnBody = `
      this.__setup();
      this.onError({ message: "The script has a syntax error and could not be parsed" });
      this.__cleanup();
    `;

    const fn = new AsyncFunction(errorFnBody);

    return { fn, functionBody: errorFnBody };
  }
};

export const generateExecutionKey = (
  pluginConfig?: CommonPluginDefinition | CommonExecutionPlugin,
): string => {
  return `${pluginConfig?.plugin_api_name ?? ''}-${pluginConfig?.id ?? ''}-${pluginConfig?.api_name ?? ''}-${pluginConfig?.script_id ?? ''}`;
};

export const emitRouteChange = (): void => {
  const event = new CustomEvent(ROUTE_CHANGE_INTERNAL_EVENT, {
    detail: {
      location: getPartialLocation(),
    },
  });

  window.dispatchEvent(event);
};

const splitScriptApiName = (
  scriptApiName: string,
): { pluginApiName: string | undefined; actionApiName: string | undefined } => {
  const [pluginApiName, actionApiName] = scriptApiName.split('.');

  return {
    pluginApiName,
    actionApiName,
  };
};

export const findMatchingAction = (
  availableActions: {
    pluginApp?: {
      apiName: string;
    };
    apiName: string;
  }[],
  apiName?: string,
): unknown => {
  if (!apiName) {
    return null;
  }

  const { pluginApiName, actionApiName } = splitScriptApiName(apiName);

  if (!pluginApiName) {
    const action = availableActions.find((act) => !act.pluginApp && act.apiName === actionApiName);

    return action;
  }

  const action = availableActions.find(
    (act) => act.apiName === actionApiName && act.pluginApp?.apiName === pluginApiName,
  );

  return action;
};
