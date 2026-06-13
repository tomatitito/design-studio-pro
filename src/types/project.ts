import type { CalendarThemeId } from "./calendar";
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

export interface Project {
  id: string;
  name: string;
  projectType?: ProjectType;
  calendar?: CalendarSettings;
  pages: Page[];
  createdAt: string;
  modifiedAt: string;
  settings: ProjectSettings;
}
