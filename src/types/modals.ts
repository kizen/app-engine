import type { WorkerPromise } from '../workers/WorkerPromise.js';
import type { SelectOption, UnknownJSON } from './common.js';
import type { Instance } from './contexts.js';

export interface ButtonConfig {
  label: string;
  variant?: 'text' | 'standard';
  color?: string;
}

interface ModalDescription {
  type: 'description';
  content: string;
  widthPercent: 50 | 100;
  when?: string | undefined;
  key: string;
}

interface ModalTextInput {
  type: 'text';
  label: string;
  placeholder: string;
  widthPercent: 50 | 100;
  id: string;
  defaultValue?: string;
  when?: string | undefined;
  key: string;
}

interface ModalSpacer {
  type: 'spacer';
  height: number;
  widthPercent: 50 | 100;
  when?: string | undefined;
  key: string;
}

interface ModalDropdown {
  type: 'dropdown';
  label: string;
  placeholder: string;
  widthPercent: 50 | 100;
  id: string;
  multiselect?: boolean;
  options: SelectOption[];
  defaultValue?: string;
  optionMapper?: UnknownFunction;
  getFetchUrl?: UnknownFunction;
  getHeaders?: UnknownFunction;
  getBody?: UnknownFunction;
  args?: UnknownJSON;
  when?: string | undefined;
  key: string;
}

export interface ModalContainer {
  type: 'container';
  fields: ModalBlock[];
  when?: string | undefined;
  key: string;
}

export type ModalBlock =
  | ModalDescription
  | ModalTextInput
  | ModalSpacer
  | ModalDropdown
  | ModalContainer;

export interface ModalConfig {
  title?: string;
  confirmButton?: ButtonConfig;
  cancelButton?: ButtonConfig;
  content?: ModalBlock[];
  dynamic?: boolean;
  pluginApiName?: string;
}

export interface DynamicPromptConfig {
  title?: string;
  confirmButton?: ButtonConfig;
  cancelButton?: ButtonConfig;
  content?: ModalBlock[];
  registerUtils?: Record<string, (...args: unknown[]) => unknown>;
}

export type PromptState = Record<string, unknown>;

export type DynamicPromptFn = (config: DynamicPromptConfig) => Promise<{
  values: Record<string, ValueStore>;
}>;

export type CurriedDynamicPromptFn = (
  instance: Instance,
  promises: WorkerPromise,
) => DynamicPromptFn;

export type UnknownFunction = (...args: unknown[]) => unknown;

export type SetupAssistantField = ModalBlock | AssistantField;

export type MatchSetupAssistantField = AssistantField & {
  match_hint?: string;
};

export interface SetupAssistantConfig {
  fields?: SetupAssistantField[] | undefined;
  actions?: AssistantConfigAction[] | undefined;
  services?: ConfigService[] | undefined;
}

export interface AssistantConfigAction {
  api_name: string;
  name: string;
  hint_object_name?: string;
}

export interface AssistantLink {
  href: string;
  text: string;
}

export interface AssistantField {
  key: string;
  type:
    | 'custom_object'
    | 'description'
    | 'container'
    | 'field'
    | 'text'
    | 'number'
    | 'select'
    | 'boolean'
    | 'qr'
    | 'image'
    | 'link';
  columns?: number;
  fields?: AssistantField[];
  content?: string;
  label?: string;
  object_id?: string;
  default?: string;
  options?: SelectOption[];
  allow_multiple?: boolean;
  placeholder?: string;
  when?: string;
  getFetchUrl?: string;
  typeahead?: boolean;
  optionMapper?: string;
  fetchMethod?: 'GET' | 'POST';
  getHeaders?: string;
  getBody?: string;
  getContextUrl?: string;
  autoSelect?: boolean;
  required?: boolean;
  tooltip?: string;
  dependencies?: string[];
  validation_pattern?: string;
  match_hint?: string;
  src?: string;
  link?: AssistantLink;
  title?: string;
  width?: number;
  height?: number;
  href?: string;
  text?: string;
  size?: number;
  value?: string;
}

export type BooleanCleanValue = boolean;

export interface BooleanValueStore {
  value: boolean;
}

export interface CustomObjectCleanValue {
  objectId: string;
  objectName: string;
}

export interface CustomObjectValueStore {
  value?: {
    id: string;
    objectName: string;
  };
}

interface FieldCleanValueSingle {
  fieldId: string;
  fieldName: string;
  objectId?: string;
  objectName?: string;
}

export type FieldCleanValue = FieldCleanValueSingle | FieldCleanValueSingle[];

export interface FieldValueStore {
  value: SelectOption | SelectOption[];
  associatedObject?: {
    id: string;
    name: string;
  };
}

export type NumberCleanValue = number;

export interface NumberValueStore {
  value: number | string;
}

export type SelectCleanValue = SelectOption | SelectOption[];

export interface SelectValueStore {
  value: SelectOption | SelectOption[];
}

type TextCleanValue = string;

export interface TextValueStore {
  value: string;
}

export type ValueStore =
  | BooleanValueStore
  | CustomObjectValueStore
  | FieldValueStore
  | NumberValueStore
  | SelectValueStore
  | TextValueStore;

export type CleanValueStoreType =
  | BooleanCleanValue
  | CustomObjectCleanValue
  | FieldCleanValue
  | NumberCleanValue
  | SelectCleanValue
  | TextCleanValue;

export type CleanValueStore = Record<string, CleanValueStoreType>;

export type OnShowModalFn = (config: ModalConfig, cb: () => void) => void;

export type OnShowCreateRecordModalFn = (
  objectId: string,
  cb: (result: UnknownJSON) => void,
) => void;

export type OnShowCreateRelatedRecordModalFn = (
  objectId: string,
  relatedEntityId: string,
  cb: (result: UnknownJSON) => void,
) => void;

export type ModalQueue = { config: ModalConfig; cb: (...args: unknown[]) => void }[];
export type CreateRecordModalQueue = { objectId: string; cb: (result: UnknownJSON) => void }[];
export type CreateRelatedRecordModalQueue = {
  objectId: string;
  relatedEntityId: string;
  cb: (result: UnknownJSON) => void;
}[];

export type ModalCancelEventSource = 'button' | 'close';

export interface ConfigService {
  api_name: string;
  prerequisite: boolean;
  required: boolean;
}
