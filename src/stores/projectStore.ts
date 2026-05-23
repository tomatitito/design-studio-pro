import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Project, Page } from "../types";
import { logMiddleware } from "./logMiddleware";
import { normalizeProjectElementCoordinates } from "../projectCoordinates";

export interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  activePageId: string | null;
  isDirty: boolean;
  setCurrentProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setActivePage: (pageId: string | null) => void;
  setDirty: (dirty: boolean) => void;
  addPage: (page: Page) => void;
  removePage: (pageId: string) => void;
  updatePage: (pageId: string, updates: Partial<Page>) => void;
}

function getFallbackPage(project: Project | null): Page | null {
  if (!project || project.pages.length === 0) return null;
  return [...project.pages].sort((a, b) => a.order - b.order)[0] ?? null;
}

export function getProjectPageById(project: Project | null, pageId: string | null): Page | null {
  if (!project || !pageId) return null;
  return project.pages.find((page) => page.id === pageId) ?? null;
}

export function getActiveProjectPage(
  project: Project | null,
  activePageId: string | null,
): Page | null {
  return getProjectPageById(project, activePageId) ?? getFallbackPage(project);
}

export function selectActivePage(state: ProjectState): Page | null {
  return getActiveProjectPage(state.currentProject, state.activePageId);
}

export const useProjectStore = create<ProjectState>()(
  logMiddleware("projectStore")(
    immer((set) => ({
      currentProject: null,
      projects: [],
      activePageId: null,
      isDirty: false,

      setCurrentProject: (project) =>
        set((state) => {
          const normalizedProject = project ? normalizeProjectElementCoordinates(project) : null;
          state.currentProject = normalizedProject;
          state.activePageId =
            getProjectPageById(normalizedProject, state.activePageId)?.id ??
            getFallbackPage(normalizedProject)?.id ??
            null;
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
          if (state.currentProject?.id === id) {
            state.currentProject = null;
            state.activePageId = null;
          }
        }),

      setActivePage: (pageId) =>
        set((state) => {
          state.activePageId =
            getProjectPageById(state.currentProject, pageId)?.id ??
            getFallbackPage(state.currentProject)?.id ??
            null;
        }),

      setDirty: (dirty) =>
        set((state) => {
          state.isDirty = dirty;
        }),

      addPage: (page) =>
        set((state) => {
          if (state.currentProject) {
            state.currentProject.pages.push(page);
            if (!getProjectPageById(state.currentProject, state.activePageId)) {
              state.activePageId = page.id;
            }
          }
        }),

      removePage: (pageId) =>
        set((state) => {
          if (state.currentProject) {
            state.currentProject.pages = state.currentProject.pages.filter((p) => p.id !== pageId);
            if (state.activePageId === pageId) {
              state.activePageId = getFallbackPage(state.currentProject)?.id ?? null;
            }
          }
        }),

      updatePage: (pageId, updates) =>
        set((state) => {
          if (state.currentProject) {
            const index = state.currentProject.pages.findIndex((p) => p.id === pageId);
            if (index !== -1) {
              Object.assign(state.currentProject.pages[index], updates);
            }
          }
        }),
    })),
  ),
);
