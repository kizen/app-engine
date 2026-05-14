import { ACTIONS } from '../communication/constants.js';
import { BaseWorkerContext } from '../contexts/BaseWorkerContext.js';
import type { WorkerEvent } from '../types/workers.js';
import { getFn } from '../util/run.js';
import {
  closeModalHandler,
  dynamicPromptHandler,
  handleCommonResponse,
  installThirdPartyScriptHandler,
  kizenRequestHandler,
  openCreateRecordHandler,
  openCreateRelatedRecordHandler,
  postFormDataHandler,
  promptHandler,
  refreshEntityHandler,
  showViewInModalHandler,
  uploadFileHandler,
} from './util.js';
import { WorkerPromise } from './WorkerPromise.js';

const promises = new WorkerPromise({ isDebug: false });

let runner: BaseWorkerContext | null = null;

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
      showViewInModal: showViewInModalHandler(self, promises),
      closeModal: closeModalHandler(self),
      pluginApiName,
      location,
    });

    await fn.bind(runner)();
  } else {
    handleCommonResponse(action, e, promises);
  }
};
