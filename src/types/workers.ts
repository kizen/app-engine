import type {
  PartialBusiness,
  PartialClientObject,
  PartialLocation,
  PartialTeamMember,
  PartialUser,
  UnknownJSON,
} from './common.js';

export interface ExpressionPayload {
  expression: string;
  args: Record<string, UnknownJSON>;
  isDebug?: boolean;
}

export interface WorkerSetup {
  user: PartialUser;
  teamMember: PartialTeamMember;
  business: PartialBusiness;
  entityId?: string;
  objectId?: string;
  actionEntityId?: string;
  actionObjectId?: string;
  clientObject?: PartialClientObject | undefined;
  appPath: string;
  isDebug: boolean;
}

export interface WorkerEvent {
  action: string;
  script?: string;
  setup?: WorkerSetup;
  args?: string;
  sessionData?: Record<string, UnknownJSON>;
  pluginComponentId: string;
  pluginApiName: string;
  location: PartialLocation;
}

export type FunctionWithReturn = (...args: unknown[]) => Promise<unknown>;

export interface BuiltAsyncFn {
  fn: FunctionWithReturn;
  functionBody: string;
}

export interface AsyncFunctionConstructor {
  new (...args: string[]): FunctionWithReturn;
  (...args: string[]): FunctionWithReturn;
}

export interface QueryResponsePayload {
  id: string;
  data: UnknownJSON;
  error?: unknown;
}

export interface PostFormDataResponsePayload {
  id: string;
  success: boolean;
}

export interface UploadFileResponsePayload {
  id: string;
  data: unknown;
  error?: string;
}

export interface InstallThirdPartyScriptResponsePayload {
  id: string;
  data: { success: boolean };
}

export interface PromptResponsePayload {
  id: string;
  data: unknown;
}

export interface RefreshEntityResponsePayload {
  id: string;
  data: { success: boolean };
}

export interface CreateRecordResponsePayload {
  id: string;
  data: unknown;
}

export interface CreateRelatedRecordResponsePayload {
  id: string;
  data: unknown;
}
