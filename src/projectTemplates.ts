import { DEFAULT_CALENDAR_THEME_ID, createCalendarMonthPage, createCalendarTitlePage } from "./calendarContracts";
import type { CalendarMonth, CalendarSettings, Page, Project, ProjectType } from "./types";

const A4_PORTRAIT = {
  width: 210,
  height: 297,
  orientation: "portrait" as const,
  unit: "mm" as const,
};

export const GERMAN_CALENDAR_LOCALE = "de-DE" as const;

const CALENDAR_MONTHS: CalendarMonth[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function defaultCalendarYear(date = new Date()): number {
  return date.getFullYear();
}

export function calendarMetadataOrDefault(
  project: Pick<Project, "calendar">,
  year = defaultCalendarYear(),
): CalendarSettings {
  return {
    year: project.calendar?.year ?? year,
    locale: GERMAN_CALENDAR_LOCALE,
    themeId: project.calendar?.themeId ?? DEFAULT_CALENDAR_THEME_ID,
  };
}

function createProjectId(projectType: ProjectType): string {
  return `${projectType}-${Date.now()}`;
}

function createBlankPage(id: string, name: string, order: number): Page {
  return {
    id,
    name,
    elements: [],
    width: A4_PORTRAIT.width,
    height: A4_PORTRAIT.height,
    backgroundColor: "#ffffff",
    order,
  };
}

export function createPhotoPageProject(now = new Date().toISOString()): Project {
  const pages: Page[] = [
    createBlankPage("page-1", "Title page", 0),
    { ...createBlankPage("page-2", "Editable blank", 1), pageKind: "editable-blank" },
    createBlankPage("page-3", "Page 1", 2),
  ];

  return {
    id: createProjectId("photo-page"),
    name: "Untitled",
    projectType: "photo-page",
    pages,
    units: pages.map((page) => ({ id: `unit-${page.id}`, unitType: "single", pageId: page.id })),
    spreads: [],
    createdAt: now,
    modifiedAt: now,
    settings: A4_PORTRAIT,
  };
}

export function createCalendarProject(
  year = defaultCalendarYear(),
  now = new Date().toISOString(),
): Project {
  return {
    id: createProjectId("calendar"),
    name: `Kalender ${year}`,
    projectType: "calendar",
    calendar: {
      year,
      locale: GERMAN_CALENDAR_LOCALE,
      themeId: DEFAULT_CALENDAR_THEME_ID,
    },
    pages: [
      createCalendarTitlePage({ year, order: 0 }),
      ...CALENDAR_MONTHS.map((month) => createCalendarMonthPage(month, { year, order: month })),
    ],
    createdAt: now,
    modifiedAt: now,
    settings: A4_PORTRAIT,
  };
}

export function projectTypeOrDefault(project: Pick<Project, "projectType">): ProjectType {
  return project.projectType ?? "photo-page";
}
