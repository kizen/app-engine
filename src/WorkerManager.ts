import type { RefObject } from 'react';
import type {
  InternalSessionData,
  SetInternalSessionDataFn,
  ShowToastOptions,
  StateChangePayload,
  WorkerContextArgs,
} from './types/contexts.js';
import type {
  AuthorizeEvent,
  CommonExecutionPlugin,
  ConsoleLogEvent,
  CommonPluginDefinition,
  CommunicateEvent,
  CopyToClipboardEvent,
  CreateFileIdFn,
  DoneEvent,
  DynamicPromptRequestEvent,
  ErrorEvent,
  GetPendingCacheCountFn,
  HideEvent,
  IframeOutputEvent,
  InstallThirdPartyScriptRequestEvent,
  InvalidateCacheFn,
  KizenFile,
  MessageEventData,
  OnClearToastsFn,
  OnConsoleLogFn,
  OnNetworkRequestFn,
  OnShowToastFn,
  OpenCreateRecordModalRequestEvent,
  OpenCreateRelatedRecordModalRequestEvent,
  OpenWindowEvent,
  PostFormDataRequestEvent,
  PromptRequestEvent,
  QueryRequestEvent,
  RecipientConfig,
  RefreshEntityEvent,
  RefreshTimelineEvent,
  RequestableQueryMethods,
  SetStateEvent,
  ShowEvent,
  ShowToastEvent,
  UIOutputEvent,
  UpdateSessionDataEvent,
  PerformKizenFileUploadFn,
  UploadFilePayload,
  UploadFileRequestEvent,
  ShowViewInModalRequestEvent,
  CloseModalRequestEvent,
} from './types/run.js';
import type {
  ModalConfig,
  OnCloseModalFn,
  OnShowCreateRecordModalFn,
  OnShowCreateRelatedRecordModalFn,
  OnShowModalFn,
  ShowViewInModalOptions,
} from './types/modals.js';
import type { OnNetworkErrorFn } from './types/request.js';
import { ACTIONS, COMMUNICATIONS, IFRAME_PREFIX, RESPONSES } from './communication/constants.js';
import type { UnknownJSON } from './types/common.js';
import {
  getScriptIntegrationType,
  thirdPartyGlobalNames,
  thirdPartyReadyPredicates,
  thirdPartySetupScripts,
  type ALLOWED_INTEGRATIONS,
} from './communication/ThirdPartyScript.js';
import { generateUUIDV4, getPartialLocation } from './util/run.js';
import { KizenRequestError } from './util/errors.js';
import type { WorkerSetup } from './types/workers.js';
import { getPluginSafeHTML } from './util/values.js';

const isRelative = (url: string): boolean => {
  return url.startsWith('/');
};

const allowedAllowValues = [
  'microphone',
  'speaker-selection',
  'autoplay',
  'camera',
  'display-capture',
  'hid',
];

const allowedSandboxValues = ['allow-popups', 'allow-scripts', 'allow-same-origin'];

const refreshTimeout = 30000; // 30 seconds
const refreshInterval = 100;

export class WorkerManager {
  private worker: Worker;
  private scriptUIRef?: RefObject<HTMLDivElement | null> | undefined;
  private onStateChange?: ((state: StateChangePayload) => void) | undefined;
  private done: (preserve: boolean, result?: unknown) => void;
  private onError?: WorkerContextArgs['onError'];
  private waitForFrame = false;
  private plugin?: CommonPluginDefinition | undefined;
  private executionPlugin?: CommonExecutionPlugin | undefined;
  private frameId?: string;
  private onShowToast?: OnShowToastFn | undefined;
  private onClearToasts?: OnClearToastsFn | undefined;
  private sessionData: InternalSessionData = {};
  private setSessionData: (state: InternalSessionData) => void;
  private pluginComponentId: string;
  private onShowModal?: OnShowModalFn | undefined;
  private onCloseModal?: OnCloseModalFn | undefined;
  private onShowCreateRecordModal?: OnShowCreateRecordModalFn | undefined;
  private onShowCreateRelatedRecordModal?: OnShowCreateRelatedRecordModalFn | undefined;
  private onReleaseBlockingScript?: WorkerContextArgs['onReleaseBlockingScript'];
  private pluginApiName?: string;
  private onNetworkError?: OnNetworkErrorFn | undefined;
  private onNetworkRequest?: OnNetworkRequestFn | undefined;
  private invalidateCache?: InvalidateCacheFn | undefined; // todo
  private getPendingCacheCount?: GetPendingCacheCountFn | undefined; // todo
  private createFileId?: CreateFileIdFn | undefined;
  private performFileUpload?: PerformKizenFileUploadFn | undefined;
  private pushHistory?: ((path: string) => void) | undefined;
  private appPath: string;
  private onConsoleLog?: OnConsoleLogFn | undefined;

