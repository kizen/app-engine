import type { RefObject } from 'react';
import type {
  ErrorHandler,
  PartialBusiness,
  PartialClientObject,
  PartialLocation,
  PartialTeamMember,
  PartialUser,
  ReleaseBlockingScriptHandler,
  UnknownJSON,
} from './common.js';
import type { CloseModalFn, DynamicPromptFn, ModalConfig, ShowViewInModalFn } from './modals.js';
import type {
  DeleteReturnValue,
  GetReturnValue,
  KizenRequestFn,
  KizenRequestFnHandler,
  PatchReturnValue,
  PostReturnValue,
  PutReturnValue,
} from './request.js';
import type { WorkerPromise } from '../workers/WorkerPromise.js';
import type { INDICATOR_TYPE } from '../communication/constants.js';

export interface ErrorResponse {
  status: number;
  statusText: string;
  body?: unknown;
}

export interface DataCacheEntry<T> {
  ts: number;
  data: T;
}

export type DataCache<T> = Map<string, DataCacheEntry<T>>;

export interface BaseAPI {
  get: KizenRequestFnHandler<GetReturnValue>;
  post: KizenRequestFnHandler<PostReturnValue>;
  put: KizenRequestFnHandler<PutReturnValue>;
  delete: KizenRequestFnHandler<DeleteReturnValue>;
  patch: KizenRequestFnHandler<PatchReturnValue>;
}

export type PostFormDataPayload = Record<string, unknown>;

export type PostFormDataFn = (
  url: string,
  data: PostFormDataPayload,
  createNewTab?: boolean,
) => Promise<unknown>;

export type CurriedPostFormDataFn = (instance: Instance, promises: WorkerPromise) => PostFormDataFn;

export interface StateChangePayload {
  indicator?: INDICATOR_TYPE;
  hidden?: boolean;
  minimized?: boolean;
  triggerHidden?: boolean;
  hideHeader?: boolean;
  createObjectRecordId?: string;
}

export type Instance = Window & typeof globalThis;

export interface UploadFileData {
  file: string;
  isPublic?: boolean;
  fileName?: string;
}

export type UploadFileFn = (data: UploadFileData) => Promise<unknown>;

export type CurriedUploadFileFn = (instance: Instance, promises: WorkerPromise) => UploadFileFn;

export type InternalSessionData = Record<string, unknown>;

export type SetInternalSessionDataFn = (pluginId: string, state: InternalSessionData) => void;

export type InstallThirdPartyScriptFn = (
  url: string,
  args: Record<string, unknown>,
) => Promise<{
  url: string;
}>;

export type CurriedInstallThirdPartyScriptFn = (
  instance: Instance,
  promises: WorkerPromise,
) => InstallThirdPartyScriptFn;

export type CompleteSetupLevel = 'business' | 'user';

export interface CompleteSetupOptions {
  level?: CompleteSetupLevel | undefined;
}

export type CompleteSetupFn = (
  payload: UnknownJSON,
  options?: CompleteSetupOptions,
) => Promise<unknown>;

export type CurriedCompleteSetupFn = (
  instance: Instance,
  promises: WorkerPromise,
) => CompleteSetupFn;

export type PromptFn = (config: ModalConfig) => Promise<unknown>;

export type CurriedPromptFn = (instance: Instance, promises: WorkerPromise) => PromptFn;

export type RefreshEntityFn = (entityId: string) => Promise<unknown>;

export type CurriedRefreshEntityFn = (
  instance: Instance,
  promises: WorkerPromise,
) => RefreshEntityFn;

export type OpenCreateRecordFn = (objectId: string) => Promise<unknown>;

export type CurriedOpenCreateRecordFn = (
  instance: Instance,
  promises: WorkerPromise,
) => OpenCreateRecordFn;

export type OpenCreateRelatedRecordFn = (
  objectId: string,
  relatedEntityId: string,
) => Promise<unknown>;

export type CurriedOpenCreateRelatedRecordFn = (
  instance: Instance,
  promises: WorkerPromise,
) => OpenCreateRelatedRecordFn;

export interface WorkerContextArgs {
  user: PartialUser;
  teamMember: PartialTeamMember;
  business: PartialBusiness;
  clientObject?: PartialClientObject | undefined;
  appPath: string;
  onStateChange?: (options: StateChangePayload) => void;
  scriptUIRef?: RefObject<HTMLDivElement | null>;
  isDebug?: boolean;
  scriptBody: string;
  functionBody: string;
  instance: Instance;
  kizenRequest: KizenRequestFn;
  postFormData: PostFormDataFn;
  onError?: ErrorHandler;
  onReleaseBlockingScript?: ReleaseBlockingScriptHandler;
  args?: string;
  uploadFile: UploadFileFn;
  sessionData?: InternalSessionData;
  pluginComponentId?: string;
  installThirdPartyScript: InstallThirdPartyScriptFn;
  prompt: PromptFn;
  dynamicPrompt: DynamicPromptFn;
  refreshEntity: RefreshEntityFn;
  openCreateRecord: OpenCreateRecordFn;
  openCreateRelatedRecord: OpenCreateRelatedRecordFn;
  pluginApiName: string;
  location: PartialLocation;
  showViewInModal: ShowViewInModalFn;
  closeModal: CloseModalFn;
  completeSetup: CompleteSetupFn;
}

export type KizenConfig = Record<string, unknown>;

export interface KnownArgs {
  __kizen_clean_config?: KizenConfig;
  __kizen_user_config?: {
    __kizen_clean_config?: KizenConfig;
  };
  pluginId?: string;
}

export interface UserConfig {
  config?: Record<string, UnknownJSON>;
}

export type Args = KnownArgs & Record<string, unknown>;

export interface ShowToastOptions {
  variant?: 'alert' | 'failure' | 'success';
  autohide?: boolean;
}
