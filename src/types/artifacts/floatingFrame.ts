import type { EmployeeConfig, UnknownJSON } from '../common.js';
import type { CommonPluginDefinition } from '../run.js';

export interface MinimizedConfig extends UnknownJSON {
  customIcon?: string;
  icon?: string;
  color?: string;
}

export type FrameQuadrant = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface WindowPosition {
  left: number;
  top: number;
  quadrant?: FrameQuadrant;
  deltas?: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
}

export interface FloatingFrameEmployeeConfig {
  position?: WindowPosition;
  minimized?: boolean;
}

export interface FloatingFrameConfig extends CommonPluginDefinition {
  api_name: string;
  css?: string;
  default_position?: 'bottom-left' | 'bottom-right' | 'bottom-right-fixed' | 'bottom-left-fixed';
  event_scripts?: Record<string, string>;
  header_color?: string;
  header_text_color?: string;
  height?: number;
  html?: string;
  name: string;
  script?: string;
  title: string;
  type: 'script' | 'iframe' | 'html';
  width?: number;
  match?: string[];
  ignore?: string[];
  message_handler?: string;
  minimized_style?: 'bar' | 'circle' | 'none';
  minimized_config?: MinimizedConfig;
  when?: string;
  employee_config?: EmployeeConfig<FloatingFrameEmployeeConfig>;
  args?: Record<string, UnknownJSON>;
}

export type ExecuteFloatingFrameScript = (script: string, args?: Record<string, unknown>) => void;
