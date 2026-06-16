export interface Point {
  x: number;
  y: number;
}

export type PaperSizeId = "A4" | "A3" | "A2" | "A1" | "A0";

export interface PaperSize {
  id: PaperSizeId;
  label: string;
  widthMm: number;
  heightMm: number;
}

export interface Scale {
  paperSizeId: PaperSizeId;
  mapScaleDenominator: number;
  metersPerPixel: number;
}

export type LineType = "polyline";

export interface MeasureLine {
  id: string;
  type: LineType;
  points: Point[];
  color: string;
  pixelLength: number;
  realLengthMeters: number | null;
  visible: boolean;
  labelPosition: Point;
  labelFontSize: number;
  strokeWidth: number;
}

export const DEFAULT_LABEL_FONT_SIZE = 30;
export const MIN_LABEL_FONT_SIZE = 10;
export const MAX_LABEL_FONT_SIZE = 150;

export const DEFAULT_LINE_STROKE_WIDTH = 10;
export const MIN_LINE_STROKE_WIDTH = 1;
export const MAX_LINE_STROKE_WIDTH = 35;

export const DEFAULT_MAP_SCALE_DENOMINATOR = 4000;

export interface ImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ToolMode = "pan" | "polyline" | "select" | "exportRegion";
