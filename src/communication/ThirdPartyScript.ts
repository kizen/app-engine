import type { Instance } from '../types/contexts.js';
import { ACTIONS, COMMUNICATIONS } from './constants.js';

const freshWorksPattern = /https:\/\/.*widget\.freshworks\.com\/.*\.js/;
const intercomPattern = /https:\/\/widget\.intercom\.io\/widget\/[a-z0-9]+/;

export const ALLOWED_INTEGRATIONS = {
  FRESHWORKS: 'freshworks',
  INTERCOM: 'intercom',
} as const;

/*
    Third party scripts must match an approved regex, and arbitrary scripts cannot be
    loaded by a plugin if they do not.
*/
export const getScriptIntegrationType = (
  scriptUrl: string,
): (typeof ALLOWED_INTEGRATIONS)[keyof typeof ALLOWED_INTEGRATIONS] | undefined => {
  if (freshWorksPattern.test(scriptUrl)) {
    return ALLOWED_INTEGRATIONS.FRESHWORKS;
  }

  if (intercomPattern.test(scriptUrl)) {
    return ALLOWED_INTEGRATIONS.INTERCOM;
  }
};

/* 
    The global name of the third-party integration. This is the variable where the
    integration code can be called from. For example, if the third-party integration
    is 'Freshworks', function calls will be made like window.FreshworksWidget(...args).
*/
export const thirdPartyGlobalNames = {
  [ALLOWED_INTEGRATIONS.FRESHWORKS]: 'FreshworksWidget',
  [ALLOWED_INTEGRATIONS.INTERCOM]: 'Intercom',
};

/*
    For a predefined third-party integration, the setup script will be run
    BEFORE the third party javascript has been loaded.
*/
export const thirdPartySetupScripts = {
  [ALLOWED_INTEGRATIONS.FRESHWORKS]: (args: Record<string, unknown>) => {
    (window as unknown as Record<string, unknown>).fwSettings = {
      widget_id: args.widgetId,
    };

    // Function adapted from https://developers.freshdesk.com/widget-api/#introduction
    (function (...rest) {
      if (
        'function' !=
        typeof (window as unknown as Record<string, unknown>)[
          thirdPartyGlobalNames[ALLOWED_INTEGRATIONS.FRESHWORKS]
        ]
      ) {
        const n: { q: unknown[]; __kizen_pending?: boolean } = function () {
          n.q.push(...rest);
        };

        n.__kizen_pending = true;

        // eslint-disable-next-line
        ((n.q = []), ((window as any)[thirdPartyGlobalNames[ALLOWED_INTEGRATIONS.FRESHWORKS]] = n));
      }
    })();
  },
  // Function adapted from https://developers.intercom.com/installing-intercom/web/installation
  [ALLOWED_INTEGRATIONS.INTERCOM]: () => {
    (function () {
      if (
        'function' !=
        typeof (window as unknown as Record<string, unknown>)[
          thirdPartyGlobalNames[ALLOWED_INTEGRATIONS.INTERCOM]
        ]
      ) {
        const w = window as unknown as Record<string, unknown>;
        const i: { c: (args: unknown) => void; q: unknown[]; __kizen_pending?: boolean } =
          function () {
            // eslint-disable-next-line prefer-rest-params
            i.c(arguments);
          };

        i.q = [];
        i.c = function (args: unknown) {
          i.q.push(args);
        };

        i.__kizen_pending = true;

        w[thirdPartyGlobalNames[ALLOWED_INTEGRATIONS.INTERCOM]] = i;
      }
    })();
  },
};

/*
    For a predefined third-party integration, the ready predicate will be run
    AFTER the third party javascript has been loaded, but before the worker has been
    notified that it is ready. This is optional, but gives a chance to wait for an arbitrary
    condition to be met before considering the third-party code initialized successfully.
*/
export const thirdPartyReadyPredicates = {
  [ALLOWED_INTEGRATIONS.FRESHWORKS]: () => {
    return (
      (
        (window as unknown as Record<string, unknown>)[
          thirdPartyGlobalNames[ALLOWED_INTEGRATIONS.FRESHWORKS]
        ] as { __kizen_pending?: boolean } | undefined
      )?.__kizen_pending !== true
    );
  },
  [ALLOWED_INTEGRATIONS.INTERCOM]: () => {
    return (
      (
        (window as unknown as Record<string, unknown>)[
          thirdPartyGlobalNames[ALLOWED_INTEGRATIONS.INTERCOM]
        ] as { __kizen_pending?: boolean } | undefined
      )?.__kizen_pending !== true
    );
  },
};

export class ThirdPartyScript {
  private instance: Instance;
  private scriptUrl: string;
  private integration: (typeof ALLOWED_INTEGRATIONS)[keyof typeof ALLOWED_INTEGRATIONS];

  constructor(instance: Instance, scriptUrl: string) {
    this.instance = instance;
    this.scriptUrl = scriptUrl;
    const type = getScriptIntegrationType(scriptUrl);

    if (type) {
      this.integration = type;
    } else {
      throw new Error(`Error: Disallowed script url: ${scriptUrl}`);
    }
  }

  get type(): (typeof ALLOWED_INTEGRATIONS)[keyof typeof ALLOWED_INTEGRATIONS] {
    return this.integration;
  }

  public call(...params: unknown[]): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.COMMUNICATE,
        type: COMMUNICATIONS.CALL_THIRD_PARTY_SCRIPT,
        eventName: `thirdParty:${COMMUNICATIONS.CALL_THIRD_PARTY_SCRIPT}`,
        recipient: {
          script: this.scriptUrl,
          type: this.type,
        },
        params,
      }),
    );
  }
}
