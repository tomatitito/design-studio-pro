export type ElementType = "image" | "text" | "shape" | "group";
export type ShapeKind = "rectangle" | "ellipse" | "line" | "polygon";

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface BaseElement {
  id: string;
  elementType: ElementType;
  position: Position;
  size: Size;
  rotation: number;
  opacity: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
}

export interface ImageElement extends BaseElement {
  elementType: "image";
  src: string;
  alt: string;
  borderStyle?: string;
  borderColor?: string;
  borderWidth?: number;
}

export interface TextElement extends BaseElement {
  elementType: "text";
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
}

export interface ShapeElement extends BaseElement {
  elementType: "shape";
  shapeKind: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface GroupElement extends BaseElement {
  elementType: "group";
  children: Element[];
}

export type Element = ImageElement | TextElement | ShapeElement | GroupElement;
