import type {
  InternalSessionData,
  SetInternalSessionDataFn,
  ShowToastOptions,
  StateChangePayload,
  WorkerContextArgs,
} from './contexts.js';
import type {
  OnCloseModalFn,
  OnShowCreateRecordModalFn,
  OnShowCreateRelatedRecordModalFn,
  OnShowModalFn,
  ModalConfig,
  ShowViewInModalOptions,
} from './modals.js';
import type { HideConfig, ShowConfig } from './floatingFrames.js';
import type { OnNetworkErrorFn } from './request.js';
import type { UnknownJSON } from './common.js';
import type { ACTIONS } from '../communication/constants.js';
import type { ALLOWED_INTEGRATIONS } from '../communication/ThirdPartyScript.js';

export interface CommonPluginDefinition {
  plugin_api_name: string;
  api_name: string;
  id?: string;
  script_id?: string;
}

export interface CommonExecutionPlugin {
  id: string;
  script_id?: string;
  api_name: string;
  field_type?: string;
  plugin_api_name?: string;
}

export type OnShowToastFn = (options: { message: string } & ShowToastOptions) => void;

export type OnClearToastsFn = () => void;

type TerminatorFn = () => void;

export type TerminatorContent = Record<string, TerminatorFn[] | undefined>;

export interface Terminators {
  current: TerminatorContent;
}

export interface RunScriptOptions {
  setLoadingState: (loading: boolean) => void;
  workerName: 'recordDetail' | 'genericPlugin' | 'floatingFramePlugin' | 'calendarSource';
  context?: Record<string, unknown>;
  plugin?: CommonPluginDefinition | undefined;
  executionPlugin?: CommonExecutionPlugin | undefined;
  onShowToast?: OnShowToastFn;
  onClearToasts?: OnClearToastsFn;
  terminators: Terminators;
  sessionData: InternalSessionData;
  setSessionData: SetInternalSessionDataFn;
  onShowModal: OnShowModalFn;
  onShowCreateRecordModal: OnShowCreateRecordModalFn;
  onShowCreateRelatedRecordModal: OnShowCreateRelatedRecordModalFn;
  onCloseModal?: OnCloseModalFn;
  onNetworkError?: OnNetworkErrorFn;
  scriptBody: WorkerContextArgs['scriptBody'];
  user: WorkerContextArgs['user'];
  teamMember: WorkerContextArgs['teamMember'];
  business: WorkerContextArgs['business'];
  onError?: WorkerContextArgs['onError'];
  onReleaseBlockingScript?: WorkerContextArgs['onReleaseBlockingScript'];
  clientObject: WorkerContextArgs['clientObject'];
  scriptUIRef?: WorkerContextArgs['scriptUIRef'];
  onStateChange: WorkerContextArgs['onStateChange'];
  args?: string;
  appPath: WorkerContextArgs['appPath'];
  pushHistory?: (url: string) => void;
  onNetworkRequest?: OnNetworkRequestFn;
  createFileId?: CreateFileIdFn | undefined;
  performFileUpload?: PerformKizenFileUploadFn | undefined;
  getPendingCacheCount?: GetPendingCacheCountFn | undefined;
  invalidateCache?: InvalidateCacheFn | undefined;
  onConsoleLog?: OnConsoleLogFn;
}

export type RequestableQueryMethods = 'get' | 'post' | 'patch' | 'delete';

export type OnNetworkRequestFn = (
  method: RequestableQueryMethods,
  url: string,
  payload?: UnknownJSON,
  options?: UnknownJSON,
) => Promise<{ data: UnknownJSON } | undefined>;

export interface BaseEvent {
  action: (typeof ACTIONS)[keyof typeof ACTIONS];
}

export interface QueryRequestEvent extends BaseEvent {
  id: string;
  method: RequestableQueryMethods;
  url: string;
  payload?: UnknownJSON;
  options?: UnknownJSON;
}

export interface UIOutputEvent extends BaseEvent {
  markup: string;
}

export interface IframeOutputEvent extends BaseEvent {
  url: string;
  allow?: string[];
  sandbox?: string[];
  preserve?: boolean;
}

export interface PostFormDataRequestEvent extends BaseEvent {
  id: string;
  url: string;
  payload: UnknownJSON;
  createNewTab?: boolean;
}

export interface UploadFilePayload {
  isPublic?: boolean;
  fileName?: string;
  file: URL;
}

