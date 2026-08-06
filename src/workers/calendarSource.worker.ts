import { ACTIONS } from '../communication/constants.js';
import { BaseWorkerContext } from '../contexts/BaseWorkerContext.js';
import type { WorkerEvent } from '../types/workers.js';
import { buildCodeRunnerFunction } from '../util/run.js';
import {
  dynamicPromptHandler,
  handleCommonResponse,
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

const notAllowedVoid = (fnName: string) => (): void => {
  throw new Error(`${fnName} is not supported in calendar source scripts`);
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
    const { fn, functionBody } = buildCodeRunnerFunction(script);

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
      showViewInModal: notAllowed('showViewInModal'),
      closeModal: notAllowedVoid('closeModal'),
      completeSetup: notAllowed('completeSetup'),
      pluginApiName,
      location,
    });

    await fn.bind(runner)();
  } else {
    handleCommonResponse(action, e, promises);
  }
};
