export interface PartialUser {
  id: string;
  crm_client_id: string;
}

export interface PartialTeamMember {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created: string;
}

export type Profile = PartialTeamMember & PartialUser;

export interface CurrentUser {
  profile: Profile;
}

export interface PartialBusiness {
  id: string;
}

export interface PartialRelatedObject {
  field_id: string;
  related_object: string;
}

export interface PartialCustomObject {
  object_type: 'pipeline' | 'standard';
  fetch_url: string;
  related_objects?: PartialRelatedObject[];
}

export interface PartialEntity {
  fields?: Record<
    string,
    {
      id: string;
      value: { id?: string }[];
    }
  >;
}

export interface PartialClientObject {
  id: string;
  objectName: string;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface PartialLocation {
  host: string;
  hash: string;
  href: string;
  origin: string;
  pathname: string;
  search: string;
  port: string;
  protocol: string;
}

export type ErrorHandler = (error: unknown) => void;

export type ReleaseBlockingScriptHandler = (executionPlugin?: unknown) => void;

export type JSONPrimitive = string | number | boolean | null;

export type JSONValue = JSONPrimitive | JSONArray | JSONObject;

export type JSONArray = JSONValue[];

export interface JSONObject {
  [key: string]: JSONValue | undefined;
}

export type UnknownJSON = JSONObject;

export interface AppPlugin {
  business_config: unknown;
  name: string;
  employee_config: unknown;
}

export type AppPlugins = Record<string, AppPlugin>;

export type MaybeMessageError = { message?: string } | undefined;

export type EmployeeConfig<T = unknown> = Record<string, T>;
