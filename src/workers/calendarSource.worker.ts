import { ACTIONS, RESPONSES } from '../communication/constants.js';
import { BaseWorkerContext } from '../contexts/BaseWorkerContext.js';
import type {
  CreateRecordResponsePayload,
  InstallThirdPartyScriptResponsePayload,
  PostFormDataResponsePayload,
  PromptResponsePayload,
  QueryResponsePayload,
  RefreshEntityResponsePayload,
  UploadFileResponsePayload,
  WorkerEvent,
} from '../types/workers.js';
import { getFnWithReturn } from '../util/run.js';
import {
  dynamicPromptHandler,
  kizenRequestHandler,
  postFormDataHandler,
  promptHandler,
} from './util.js';
import { WorkerPromise } from './WorkerPromise.js';

const promises = new WorkerPromise({ isDebug: false });

let runner: BaseWorkerContext | null = null;

const notAllowed = (fnName: string) => (): Promise<never> => {
  return new Promise((_, reject) => {
    reject(new Error(`${fnName} is not supported in calendar source scripts`));
  });
};

self.onmessage = async (e: MessageEvent<string>) => {
  const data = JSON.parse(e.data) as WorkerEvent;

  const {
    action,
    script,
    setup,
    args,
    sessionData = {},
    pluginComponentId,
    pluginApiName,
    location,
  } = data;

  if (action === ACTIONS.RUN && setup && script) {
    const { fn, functionBody } = getFnWithReturn(script);

    runner = new BaseWorkerContext({
      user: setup.user,
      teamMember: setup.teamMember,
      business: setup.business,
      clientObject: setup.clientObject,
      isDebug: setup.isDebug,
      appPath: setup.appPath,
      scriptBody: script,
      functionBody,
      instance: self,
      kizenRequest: kizenRequestHandler(self, promises),
      postFormData: postFormDataHandler(self, promises),
      uploadFile: notAllowed('uploadFile'),
      installThirdPartyScript: notAllowed('installThirdPartyScript'),
      args: args ?? '',
      sessionData,
      pluginComponentId,
      prompt: promptHandler(self, promises),
      dynamicPrompt: dynamicPromptHandler(self, promises),
      refreshEntity: notAllowed('refreshEntity'),
      openCreateRecord: notAllowed('openCreateRecord'),
      openCreateRelatedRecord: notAllowed('openCreateRelatedRecord'),
      pluginApiName,
      location,
    });

    await fn.bind(runner)();
  } else if (action === RESPONSES.QUERY_RESPONSE) {
    const { id, data, error } = JSON.parse(e.data) as QueryResponsePayload;
    if (error) {
      promises.reject(id, error);
    } else {
      promises.resolve(id, data);
    }
  } else if (action === RESPONSES.POSTFORMDATA_RESPONSE) {
    const { id, success } = JSON.parse(e.data) as PostFormDataResponsePayload;
    if (success) {
      promises.resolve(id);
    } else {
      promises.reject(id);
    }
  } else if (action === RESPONSES.UPLOADFILE_RESPONSE) {
    const { id, data } = JSON.parse(e.data) as UploadFileResponsePayload;
    if (data) {
      promises.resolve(id, data);
    } else {
      promises.reject(id);
    }
  } else if (action === RESPONSES.INSTALL_THIRD_PARTY_SCRIPT_RESPONSE) {
    const { id, data } = JSON.parse(e.data) as InstallThirdPartyScriptResponsePayload;
    if (data.success) {
      promises.resolve(id, data);
    } else {
      promises.reject(id);
    }
  } else if (action === RESPONSES.PROMPT_RESPONSE) {
    const { id, data } = JSON.parse(e.data) as PromptResponsePayload;
    promises.resolve(id, data);
  } else if (action === RESPONSES.REFRESH_ENTITY_RESPONSE) {
    const { id, data } = JSON.parse(e.data) as RefreshEntityResponsePayload;
    if (data.success) {
      promises.resolve(id, true);
    } else {
      promises.reject(id);
    }
  } else if (action === RESPONSES.CREATE_RECORD_RESPONSE) {
    const { id, data } = JSON.parse(e.data) as CreateRecordResponsePayload;
    promises.resolve(id, data);
  }
};