  constructor(args: {
    worker: Worker;
    done: (preserve: boolean, result?: unknown) => void;
    scriptUIRef?: RefObject<HTMLDivElement | null> | undefined;
    onStateChange?: ((state: StateChangePayload) => void) | undefined;
    onError?: WorkerContextArgs['onError'] | undefined;
    onReleaseBlockingScript?: WorkerContextArgs['onReleaseBlockingScript'] | undefined;
    plugin?: CommonPluginDefinition | undefined;
    executionPlugin?: CommonExecutionPlugin | undefined;
    onShowToast?: OnShowToastFn | undefined;
    onClearToasts?: OnClearToastsFn | undefined;
    sessionData: InternalSessionData;
    setSessionData?: SetInternalSessionDataFn | undefined;
    pluginComponentId: string;
    onShowModal?: OnShowModalFn | undefined;
    onCloseModal?: OnCloseModalFn | undefined;
    onShowCreateRecordModal: OnShowCreateRecordModalFn | undefined;
    onShowCreateRelatedRecordModal: OnShowCreateRelatedRecordModalFn | undefined;
    onNetworkError?: OnNetworkErrorFn | undefined;
    onNetworkRequest?: OnNetworkRequestFn | undefined;
    invalidateCache?: InvalidateCacheFn | undefined;
    getPendingCacheCount?: GetPendingCacheCountFn | undefined;
    createFileId?: CreateFileIdFn | undefined;
    performFileUpload?: PerformKizenFileUploadFn | undefined;
    pushHistory?: ((path: string) => void) | undefined;
    appPath: string;
    onConsoleLog?: OnConsoleLogFn | undefined;
  }) {
    this.scriptUIRef = args.scriptUIRef;
    this.onStateChange = args.onStateChange;
    this.done = args.done;
    this.onError = args.onError;
    this.onReleaseBlockingScript = args.onReleaseBlockingScript;
    this.worker = args.worker;
    this.worker.onmessage = this.handleMessage;
    this.plugin = args.plugin;
    this.executionPlugin = args.executionPlugin;
    this.onShowToast = args.onShowToast;
    this.onClearToasts = args.onClearToasts;
    this.pluginComponentId = args.pluginComponentId;
    this.onShowModal = args.onShowModal;
    this.onCloseModal = args.onCloseModal;
    this.onShowCreateRecordModal = args.onShowCreateRecordModal;
    this.onShowCreateRelatedRecordModal = args.onShowCreateRelatedRecordModal;
    this.onNetworkError = args.onNetworkError;
    this.onNetworkRequest = args.onNetworkRequest;
    this.invalidateCache = args.invalidateCache;
    this.getPendingCacheCount = args.getPendingCacheCount;
    this.createFileId = args.createFileId;
    this.performFileUpload = args.performFileUpload;
    this.pushHistory = args.pushHistory;
    this.appPath = args.appPath;
    this.onConsoleLog = args.onConsoleLog;

    if (this.plugin) {
      this.frameId = `${IFRAME_PREFIX}-${this.plugin.plugin_api_name}-${this.plugin.api_name}`;
    }

    this.pluginApiName =
      this.executionPlugin?.plugin_api_name ?? this.plugin?.plugin_api_name ?? '';

    if (this.pluginApiName) {
      this.sessionData = args.sessionData[this.pluginApiName] as InternalSessionData;
      this.setSessionData = (state: InternalSessionData) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        args.setSessionData?.(this.pluginApiName!, state);
      };
    } else {
      this.setSessionData = () => {
        this.onError?.({
          message: 'Script must be associated with a plugin to use session data',
        });
      };
    }
  }

  private handleMessage = async (rawEvent: MessageEvent): Promise<void> => {
    const event = JSON.parse(rawEvent.data as string) as MessageEventData;

    const { action } = event;

    switch (action) {
      case ACTIONS.QUERY_REQUEST: {
        const consideredEvent = event as QueryRequestEvent;
        await this.handleQueryRequest(
          consideredEvent.id,
          consideredEvent.method,
          consideredEvent.url,
          consideredEvent.payload,
          consideredEvent.options,
        );

        return;
      }
      case ACTIONS.UI_OUTPUT: {
        const consideredEvent = event as UIOutputEvent;

        this.handleUIOutput(consideredEvent.markup);

        return;
      }
      case ACTIONS.IFRAME_OUTPUT: {
        const consideredEvent = event as IframeOutputEvent;

        this.handleIframeOutput(
          consideredEvent.url,
          consideredEvent.allow,
          consideredEvent.sandbox,
          consideredEvent.preserve,
        );

        return;
      }
      case ACTIONS.POSTFORMDATA_REQUEST: {
        const consideredEvent = event as PostFormDataRequestEvent;

        this.handleFormPostRequest(
          consideredEvent.id,
          consideredEvent.url,
          consideredEvent.payload,
          consideredEvent.createNewTab,
        );

        return;
      }
      case ACTIONS.UPLOADFILE_REQUEST: {
        const consideredEvent = event as UploadFileRequestEvent;

        await this.handleUploadFileRequest(consideredEvent.id, consideredEvent.payload);

        return;
      }
      case ACTIONS.SETSTATE: {
        const consideredEvent = event as SetStateEvent;

        this.onStateChange?.(consideredEvent.state);

        return;
      }
      case ACTIONS.DONE: {
        const consideredEvent = event as DoneEvent;

        this.handleDone(consideredEvent.preserve, consideredEvent.result);

        return;
      }
      case RESPONSES.ERROR: {
        const consideredEvent = event as ErrorEvent;

        this.onError?.({ message: consideredEvent.error });

        return;
      }
      case ACTIONS.OPEN_WINDOW: {
        const consideredEvent = event as OpenWindowEvent;

        this.handleOpenWindow(
          consideredEvent.url,
          consideredEvent.target,
          consideredEvent.features,
        );

        return;
      }
      case ACTIONS.COMMUNICATE: {
        const consideredEvent = event as CommunicateEvent;

        this.handleCommunication(
          consideredEvent.type,
          consideredEvent.recipient,
          consideredEvent.args,
          consideredEvent.params,
        );

        return;
      }
      case ACTIONS.HIDE: {
        const consideredEvent = event as HideEvent;
        const { config } = consideredEvent;

        let triggerHidden = false;

        if (config.hideTrigger) {
          triggerHidden = true;
        }

        this.onStateChange?.({ hidden: true, triggerHidden });

        return;
      }
      case ACTIONS.SHOW: {
        const consideredEvent = event as ShowEvent;
        const { config } = consideredEvent;

        let triggerHidden = false;

        if (config.showTrigger === false) {
          triggerHidden = true;
        }

        this.onStateChange?.({ hidden: false, triggerHidden });

        return;
      }
      case ACTIONS.EXPAND: {
        this.onStateChange?.({ minimized: false });

        return;
      }
      case ACTIONS.COLLAPSE: {
        this.onStateChange?.({ minimized: true });

        return;
      }
      case ACTIONS.HIDE_HEADER: {
        this.onStateChange?.({ hideHeader: true });

        return;
      }
      case ACTIONS.SHOW_HEADER: {
        this.onStateChange?.({ hideHeader: false });

        return;
      }
      case ACTIONS.COPY_TO_CLIPBOARD: {
        const consideredEvent = event as CopyToClipboardEvent;

        await this.copyToClipboard(consideredEvent.text);

        return;
      }
      case ACTIONS.OPEN_CREATE_RECORD_MODAL_REQUEST: {
        const consideredEvent = event as OpenCreateRecordModalRequestEvent;

        this.handleCreateRecordRequest(consideredEvent.id, consideredEvent.entityId);

        return;
      }
      case ACTIONS.OPEN_CREATE_RELATED_RECORD_MODAL_REQUEST: {
        const consideredEvent = event as OpenCreateRelatedRecordModalRequestEvent;

        this.handleCreateRelatedRecordRequest(
          consideredEvent.id,
          consideredEvent.objectId,
          consideredEvent.relatedEntityId,
        );

        return;
      }
      case ACTIONS.SHOW_TOAST: {
        const consideredEvent = event as ShowToastEvent;

        this.showToast(consideredEvent.message, consideredEvent.toastOptions);

        return;
      }
      case ACTIONS.CLEAR_TOASTS: {
        this.clearToasts();

        return;
      }
      case ACTIONS.REFRESH_TIMELINE: {
        const consideredEvent = event as RefreshTimelineEvent;

        this.handleRefreshTimeline(consideredEvent.entityId);

        return;
      }
      case ACTIONS.REFRESH_ENTITY: {
        const consideredEvent = event as RefreshEntityEvent;

        await this.handleRefreshEntity(consideredEvent.entityId, consideredEvent.id);

        return;
      }
      case ACTIONS.UPDATE_SESSION_DATA: {
        const consideredEvent = event as UpdateSessionDataEvent;

        this.handleSetSessionData(consideredEvent.update);

        return;
      }
      case ACTIONS.INSTALL_THIRD_PARTY_SCRIPT_REQUEST: {
        const consideredEvent = event as InstallThirdPartyScriptRequestEvent;

        this.handleInstallThirdPartyScriptRequest(
          consideredEvent.id,
          consideredEvent.url,
          consideredEvent.args,
        );

        return;
      }
      case ACTIONS.PROMPT_REQUEST: {
        const consideredEvent = event as PromptRequestEvent;

        this.handlePromptRequest(consideredEvent.id, consideredEvent.config, false);

        return;
      }
      case ACTIONS.DYNAMIC_PROMPT_REQUEST: {
        const consideredEvent = event as DynamicPromptRequestEvent;

        this.handlePromptRequest(consideredEvent.id, consideredEvent.config, true);

        return;
      }
      case ACTIONS.SHOW_VIEW_IN_MODAL_REQUEST: {
        const consideredEvent = event as ShowViewInModalRequestEvent;

        this.handleShowViewInModalRequest(
          consideredEvent.id,
          consideredEvent.viewId,
          consideredEvent.args,
          consideredEvent.options,
        );

        return;
      }
      case ACTIONS.CLOSE_MODAL_REQUEST: {
        const consideredEvent = event as CloseModalRequestEvent;

        this.onCloseModal?.(consideredEvent.values, consideredEvent.canceled);

        return;
      }
      case ACTIONS.RELEASE_BLOCKING_SCRIPT: {
        this.handleReleaseBlockingScript();

        return;
      }
      case ACTIONS.AUTHORIZE: {
        const consideredEvent = event as AuthorizeEvent;

        this.handleAuthorize(consideredEvent.serviceName, consideredEvent.config);

        return;
      }
      case ACTIONS.CONSOLE_LOG: {
        const consideredEvent = event as ConsoleLogEvent;

        console[consideredEvent.level](...consideredEvent.args);
        this.onConsoleLog?.(consideredEvent.level, consideredEvent.args);

        return;
      }
      default:
        return;
    }
  };

  private handleCommunication = (
    type: string,
    recipient: RecipientConfig,
    args?: Record<string, unknown>,
    params?: unknown[],
  ): void => {
    if (type === COMMUNICATIONS.SEND_MESSAGE_TO_FRAME) {
      if (this.frameId) {
        const target = document.getElementById(this.frameId) as HTMLIFrameElement | undefined;

        if (target) {
          target.contentWindow?.postMessage(
            {
              ...(args?.payload ?? {}),
              __kizen: {
                recipient,
                frameId: this.frameId,
              },
            },
            args?.path ?? '*',
          );
        }
      }
    } else if (type === COMMUNICATIONS.CALL_THIRD_PARTY_SCRIPT) {
      this.handleCallThirdPartyScript(recipient.type, params);
    } else {
      const pluginApiName = this.executionPlugin?.plugin_api_name ?? this.plugin?.plugin_api_name;
      const event = new CustomEvent(`integration:${type}`, {
        detail: {
          recipient: {
            ...recipient,
            plugin: pluginApiName,
          },
          args,
        },
      });
      window.dispatchEvent(event);
    }
  };

  private handleDone = (preserve: boolean, result?: unknown): void => {
    if (!this.waitForFrame) {
      this.done(preserve, result);
    }
  };

  private postMessage = (action: string, data: Record<string, unknown>): void => {
    this.worker.postMessage(
      JSON.stringify({
        action,
        ...data,
      }),
    );
  };

  private handleSetSessionData = (state: InternalSessionData): void => {
    this.setSessionData(state);
  };

  private handleQueryRequest = async (
    id: string,
    method: RequestableQueryMethods,
    url: string,
    payload?: UnknownJSON,
    options?: UnknownJSON,
  ): Promise<void> => {
    try {
      const data = await this.onNetworkRequest?.(method, url, payload, options);

      this.postMessage(RESPONSES.QUERY_RESPONSE, { data, id });
    } catch (ex) {
      this.onNetworkError?.(ex);

      const error =
        ex instanceof KizenRequestError
          ? {
              __kizenError: true as const,
              proxyStatus: ex.proxyStatus,
              upstreamStatus: ex.upstreamStatus,
              upstreamResponse: ex.upstreamResponse,
              message: ex.message,
            }
          : (() => {
              if (ex instanceof Error) {
                return { message: ex.message, name: ex.name };
              }

              try {
                const serialized = JSON.parse(JSON.stringify(ex)) as UnknownJSON | null;

                if (
                  typeof serialized === 'object' &&
                  serialized !== null &&
                  !Array.isArray(serialized)
                ) {
                  return serialized;
                }
              } catch {
                // if we can't serialize the error, just return its string representation
              }

              return { message: String(ex) };
            })();

      this.postMessage(RESPONSES.QUERY_RESPONSE, { error, id });
    }
  };

  private handleUIOutput = (markup: string): void => {
    if (this.scriptUIRef?.current) {
      const sanitizedMarkup = getPluginSafeHTML(markup).html;

      this.scriptUIRef.current.innerHTML = sanitizedMarkup;
    }
  };

  private onLoad = (payload: { iframe?: HTMLIFrameElement; preserve: boolean }): void => {
    if (payload.iframe) {
      this.waitForFrame = false;
      this.handleDone(payload.preserve);
    }
  };

  private handleIframeOutput = (
    url: string,
    allow: string[] = [],
    sandbox: string[] = [],
    preserve = false,
  ): void => {
    if (this.scriptUIRef?.current) {
      const parsedAllowList = allow.filter((a) => allowedAllowValues.includes(a));
      const parsedSandboxList = sandbox.filter((s) => allowedSandboxValues.includes(s));
      this.waitForFrame = true;
      const element = document.createElement('iframe');
      element.src = url;
      element.allow = parsedAllowList.join('; ');
      parsedSandboxList.forEach((s) => {
        element.sandbox.add(s);
      });
      element.style.border = 'none';
      element.style.width = '100%';
      element.style.height = '100%';
      element.onload = this.onLoad.bind(this, { iframe: element, preserve });
      if (this.frameId) {
        element.id = this.frameId;
      }
      this.scriptUIRef.current.replaceChildren(element);
    }
  };

  private handleCreateRecordRequest = (promiseId: string, objectId: string): void => {
    this.onShowCreateRecordModal?.(objectId, (result: UnknownJSON) => {
      this.postMessage(RESPONSES.CREATE_RECORD_RESPONSE, {
        id: promiseId,
        data: result,
      });
    });
  };

  private handleCreateRelatedRecordRequest = (
    promiseId: string,
    objectId: string,
    relatedEntityId: string,
  ): void => {
    this.onShowCreateRelatedRecordModal?.(objectId, relatedEntityId, (result) => {
      this.postMessage(RESPONSES.CREATE_RELATED_RECORD_RESPONSE, {
        id: promiseId,
        data: result,
      });
    });
  };

  private showToast = (message: string, options?: ShowToastOptions): void => {
    this.onShowToast?.({
      message,
      variant: options?.variant ?? 'success',
      autohide: options?.autohide ?? true,
    });
  };

  private clearToasts = (): void => {
    this.onClearToasts?.();
  };

  private copyToClipboard = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      this.onError?.({
        message: (err as Error).message,
      });
    }
  };

  private handleRefreshTimeline = (entityId: string): void => {
    this.invalidateCache?.('timeline', entityId);
  };

  // When we refresh a set of react-query keys, we need to wait for the queries to settle and finish refetching
  private waitForIdleState = (search: string): Promise<boolean> => {
    return new Promise((resolve) => {
      let count = 0;
      const interval = setInterval(() => {
        const fetchCount = this.getPendingCacheCount?.(search) ?? 0;

        if (fetchCount === 0) {
          clearInterval(interval);
          resolve(true);
        } else {
          count += 1;
          if (count > Math.floor(refreshTimeout / refreshInterval)) {
            clearInterval(interval);
            resolve(false);
          }
        }
      }, refreshInterval);
    });
  };

  private handleRefreshEntity = async (entityId: string, promiseId: string): Promise<void> => {
    this.invalidateCache?.('entity', entityId);

    const result = await this.waitForIdleState(entityId);

    this.postMessage(RESPONSES.REFRESH_ENTITY_RESPONSE, {
      id: promiseId,
      data: {
        success: result,
      },
    });
  };

  private handleFormPostRequest = (
    id: string,
    url: string,
    payload: UnknownJSON,
    createNewTab?: boolean,
  ): void => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    if (createNewTab) {
      form.target = '_blank';
    }

    for (const key in payload) {
      const field = document.createElement('input');
      field.type = 'hidden';
      field.name = key;
      field.value = payload[key] as string;
      form.appendChild(field);
    }

    document.body.appendChild(form);

    form.submit();

    if (createNewTab) {
      document.body.removeChild(form);
    }

    this.postMessage(RESPONSES.POSTFORMDATA_RESPONSE, { success: true, id });
  };

  private handleUploadFileRequest = async (
    id: string,
    payload: UploadFilePayload,
  ): Promise<void> => {
    if (!this.performFileUpload) {
      this.postMessage(RESPONSES.UPLOADFILE_RESPONSE, { error: 'File upload not supported', id });

      return;
    }

    const { file: encodedFile, isPublic = false, fileName } = payload;

    const decodedFile = await fetch(encodedFile);
    const fileBlob = await decodedFile.blob();

    const file = new File([fileBlob], fileName ?? `upload-${new Date().toISOString()}`, {
      type: fileBlob.type,
    }) as KizenFile;

    file.$id = this.createFileId?.() ?? generateUUIDV4();

    const result = await this.performFileUpload({
      file,
      id: file.$id,
      publicFile: isPublic,
      source: 'field_value',
      handleProgress: (p) => {
        this.postMessage(RESPONSES.UPLOADFILE_PROGRESS, {
          fileId: p.id,
          progress: p.progress,
        });
      },
      businessId: undefined,
    });

    this.postMessage(RESPONSES.UPLOADFILE_RESPONSE, { data: result, id });
  };

  private waitForReadyState = (
    predicate?: () => boolean,
    cb?: (matched: boolean) => void,
    iterations = 0,
  ): void => {
    if (!predicate) {
      cb?.(true);
    }

    if (predicate?.()) {
      cb?.(true);
    } else if (iterations < 20) {
      setTimeout(() => {
        this.waitForReadyState(predicate, cb, iterations + 1);
      }, iterations * 50);
    } else {
      cb?.(false);
    }
  };

  private handleCallThirdPartyScript = (
    scriptType?: (typeof ALLOWED_INTEGRATIONS)[keyof typeof ALLOWED_INTEGRATIONS],
    args: unknown[] = [],
  ): void => {
    if (scriptType && thirdPartyGlobalNames[scriptType]) {
      const globalName = thirdPartyGlobalNames[scriptType];
      const fn = (window as unknown as Record<string, unknown>)[globalName] as
        | ((...args: unknown[]) => void)
        | undefined;

      fn?.(...args);
    }
  };

  private handleReleaseBlockingScript = (): void => {
    return this.onReleaseBlockingScript?.(this.executionPlugin);
  };

  private handlePromptRequest = (id: string, config: ModalConfig, dynamic = false): void => {
    if (this.onShowModal) {
      this.onShowModal(
        {
          ...config,
          pluginApiName: this.pluginApiName ?? '',
          dynamic,
        },
        (result = {}) => {
          this.postMessage(RESPONSES.PROMPT_RESPONSE, {
            id,
            data: result,
          });
        },
      );
    } else {
      this.postMessage(RESPONSES.PROMPT_RESPONSE, {
        id,
        data: { canceled: true },
      });
    }
  };

  private handleShowViewInModalRequest = (
    id: string,
    viewId: string,
    args?: UnknownJSON,
    options?: ShowViewInModalOptions,
  ): void => {
    if (this.onShowModal) {
      this.onShowModal(
        {
          viewId,
          ...(args !== undefined && { args }),
          pluginApiName: this.pluginApiName ?? '',
          ...(options?.frameless
            ? { frameless: true }
            : {
                ...(options?.title !== undefined && { title: options.title }),
                ...(options?.confirmButton !== undefined && {
                  confirmButton: options.confirmButton,
                }),
                ...(options?.cancelButton !== undefined && { cancelButton: options.cancelButton }),
              }),
        },
        (result = {}) => {
          this.postMessage(RESPONSES.PROMPT_RESPONSE, {
            id,
            data: result,
          });
        },
      );
    } else {
      this.postMessage(RESPONSES.PROMPT_RESPONSE, {
        id,
        data: { canceled: true },
      });
    }
  };

  private handleInstallThirdPartyScriptRequest = (
    id: string,
    url: string,
    args: UnknownJSON = {},
  ): void => {
    const type = getScriptIntegrationType(url);

    if (!type) {
      this.postMessage(RESPONSES.INSTALL_THIRD_PARTY_SCRIPT_RESPONSE, {
        data: { success: false, url },
        id,
      });
      return;
    }

    const setupFn = thirdPartySetupScripts[type];

    setupFn(args);

    const script = document.createElement('script');
    script.onload = () => {
      this.waitForReadyState(thirdPartyReadyPredicates[type], (matched: boolean) => {
        this.postMessage(RESPONSES.INSTALL_THIRD_PARTY_SCRIPT_RESPONSE, {
          data: { success: true, url, matched },
          id,
        });
      });
    };
    script.onerror = () => {
      this.postMessage(RESPONSES.INSTALL_THIRD_PARTY_SCRIPT_RESPONSE, {
        data: { success: false, url },
        id,
      });
    };

    script.src = url;
    script.setAttribute('data-script-url', url);

    const exists = document.querySelectorAll('[data-script-url="' + url + '"]').length > 0;

    if (!exists) {
      document.documentElement.firstChild?.appendChild(script);
    } else {
      this.waitForReadyState(thirdPartyReadyPredicates[type], (matched: boolean) => {
        this.postMessage(RESPONSES.INSTALL_THIRD_PARTY_SCRIPT_RESPONSE, {
          data: { success: true, url, reused: true, matched },
          id,
        });
      });
    }
  };

  private handleOpenWindow = (url: string, target: string, features: string): void => {
    if (!isRelative(url) || target === '_blank' || !this.pushHistory) {
      window.open(url, target, features);
    } else {
      this.pushHistory(url);
    }
  };

  private handleAuthorize = (
    serviceName: string,
    config: { successRedirectPath?: string; errorRedirectPath?: string } = {},
  ): void => {
    const params = new URLSearchParams();
    if (config.successRedirectPath) {
      params.append('success_redirect_path', config.successRedirectPath);
    }
    if (config.errorRedirectPath) {
      params.append('error_redirect_path', config.errorRedirectPath);
    }

    if (!this.appPath) {
      this.onError?.({
        message: 'App path is not defined.',
      });
      return;
    }

    if (!this.pluginApiName) {
      this.onError?.({
        message: 'Plugin API name is not defined.',
      });
      return;
    }

    const paramString = params.toString();

    this.handleOpenWindow(
      `${this.appPath}/external-integrations/business-plugin-apps/${this.pluginApiName}/services/${encodeURIComponent(
        serviceName,
      )}/authorize${paramString ? `?${paramString}` : ''}`,
      '_blank',
      '',
    );
  };

  public run = (scriptBody: string, setup: WorkerSetup, args?: string): void => {
    const location = getPartialLocation();

    this.postMessage(ACTIONS.RUN, {
      script: scriptBody,
      setup,
      args,
      sessionData: this.sessionData,
      pluginComponentId: this.pluginComponentId,
      pluginApiName: this.pluginApiName,
      location,
    });
  };
}
