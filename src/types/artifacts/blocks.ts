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
  type?: 'script' | 'iframe' | 'html';
  script?: string;
  styles?: string;
  html?: string;
  iframe_url?: string;
  event_scripts?: Record<string, string>;
  args?: Record<string, UnknownJSON>;
}
