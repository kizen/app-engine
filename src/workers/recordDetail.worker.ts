import { ACTIONS, RESPONSES } from '../communication/constants.js';
import { RecordDetailWorkerContext } from '../contexts/RecordDetailWorkerContext.js';
import type {
  InstallThirdPartyScriptResponsePayload,
  PostFormDataResponsePayload,
  PromptResponsePayload,
  RefreshEntityResponsePayload,
  QueryResponsePayload,
  UploadFileResponsePayload,
  WorkerEvent,
  CreateRecordResponsePayload,
  CreateRelatedRecordResponsePayload,
} from '../types/workers.js';
import { getFn } from '../util/run.js';
import {
  dynamicPromptHandler,
  installThirdPartyScriptHandler,
  kizenRequestHandler,
  openCreateRecordHandler,
  openCreateRelatedRecordHandler,
  postFormDataHandler,
  promptHandler,
  refreshEntityHandler,
  uploadFileHandler,
} from './util.js';
import { WorkerPromise } from './WorkerPromise.js';

const promises = new WorkerPromise({ isDebug: false });

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
    const { fn, functionBody } = getFn(script);

    const runner = new RecordDetailWorkerContext({
      user: setup.user,
      teamMember: setup.teamMember,
      business: setup.business,
      entityId: setup.entityId ?? '',
      objectId: setup.objectId ?? '',
      clientObject: setup.clientObject,
      appPath: setup.appPath,
      isDebug: setup.isDebug,
      scriptBody: script,
      functionBody,
      instance: self,
      kizenRequest: kizenRequestHandler(self, promises),
      postFormData: postFormDataHandler(self, promises),
      uploadFile: uploadFileHandler(self, promises),
      installThirdPartyScript: installThirdPartyScriptHandler(self, promises),
      args: args ?? '',
      sessionData,
      pluginComponentId,
      prompt: promptHandler(self, promises),
      dynamicPrompt: dynamicPromptHandler(self, promises),
      refreshEntity: refreshEntityHandler(self, promises),
      openCreateRecord: openCreateRecordHandler(self, promises),
      openCreateRelatedRecord: openCreateRelatedRecordHandler(self, promises),
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
  } else if (action === RESPONSES.CREATE_RELATED_RECORD_RESPONSE) {
    const { id, data } = JSON.parse(e.data) as CreateRelatedRecordResponsePayload;
    promises.resolve(id, data);
  }
};
