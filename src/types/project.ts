import type { CalendarThemeId } from "./calendar";
import type { Element } from "./element";
import type { Page } from "./page";

export type ProjectType = "photo-page" | "calendar";

export interface ProjectSettings {
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  unit: "mm" | "inch" | "px";
}

export interface CalendarSettings {
  year: number;
  locale: "de-DE";
  themeId?: CalendarThemeId;
}

export interface SinglePageUnit {
  id: string;
  unitType: "single";
  pageId: string;
}

export interface SpreadUnit {
  id: string;
  unitType: "spread";
  spreadId: string;
}

export type ProjectUnit = SinglePageUnit | SpreadUnit;

export interface Spread {
  id: string;
  name: string;
  leftPageId: string;
  rightPageId: string;
  elements: Element[];
}

export interface Project {
  id: string;
  name: string;
  projectType?: ProjectType;
  calendar?: CalendarSettings;
  pages: Page[];
  units?: ProjectUnit[];
  spreads?: Spread[];
  createdAt: string;
  modifiedAt: string;
  settings: ProjectSettings;
}
