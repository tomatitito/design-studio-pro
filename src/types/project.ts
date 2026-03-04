import type { Page } from "./page";

export interface ProjectSettings {
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  unit: "mm" | "inch" | "px";
}

export interface Project {
  id: string;
  name: string;
  pages: Page[];
  createdAt: string;
  modifiedAt: string;
  settings: ProjectSettings;
}
