export type CropMode = "smart" | "center" | "top";
export type OutputFormat = "jpeg" | "png";
export type LayoutMode = "square" | "masonry";
export type BorderScope = "each" | "outside";

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
  borderThickness: number;
  borderColor: string;
  borderScope: BorderScope;
}
