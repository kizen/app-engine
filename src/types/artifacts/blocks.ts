import type { UnknownJSON } from '../common.js';
import type { CommonPluginDefinition } from '../run.js';

export type BlockType = 'homepages' | 'dashboards' | 'charts' | 'records';

export interface BlockConfig extends CommonPluginDefinition {
  name: string;
  types?: BlockType[];
  min_w?: number;
  max_w?: number;
  min_h?: number;
  max_h?: number;
  recommended_height?: number;
  when?: string;
  // Runtime content. Blocks store their scoped stylesheet under `styles`
  // (frames/pages use `css`). The bootstrap currently only serves script-type
  // blocks; `type`/`html`/`iframe_url` are carried for parity with the
  // page/frame render surfaces so a block can render html/iframe content too.
  type?: 'script' | 'iframe' | 'html';
  script?: string;
  styles?: string;
  html?: string;
  iframe_url?: string;
  event_scripts?: Record<string, string>;
  args?: Record<string, UnknownJSON>;
}
