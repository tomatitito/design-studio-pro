import { describe, expect, it } from "vitest";
import {
  GERMAN_MONTH_NAMES,
  formatGermanCalendarMonthGrid,
  generateGermanCalendarMonth,
  getGermanCalendarMonthName,
  GERMAN_WEEKDAY_ABBREVIATIONS,
} from "../calendarDates";

describe("German calendar date generation", () => {
  it("generates January with Monday-first grid positions", () => {
    const january = generateGermanCalendarMonth(2024, 1);

    expect(january.monthName).toBe("Januar");
    expect(january.leadingGridPositions).toEqual([]);
    expect(january.days).toHaveLength(31);
    expect(january.days[0]).toMatchObject({
      dayNumber: 1,
      weekdayIndex: 0,
      isWeekend: false,
      index: 0,
      row: 0,
      column: 0,
    });
    expect(january.days[5]).toMatchObject({
      dayNumber: 6,
      weekdayIndex: 5,
      isWeekend: true,
      index: 5,
      row: 0,
      column: 5,
    });
    expect(january.days[30]).toMatchObject({
      dayNumber: 31,
      weekdayIndex: 2,
      isWeekend: false,
      index: 30,
      row: 4,
      column: 2,
    });
    expect(january.trailingGridPositions).toEqual([
      { type: "trailing", index: 31, row: 4, column: 3 },
      { type: "trailing", index: 32, row: 4, column: 4 },
      { type: "trailing", index: 33, row: 4, column: 5 },
      { type: "trailing", index: 34, row: 4, column: 6 },
    ]);
    expect(january.totalGridPositions).toBe(35);
  });

  it("generates a month with a different weekday alignment", () => {
    const march = generateGermanCalendarMonth(2024, 3);

    expect(march.monthName).toBe("März");
    expect(march.leadingGridPositions).toEqual([
      { type: "leading", index: 0, row: 0, column: 0 },
      { type: "leading", index: 1, row: 0, column: 1 },
      { type: "leading", index: 2, row: 0, column: 2 },
      { type: "leading", index: 3, row: 0, column: 3 },
    ]);
    expect(march.days[0]).toMatchObject({
      dayNumber: 1,
      weekdayIndex: 4,
      isWeekend: false,
      index: 4,
      row: 0,
      column: 4,
    });
    expect(march.days[30]).toMatchObject({
      dayNumber: 31,
      weekdayIndex: 6,
      isWeekend: true,
      index: 34,
      row: 4,
      column: 6,
    });
    expect(march.trailingGridPositions).toEqual([]);
    expect(march.totalGridPositions).toBe(35);
  });

  it("formats a reusable German month grid", () => {
    expect(formatGermanCalendarMonthGrid(generateGermanCalendarMonth(2024, 1))).toBe(
      "Mo Di Mi Do Fr Sa So\n 1  2  3  4  5  6  7\n 8  9 10 11 12 13 14\n15 16 17 18 19 20 21\n22 23 24 25 26 27 28\n29 30 31            ",
    );
  });

  it("returns German month names and weekday abbreviations", () => {
    expect(getGermanCalendarMonthName(10)).toBe("Oktober");
    expect(GERMAN_MONTH_NAMES).toContain("März");
    expect(GERMAN_WEEKDAY_ABBREVIATIONS).toEqual([
      { weekdayIndex: 0, abbreviation: "Mo" },
      { weekdayIndex: 1, abbreviation: "Di" },
      { weekdayIndex: 2, abbreviation: "Mi" },
      { weekdayIndex: 3, abbreviation: "Do" },
      { weekdayIndex: 4, abbreviation: "Fr" },
      { weekdayIndex: 5, abbreviation: "Sa" },
      { weekdayIndex: 6, abbreviation: "So" },
    ]);
  });

  it("handles leap-year February", () => {
    const february = generateGermanCalendarMonth(2024, 2);

    expect(february.monthName).toBe("Februar");
    expect(february.days).toHaveLength(29);
    expect(february.leadingGridPositions).toHaveLength(3);
    expect(february.days[0]).toMatchObject({ dayNumber: 1, weekdayIndex: 3, index: 3 });
    expect(february.days[28]).toMatchObject({
      dayNumber: 29,
      weekdayIndex: 3,
      isWeekend: false,
      index: 31,
      row: 4,
      column: 3,
    });
    expect(february.trailingGridPositions).toEqual([
      { type: "trailing", index: 32, row: 4, column: 4 },
      { type: "trailing", index: 33, row: 4, column: 5 },
      { type: "trailing", index: 34, row: 4, column: 6 },
    ]);
  });
});
