import { DEFAULT_CALENDAR_THEME_ID, createCalendarMonthPage, createCalendarTitlePage } from "./calendarContracts";
import type { CalendarMonth, CalendarSettings, Project, ProjectType } from "./types";

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

export function createPhotoPageProject(now = new Date().toISOString()): Project {
  return {
    id: createProjectId("photo-page"),
    name: "Untitled",
    projectType: "photo-page",
    pages: [
      {
        id: "page-1",
        name: "Page 1",
        elements: [],
        width: A4_PORTRAIT.width,
        height: A4_PORTRAIT.height,
        backgroundColor: "#ffffff",
        order: 0,
      },
    ],
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
