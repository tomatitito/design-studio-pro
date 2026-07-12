import type { CalendarMonth, CalendarPageRole } from "./calendar";
import type { Element } from "./element";

export interface PageCalendarMetadata {
  month?: CalendarMonth;
}

export type PageKind = "content" | "editable-blank";
export type PhysicalSide = "left" | "right";

export interface Page {
  id: string;
  name: string;
  elements: Element[];
  width: number;
  height: number;
  backgroundColor: string;
  order: number;
  role?: CalendarPageRole;
  calendar?: PageCalendarMetadata;
  pageKind?: PageKind;
}
