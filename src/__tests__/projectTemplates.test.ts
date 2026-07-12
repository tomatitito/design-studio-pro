import { describe, expect, it } from "vitest";
import { createCalendarProject } from "../projectTemplates";
import { findPagePhotoPlaceholders } from "../calendarContracts";
import { formatGermanCalendarMonthGrid, generateGermanCalendarMonth, GERMAN_MONTH_NAMES } from "../calendarDates";
import type { CalendarElementRole, CalendarMonth, Element } from "../types";

const CALENDAR_MONTHS: CalendarMonth[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function findElementByRole(elements: Element[], role: CalendarElementRole): Element | undefined {
  for (const element of elements) {
    if (element.role === role) return element;
    if (element.elementType === "group") {
      const child = findElementByRole(element.children, role);
      if (child) return child;
    }
  }
  return undefined;
}

describe("project templates", () => {
  it("creates calendar projects with a title page followed by January through December", () => {
    const project = createCalendarProject(2031, "2026-06-11T00:00:00.000Z");

    expect(project).toMatchObject({
      name: "Kalender 2031",
      projectType: "calendar",
      calendar: { year: 2031, locale: "de-DE" },
    });
    expect(project.pages).toHaveLength(13);
    expect(project.pages[0]).toMatchObject({ role: "title", order: 0 });

    CALENDAR_MONTHS.forEach((month) => {
      const page = project.pages[month];
      const monthName = GERMAN_MONTH_NAMES[month - 1];

      expect(page).toMatchObject({
        id: `calendar-month-${month}`,
        name: monthName,
        role: "month",
        calendar: { month },
        order: month,
      });
      expect(findPagePhotoPlaceholders(page)).toHaveLength(4);
      expect(page.elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: "calendar-data" }),
        ]),
      );
      expect(findElementByRole(page.elements, "month-label")).toMatchObject({
        role: "month-label",
        content: `${monthName} 2031`,
      });
      expect(findElementByRole(page.elements, "date-grid")).toMatchObject({
        role: "date-grid",
        content: formatGermanCalendarMonthGrid(generateGermanCalendarMonth(2031, month)),
      });
    });
  });
});
