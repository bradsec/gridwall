export type CropMode = "smart" | "center" | "top";
export type OutputFormat = "jpeg" | "png";
export type LayoutMode = "square" | "masonry";

export interface Settings {
  layout: LayoutMode;
  gridWidth: number;
  maxGridHeight: number;
  columns: number;
  cropMode: CropMode;
  addNames: boolean;
  limit: number;
  perGrid: number;
  format: OutputFormat;
  quality: number;
}
