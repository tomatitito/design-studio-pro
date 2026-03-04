import type { Element } from "./element";

export interface Page {
  id: string;
  name: string;
  elements: Element[];
  width: number;
  height: number;
  backgroundColor: string;
  order: number;
}