export interface UploadFileRequestEvent extends BaseEvent {
  id: string;
  payload: UploadFilePayload;
}

export interface SetStateEvent extends BaseEvent {
  state: StateChangePayload;
}

export interface DoneEvent extends BaseEvent {
  preserve: boolean;
  result?: unknown;
}

export interface ErrorEvent extends BaseEvent {
  error: UnknownJSON;
}

export interface OpenWindowEvent extends BaseEvent {
  url: string;
  target: string;
  features: string;
}

export interface RecipientConfig {
  frame?: string;
  script?: string;
  type?: (typeof ALLOWED_INTEGRATIONS)[keyof typeof ALLOWED_INTEGRATIONS];
}

export interface CommunicateEvent extends BaseEvent {
  type: string;
  recipient: RecipientConfig;
  args?: Record<string, unknown>;
  params?: unknown[];
}

export interface HideEvent extends BaseEvent {
  config: HideConfig;
}

export interface ShowEvent extends BaseEvent {
  config: ShowConfig;
}

export interface CopyToClipboardEvent extends BaseEvent {
  text: string;
}

export interface OpenCreateRecordModalRequestEvent extends BaseEvent {
  id: string;
  entityId: string;
}

export interface OpenCreateRelatedRecordModalRequestEvent extends BaseEvent {
  id: string;
  objectId: string;
  relatedEntityId: string;
}

export interface ShowToastEvent extends BaseEvent {
  message: string;
  toastOptions?: ShowToastOptions;
}

export interface RefreshTimelineEvent extends BaseEvent {
  entityId: string;
}

export interface RefreshEntityEvent extends BaseEvent {
  entityId: string;
  id: string;
}

export interface UpdateSessionDataEvent extends BaseEvent {
  update: InternalSessionData;
}

export interface InstallThirdPartyScriptRequestEvent extends BaseEvent {
  id: string;
  url: string;
  args?: UnknownJSON;
}

export interface PromptRequestEvent extends BaseEvent {
  id: string;
  config: ModalConfig;
}

export interface DynamicPromptRequestEvent extends BaseEvent {
  id: string;
  config: ModalConfig;
}

export interface AuthorizeEvent extends BaseEvent {
  serviceName: string;
  config?: {
    successRedirectPath?: string;
    errorRedirectPath?: string;
  };
}

export interface ShowViewInModalRequestEvent extends BaseEvent {
  id: string;
  viewId: string;
  args?: UnknownJSON;
  options?: ShowViewInModalOptions;
}

export interface CloseModalRequestEvent extends BaseEvent {
  values?: UnknownJSON;
  canceled?: boolean;
}

export type ConsoleLogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

export interface ConsoleLogEvent extends BaseEvent {
  level: ConsoleLogLevel;
  args: unknown[];
}

export type OnConsoleLogFn = (level: ConsoleLogLevel, args: unknown[]) => void;

export type MessageEventData =
  | QueryRequestEvent
  | UIOutputEvent
  | IframeOutputEvent
  | PostFormDataRequestEvent
  | UploadFileRequestEvent
  | SetStateEvent
  | DoneEvent
  | ErrorEvent
  | OpenWindowEvent
  | CommunicateEvent
  | HideEvent
  | ShowEvent
  | CopyToClipboardEvent
  | OpenCreateRecordModalRequestEvent
  | OpenCreateRelatedRecordModalRequestEvent
  | ShowToastEvent
  | RefreshTimelineEvent
  | RefreshEntityEvent
  | UpdateSessionDataEvent
  | InstallThirdPartyScriptRequestEvent
  | PromptRequestEvent
  | DynamicPromptRequestEvent
  | ShowViewInModalRequestEvent
  | CloseModalRequestEvent
  | AuthorizeEvent
  | ConsoleLogEvent;

export type InvalidateCacheFn = (category: 'timeline' | 'entity', entityId: string) => void;

export type GetPendingCacheCountFn = (search: string) => number;

export interface KizenFile extends File {
  $id: string;
}

export type CreateFileIdFn = () => string;

export type PerformKizenFileUploadFn = (args: {
  file: KizenFile;
  id: string;
  publicFile: boolean;
  source: 'field_value';
  handleProgress: (progress: { id: string; progress: number }) => void;
  businessId: undefined;
}) => Promise<UnknownJSON>;
