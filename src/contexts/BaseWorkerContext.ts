/* eslint-disable @typescript-eslint/only-throw-error */
import { Communicate } from '../communication/Communicate.js';
import { ACTIONS, INDICATOR_TYPE, RESPONSES } from '../communication/constants.js';
import { ThirdPartyScript } from '../communication/ThirdPartyScript.js';
import type {
  CurrentUser,
  PartialBusiness,
  PartialClientObject,
  PartialLocation,
  PartialTeamMember,
  PartialUser,
  UnknownJSON,
} from '../types/common.js';
import type {
  Args,
  BaseAPI,
  DataCache,
  ErrorResponse,
  InstallThirdPartyScriptFn,
  Instance,
  InternalSessionData,
  OpenCreateRecordFn,
  OpenCreateRelatedRecordFn,
  PostFormDataFn,
  PromptFn,
  RefreshEntityFn,
  ShowToastOptions,
  StateChangePayload,
  UploadFileFn,
  UserConfig,
  WorkerContextArgs,
} from '../types/contexts.js';
import type {
  DynamicPromptConfig,
  DynamicPromptFn,
  ModalConfig,
  PromptState,
  UnknownFunction,
} from '../types/modals.js';
import type {
  GetOptions,
  GetReturnValue,
  RequestOptions,
  RequestWithErrorsResponse,
} from '../types/request.js';
import { cleanConfig } from '../workers/util.js';

const buildErrorResponse = async (result: Response): Promise<ErrorResponse> => {
  let errorJSON: unknown = null;

  try {
    errorJSON = await result.json();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_e) {
    // If the response is not JSON, we just return the text
  }

  const error = {
    status: result.status,
    statusText: result.statusText,
    body: errorJSON,
  };

  return error;
};

const convertToSelfInvokingFunction = (
  fn: UnknownFunction,
  variable: string,
  args: UnknownJSON = {},
  prepend = '',
): string => {
  const functionString = fn.toString();
  // Create a self-invoking function that takes in the replacement variable, and additional args as the arguments
  const innner = `(${functionString})({ state: {{${variable}}}, args: ${JSON.stringify(args)}, utils: __kizen_utils })`;

  // Wrap the function in a closure that includes any prepended code (like registered utils) and returns the result of the function
  const full = `(function() { ${prepend}\nreturn ${innner}; })()`;

  return full;
};

/*
 * This is the primary class that exposes the public methods available
 * to our custom scripts. It should only be used in the context of a worker
 * script.
 */
export class BaseWorkerContext {
  protected user?: PartialUser;
  protected teamMember?: PartialTeamMember;
  protected business?: PartialBusiness;
  protected clientObject?: PartialClientObject;
  protected appPath?: string;
  protected dataCache: DataCache<unknown> = new Map();
  protected queryOptions = {};
  private api: BaseAPI;
  public postFormData: PostFormDataFn;
  private executionTimer = 0;
  private setupExecutions = 0;
  private cleanupExecutions = 0;
  protected isDebug = false;
  protected scriptBody: string;
  protected internalState: StateChangePayload = { indicator: INDICATOR_TYPE.NONE };
  public console = console;
  protected instance: Instance;
  private breakOnException = false;
  public args: Args;
  public communicate: Communicate;
  private shouldPreserve = false;
  private uploadFileHandler: UploadFileFn;
  private internalSessionData: InternalSessionData;
  private pluginComponentId: string | undefined;
  private installThirdPartyScriptHandler: InstallThirdPartyScriptFn;
  private promptHandler: PromptFn;
  private dynamicPromptHandler: DynamicPromptFn;
  private refreshEntityHandler: RefreshEntityFn;
  private openCreateRecordHandler: OpenCreateRecordFn;
  private openCreateRelatedRecordHandler: OpenCreateRelatedRecordFn;
  protected runnerType: 'base' | 'floatingFrame' | 'recordDetail';
  public pluginApiName: string;
  public tempPromptState: PromptState = {};
  private partialLocation: PartialLocation;

