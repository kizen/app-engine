export type BlockType =
  | 'homepages'
  | 'dashboards'
  | 'charts'
  | 'records';

export type BlockConfig = {
  api_name: string;
  name: string;
  types?: BlockType[];
  min_w?: number;
  max_w?: number;
  min_h?: number;
  max_h?: number;
  recommended_height?: number;
};
