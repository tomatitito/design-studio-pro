import type * as React from "react";
import type { Project, Page } from "../types";
export type { Project, Page, Element } from "../types";

export const API_VERSION = 1;
export type ReadonlyDeep<T> = T extends object ? { readonly [K in keyof T]: ReadonlyDeep<T[K]> } : T;
export interface EditorSnapshot {
  project: ReadonlyDeep<Project> | null;
  activePage: ReadonlyDeep<Page> | null;
  selection: readonly string[];
}
export type Edit =
  | { type: "page.background"; pageId: string; color: string }
  | { type: "text.content"; pageId: string; elementId: string; content: string }
  | { type: "element.color"; pageId: string; elementId: string; color: string };
export interface EditorAPI {
  getSnapshot(): EditorSnapshot;
  subscribe(listener: () => void): () => void;
  edit(request: { projectId: string; operations: readonly Edit[] }): void;
}
export interface Section {
  id: string;
  title: string;
  order?: number;
  component: React.ComponentType<{ editor: EditorAPI }>;
}
export interface ExtensionAPI {
  version: typeof API_VERSION;
  React: typeof React;
  editor: EditorAPI;
  props: { registerSection(section: Section): () => void };
}
export interface ExtensionModule {
  activate(api: ExtensionAPI): void | (() => void) | Promise<void | (() => void)>;
}
export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: typeof API_VERSION;
  entry: "extension.js";
}
