import type { Instance } from '../types/contexts.js';
import { ACTIONS, COMMUNICATIONS } from './constants.js';

export const runFrameScriptEventName = `integration:${COMMUNICATIONS.RUN_FRAME_SCRIPT}`;
export const runBlockScriptEventName = `integration:${COMMUNICATIONS.RUN_BLOCK_SCRIPT}`;

export class Communicate {
  private instance: Instance;

  constructor(instance: Instance) {
    this.instance = instance;
  }

  public runFrameScript(
    frameAPIName: string,
    scriptId: string,
    args?: Record<string, string | number>,
  ): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.COMMUNICATE,
        type: COMMUNICATIONS.RUN_FRAME_SCRIPT,
        eventName: runFrameScriptEventName,
        recipient: {
          frame: frameAPIName,
          script: scriptId,
        },
        args,
      }),
    );
  }

  public runBlockScript(
    blockAPIName: string,
    scriptId: string,
    args?: Record<string, string | number>,
  ): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.COMMUNICATE,
        type: COMMUNICATIONS.RUN_BLOCK_SCRIPT,
        eventName: runBlockScriptEventName,
        recipient: {
          block: blockAPIName,
          script: scriptId,
        },
        args,
      }),
    );
  }

  public sendMessageToOwnFrame(payload: unknown, path: string): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.COMMUNICATE,
        type: COMMUNICATIONS.SEND_MESSAGE_TO_FRAME,
        args: {
          payload,
          path,
        },
      }),
    );
  }
}
