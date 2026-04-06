import { ACTIONS } from '../communication/constants.js';
import type { WorkerContextArgs } from '../types/contexts.js';
import type { HideConfig, ShowConfig } from '../types/floatingFrames.js';
import { BaseWorkerContext } from './BaseWorkerContext.js';

export class FloatingFrameWorkerContext extends BaseWorkerContext {
  constructor(args: WorkerContextArgs) {
    super(args);
    this.runnerType = 'floatingFrame';
  }

  public hide(config: HideConfig = {}): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.HIDE,
        config,
      }),
    );
  }

  public hideHeader(): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.HIDE_HEADER,
      }),
    );
  }

  public showHeader(): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.SHOW_HEADER,
      }),
    );
  }

  public show(config: ShowConfig = {}): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.SHOW,
        config,
      }),
    );
  }

  public expand(): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.EXPAND,
      }),
    );
  }

  public collapse(): void {
    this.instance.postMessage(
      JSON.stringify({
        action: ACTIONS.COLLAPSE,
      }),
    );
  }

  protected override afterSetup(): void {
    this.show();
  }
}
