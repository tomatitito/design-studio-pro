import type { CalendarMonth, CalendarPageRole } from "./calendar";
import type { Element } from "./element";

export interface PageCalendarMetadata {
  month?: CalendarMonth;
}

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
}
