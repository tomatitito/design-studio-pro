import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Project, Page } from "../types";
import { logMiddleware } from "./logMiddleware";

export interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  isDirty: boolean;
  setCurrentProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setDirty: (dirty: boolean) => void;
  addPage: (page: Page) => void;
  removePage: (pageId: string) => void;
  updatePage: (pageId: string, updates: Partial<Page>) => void;
}

export const useProjectStore = create<ProjectState>()(
  logMiddleware("projectStore")(immer((set) => ({
    currentProject: null,
    projects: [],
    isDirty: false,

    setCurrentProject: (project) =>
      set((state) => {
        state.currentProject = project;
      }),

    addProject: (project) =>
      set((state) => {
        state.projects.push(project);
      }),

    updateProject: (id, updates) =>
      set((state) => {
        const index = state.projects.findIndex((p) => p.id === id);
        if (index !== -1) {
          Object.assign(state.projects[index], updates);
        }
      }),

    removeProject: (id) =>
      set((state) => {
        state.projects = state.projects.filter((p) => p.id !== id);
      }),

    setDirty: (dirty) =>
      set((state) => {
        state.isDirty = dirty;
      }),

    addPage: (page) =>
      set((state) => {
        if (state.currentProject) {
          state.currentProject.pages.push(page);
        }
      }),

    removePage: (pageId) =>
      set((state) => {
        if (state.currentProject) {
          state.currentProject.pages = state.currentProject.pages.filter(
            (p) => p.id !== pageId,
          );
        }
      }),

    updatePage: (pageId, updates) =>
      set((state) => {
        if (state.currentProject) {
          const index = state.currentProject.pages.findIndex(
            (p) => p.id === pageId,
          );
          if (index !== -1) {
            Object.assign(state.currentProject.pages[index], updates);
          }
        }
      }),
  }))),
);