  constructor({
    user,
    teamMember,
    business,
    clientObject,
    appPath,
    isDebug,
    kizenRequest,
    postFormData,
    scriptBody,
    instance,
    args,
    uploadFile,
    sessionData,
    pluginComponentId,
    installThirdPartyScript,
    prompt,
    refreshEntity,
    openCreateRecord,
    openCreateRelatedRecord,
    pluginApiName,
    dynamicPrompt,
    location,
  }: WorkerContextArgs) {
    this.user = user;
    this.teamMember = teamMember;
    this.business = business;
    this.clientObject = clientObject;
    this.partialLocation = location;
    this.appPath = appPath;
    this.isDebug = isDebug ?? false;
    this.api = {
      get: kizenRequest('get'),
      post: kizenRequest('post'),
      put: kizenRequest('put'),
      delete: kizenRequest('delete'),
      patch: kizenRequest('patch'),
    };

    this.postFormData = postFormData;
    this.scriptBody = scriptBody;
    this.instance = instance;
    this.communicate = new Communicate(instance);
    this.uploadFileHandler = uploadFile;
    this.internalSessionData = sessionData ?? {};
    this.pluginComponentId = pluginComponentId;
    this.installThirdPartyScriptHandler = installThirdPartyScript;
    this.promptHandler = prompt;
    this.refreshEntityHandler = refreshEntity;
    this.openCreateRecordHandler = openCreateRecord;
    this.openCreateRelatedRecordHandler = openCreateRelatedRecord;
    this.runnerType = 'base';
    this.pluginApiName = pluginApiName;
    this.dynamicPromptHandler = dynamicPrompt;

    try {
      this.args = JSON.parse(args ?? '{}') as Args;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {
      this.args = {} as Args;
    }
  }

  public onError(error?: UnknownJSON | Error): void {
    if (this.breakOnException) {
      debugger;
    }

    this.instance.postMessage(
      JSON.stringify({
        action: RESPONSES.ERROR,
        error: error?.message,
      }),
    );
  }

  set debug(value: boolean) {
    this.isDebug = value;
    this.breakOnException = value;
  }

  set preserve(value: boolean) {
    this.shouldPreserve = value;
  }

  get preserve(): boolean {
    return this.shouldPreserve;
  }

  parseDate(date: string): string[] {
    return date.split('-');
  }

  parsePhone(phone: string): string {
    return phone.replace(/\+/g, '');
  }

  openWindow(url: string, target = '_blank'): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.OPEN_WINDOW,
        url,
        target,
        features: 'noopener noreferrer',
      }),
    );
  }

  authorize(
    serviceName?: string,
    config: { successRedirectPath?: string; errorRedirectPath?: string } = {},
  ): void {
    if (!serviceName) {
      throw new Error('Service name is required to authorize');
    }

    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.AUTHORIZE,
        serviceName,
        config: {
          successRedirectPath:
            config.successRedirectPath ?? `/marketplace/${this.pluginApiName}/auth`,
          errorRedirectPath: config.errorRedirectPath ?? `/marketplace/${this.pluginApiName}/auth`,
        },
      }),
    );
  }

  getServiceUrl(serviceName: string, path: string): string {
    if (!serviceName) {
      throw new Error('Service name is required to get a service url');
    }

    const base = `/external-integrations/proxy/${this.pluginApiName}/${serviceName}`;

    if (path.startsWith('/')) {
      return `${base}${path}`;
    }

    return `${base}/${path}`;
  }

  get currentBusiness(): PartialBusiness | undefined {
    return this.business;
  }

  get applicationPath(): string | undefined {
    return this.appPath;
  }

  get currentUser(): CurrentUser {
    return {
      profile: {
        id: this.teamMember?.id ?? '',
        full_name: this.teamMember?.full_name ?? '',
        first_name: this.teamMember?.first_name ?? '',
        last_name: this.teamMember?.last_name ?? '',
        email: this.teamMember?.email ?? '',
        phone: this.teamMember?.phone ?? '',
        created: this.teamMember?.created ?? '',
        crm_client_id: this.user?.crm_client_id ?? '',
      },
    };
  }

  get sessionData(): InternalSessionData {
    return this.internalSessionData;
  }

  get config(): unknown {
    const hasCustomConfig = Boolean(this.args.__kizen_clean_config);

    if (!hasCustomConfig) {
      return {};
    }

    const manager = new Proxy(this.args.__kizen_clean_config ?? {}, {
      get: (target, name) => {
        if (Reflect.has(target, name)) {
          return Reflect.get(target, name) as unknown;
        }

        return undefined;
      },
    });

    return manager;
  }

  get location(): PartialLocation {
    return new Proxy(this.partialLocation, {
      get: (target, name) => {
        if (name === 'toJSON') {
          return () => {
            return this.partialLocation;
          };
        }

        if (Reflect.has(target, name)) {
          return Reflect.get(target, name) as string;
        }

        throw new Error(
          `Property ${String(name)} is not available on location object for plugin apps`,
        );
      },
    });
  }

  get userConfig(): unknown {
    const customConfig = this.args.__kizen_user_config?.__kizen_clean_config;

    if (!customConfig) {
      return {};
    }

    const manager = new Proxy(customConfig, {
      get: (target, name) => {
        if (Reflect.has(target, name)) {
          return Reflect.get(target, name) as unknown;
        }

        return undefined;
      },
    });

    return manager;
  }

  setSessionData(update: UnknownJSON): void {
    if (typeof update !== 'object') {
      throw new Error(`Invalid session update with type ${typeof update}`);
    }

    if (Array.isArray(update)) {
      throw new Error(`Invalid session update with type array`);
    }

    this.internalSessionData = {
      ...this.internalSessionData,
      ...update,
    };

    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.UPDATE_SESSION_DATA,
        update,
      }),
    );
  }

  async get(url: string, options?: GetOptions): Promise<unknown> {
    try {
      if (this.isRelativeUrl(url)) {
        const cachedResult = this.dataCache.get(url) as GetReturnValue | undefined;

        if (cachedResult && !options?.ignoreCache) {
          if (options?.returnErrors) {
            return [cachedResult.data, null];
          }

          return cachedResult.data;
        }

        const { data } = await this.api.get(url, {
          ...this.queryOptions,
          headers: this.buildHeaders(options?.headers),
        });

        this.dataCache.set(url, { ts: Date.now(), data });

        if (options?.returnErrors) {
          return [data, null];
        }

        return data;
      } else {
        const res = await fetch(url, {
          method: 'GET',
          headers: new Headers(options?.headers),
          credentials: options?.credentials ?? 'same-origin',
        });

        if (!res.ok) {
          const err = await buildErrorResponse(res);

          throw err;
        }

        const json = (await res.json()) as UnknownJSON;

        if (options?.returnErrors) {
          return [json, null];
        }

        return json;
      }
    } catch (ex) {
      if (options?.returnErrors) {
        return [null, ex];
      } else {
        this.onError(ex as UnknownJSON);
      }
    }
  }

  async getWithErrors(
    url: string,
    options?: Omit<GetOptions, 'returnErrors'>,
  ): Promise<RequestWithErrorsResponse> {
    return this.get(url, {
      ...options,
      returnErrors: true,
    }) as Promise<RequestWithErrorsResponse>;
  }

  async getUserConfig(): Promise<UnknownJSON> {
    if (!this.args.pluginId || !this.pluginComponentId) {
      throw new Error(
        'User config is not available for scripts not associated to a plugin or plugin component',
      );
    }

    const configResult = (await this.get(`/employee/mine/configs/plugins/${this.args.pluginId}`, {
      ignoreCache: true,
    })) as UserConfig;

    return configResult.config?.[this.pluginComponentId] ?? {};
  }

  async setUserConfig(config: UnknownJSON): Promise<unknown> {
    if (!this.args.pluginId || !this.pluginComponentId) {
      throw new Error(
        'User config is not available for scripts not associated to a plugin or plugin component',
      );
    }

    const oldConfig = (await this.get(`/employee/mine/configs/plugins/${this.args.pluginId}`, {
      ignoreCache: true,
    })) as UserConfig | undefined;

    const mutationResult = await this.post(`/employee/mine/configs/plugins/${this.args.pluginId}`, {
      config: {
        ...oldConfig?.config,
        [this.pluginComponentId]: {
          ...oldConfig?.config?.[this.pluginComponentId],
          ...config,
        },
      },
    });

    return mutationResult;
  }

  async patch(url: string, body?: UnknownJSON, options?: RequestOptions): Promise<unknown> {
    try {
      if (this.isRelativeUrl(url)) {
        const { data } = await this.api.patch(url, body, {
          ...this.queryOptions,
          headers: options?.headers,
        });

        if (options?.returnErrors) {
          return [data, null];
        }

        return data;
      } else {
        const res = await fetch(url, {
          method: 'PATCH',
          body: body ? JSON.stringify(body) : null,
          headers: new Headers(options?.headers),
          credentials: options?.credentials ?? 'same-origin',
        });

        if (!res.ok) {
          const err = await buildErrorResponse(res);
          throw err;
        }

        const json = (await res.json()) as UnknownJSON;

        if (options?.returnErrors) {
          return [json, null];
        }

        return json;
      }
    } catch (ex) {
      if (options?.returnErrors) {
        return [null, ex];
      } else {
        this.onError(ex as UnknownJSON);
      }
    }
  }

  async patchWithErrors(
    url: string,
    body: UnknownJSON,
    options?: Omit<RequestOptions, 'returnErrors'>,
  ): Promise<RequestWithErrorsResponse> {
    return this.patch(url, body, {
      ...options,
      returnErrors: true,
    }) as Promise<RequestWithErrorsResponse>;
  }

  async post(url: string, body?: UnknownJSON, options?: RequestOptions): Promise<unknown> {
    try {
      if (this.isRelativeUrl(url)) {
        const { data } = await this.api.post(url, body, {
          ...this.queryOptions,
          headers: this.buildHeaders(options?.headers),
        });

        if (options?.returnErrors) {
          return [data, null];
        }

        return data;
      } else {
        const res = await fetch(url, {
          method: 'POST',
          body: body ? JSON.stringify(body) : null,
          headers: new Headers(options?.headers),
          credentials: options?.credentials ?? 'same-origin',
        });

        if (!res.ok) {
          const err = await buildErrorResponse(res);
          throw err;
        }

        const json = (await res.json()) as UnknownJSON;

        if (options?.returnErrors) {
          return [json, null];
        }

        return json;
      }
    } catch (ex) {
      if (options?.returnErrors) {
        return [null, ex];
      } else {
        this.onError(ex as UnknownJSON);
      }
    }
  }

  async postWithErrors(
    url: string,
    body: UnknownJSON,
    options?: Omit<RequestOptions, 'returnErrors'>,
  ): Promise<RequestWithErrorsResponse> {
    return this.post(url, body, {
      ...options,
      returnErrors: true,
    }) as Promise<RequestWithErrorsResponse>;
  }

  async delete(url: string, options?: RequestOptions): Promise<unknown> {
    try {
      if (this.isRelativeUrl(url)) {
        const { data } = await this.api.delete(url, {
          ...this.queryOptions,
          headers: this.buildHeaders(options?.headers),
        });

        if (options?.returnErrors) {
          return [data, null];
        }

        return data;
      } else {
        const res = await fetch(url, {
          method: 'DELETE',
          headers: new Headers(options?.headers),
          credentials: options?.credentials ?? 'same-origin',
        });

        if (!res.ok) {
          const err = await buildErrorResponse(res);
          throw err;
        }

        let json: UnknownJSON | null = null;

        if (res.status !== 204) {
          json = (await res.json()) as UnknownJSON;
        }

        if (options?.returnErrors) {
          return [json, null];
        }

        return json;
      }
    } catch (ex) {
      if (options?.returnErrors) {
        return [null, ex];
      } else {
        this.onError(ex as UnknownJSON);
      }
    }
  }

  async deleteWithErrors(
    url: string,
    options?: Omit<RequestOptions, 'returnErrors'>,
  ): Promise<RequestWithErrorsResponse> {
    return this.delete(url, {
      ...options,
      returnErrors: true,
    }) as Promise<RequestWithErrorsResponse>;
  }

  public async openCreateRecordModal(objectId: string): Promise<unknown> {
    return this.openCreateRecordHandler(objectId);
  }

  public async openCreateRelatedRecordModal(
    objectId: string,
    relatedEntityId: string,
  ): Promise<unknown> {
    return this.openCreateRelatedRecordHandler(objectId, relatedEntityId);
  }

  public showToast(message: string, toastOptions: ShowToastOptions): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.SHOW_TOAST,
        message,
        toastOptions,
      }),
    );
  }

  public clearToasts(): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.CLEAR_TOASTS,
      }),
    );
  }

  public outputUI(markup: string): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.UI_OUTPUT,
        markup,
      }),
    );
  }

  public prompt(config: ModalConfig): Promise<unknown> {
    return this.promptHandler(config);
  }

  public async dynamicPrompt(_config: DynamicPromptConfig): Promise<unknown> {
    const replacementVar = '__kizen_state';

    let prepend = 'const __kizen_utils = {};\n';

    if (_config.registerUtils) {
      const utils = Object.keys(_config.registerUtils);
      prepend += utils
        .map((u) => {
          const body = _config.registerUtils?.[u];

          if (typeof body !== 'function') {
            throw new Error(`Registered util ${u} is not a function, got ${typeof body}`);
          }

          return `__kizen_utils["${u}"] = (${body.toString()});`;
        })
        .join('\n');
    }

    const configContentResult = _config.content?.map((f) => {
      let optionMapper = '';
      if ('optionMapper' in f) {
        optionMapper = convertToSelfInvokingFunction(
          f.optionMapper,
          replacementVar,
          f.args,
          prepend,
        );
      }

      let getFetchUrl = '';
      if ('getFetchUrl' in f) {
        getFetchUrl = convertToSelfInvokingFunction(f.getFetchUrl, replacementVar, f.args, prepend);
      }

      let getHeaders = '';
      if ('getHeaders' in f) {
        getHeaders = convertToSelfInvokingFunction(f.getHeaders, replacementVar, f.args, prepend);
      }

      let getBody = '';
      if ('getBody' in f) {
        getBody = convertToSelfInvokingFunction(f.getBody, replacementVar, f.args, prepend);
      }

      return {
        ...f,
        optionMapper,
        getFetchUrl,
        getHeaders,
        getBody,
      };
    });

    const config = {
      ..._config,
      content: configContentResult,
    } as DynamicPromptConfig;

    const setupAssistantConfig = {
      fields: config.content,
    };

    const result = await this.dynamicPromptHandler(config);

    const cleanConfigValue = cleanConfig(setupAssistantConfig, result.values);

    return {
      ...result,
      values: cleanConfigValue,
    };
  }

  public outputIframe(url: string, allow?: string[], sandbox?: string): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.IFRAME_OUTPUT,
        url,
        allow,
        sandbox,
        preserve: this.preserve,
      }),
    );
  }

  private getBase64EncodedBlob(data: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.readAsDataURL(data);

      reader.onload = () => {
        resolve(reader.result as string);
      };

      reader.onerror = (error) => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(error);
      };
    });
  }

  public async uploadFile(data: Blob, fileName?: string, isPublic = false): Promise<unknown> {
    const encoded = await this.getBase64EncodedBlob(data);
    const res = await this.uploadFileHandler({
      file: encoded,
      fileName: fileName ?? 'file_' + String(Date.now()),
      isPublic,
    });

    return res;
  }

  protected afterSetup(): void {
    /* empty */
  }

  protected __setup(): void {
    if (this.setupExecutions !== 0) {
      throw new Error(
        'Setup must be called exactly once, and should never be called by a script directly.',
      );
    }

    if (this.cleanupExecutions !== 0) {
      throw new Error('Setup was called after cleanup');
    }

    if (this.isDebug) {
      this.console.log(`Running script:\n\n${this.scriptBody}`);
    }

    this.setupExecutions++;
    this.executionTimer = performance.now();

    this.afterSetup();
  }

  protected __cleanup(result?: unknown): void {
    if (this.cleanupExecutions !== 0) {
      throw new Error(
        'Cleanup must be called exactly once, and should never be called by a script directly.',
      );
    }

    if (this.setupExecutions !== 1) {
      throw new Error('Cleanup was called before setup');
    }

    this.cleanupExecutions++;
    this.setIndicator(INDICATOR_TYPE.NONE);
    const end = performance.now();
    if (this.isDebug) {
      this.console.log(`Script execution took ${String(end - this.executionTimer)}ms`);
    }

    this.done(this.preserve, result);
  }

  setIndicator(indicator: StateChangePayload['indicator'] = INDICATOR_TYPE.NONE): void {
    this.internalState.indicator = indicator;

    this.setState({ indicator });
  }

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private done(preserve: boolean, result?: unknown): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.DONE,
        result,
        preserve,
      }),
    );
  }

  private setState(state: unknown): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.SETSTATE,
        state,
      }),
    );
  }

  protected isRelativeUrl(url: string): boolean {
    return url.startsWith('/');
  }

  private buildHeaders(headers: Record<string, string> = {}): Record<string, string> {
    return {
      ...headers,
      'X-Request-Type': 'kizen-ui-scripting-api',
    };
  }

  public refreshTimelineForId(id?: string): void {
    if (id) {
      this.instance.postMessage(
        JSON.stringify({
          action: ACTIONS.REFRESH_TIMELINE,
          entityId: id,
        }),
      );
    }
  }

  public refreshEntityForId(id?: string): unknown {
    if (id) {
      return this.refreshEntityHandler(id);
    }
  }

  public async installThirdPartyScript(scriptUrl: string): Promise<ThirdPartyScript | undefined> {
    try {
      const result = await this.installThirdPartyScriptHandler(scriptUrl, this.args);
      const manager = new ThirdPartyScript(this.instance, result.url);

      return manager;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_ex) {
      this.onError(new Error(`Third party script ${scriptUrl} could not be installed.`));
    }
  }

  public releaseBlockingScript(): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.RELEASE_BLOCKING_SCRIPT,
      }),
    );
  }

  public copyToClipboard(text: string): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.COPY_TO_CLIPBOARD,
        text,
      }),
    );
  }

  public createDateObject(dateString: string): Date {
    if (typeof dateString !== 'string') {
      throw new Error(`Invalid date string ${String(dateString)}`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      throw new Error(`Date string ${dateString} is not in the format YYYY-MM-DD`);
    }

    const parts = dateString.split('-').map((part) => parseInt(part, 10));

    if (parts.length < 3) {
      throw new Error(`Date string ${dateString} could not be parsed into valid date parts`);
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const dateObj = new Date(parts[0]!, parts[1]! - 1, parts[2]);

    return dateObj;
  }

  public formatDateForResponse(date: Date): number {
    return date.getTime();
  }
}
