import type { CalendarMonth } from "./types";

export const GERMAN_CALENDAR_LOCALE = "de-DE";

export interface CalendarWeekdayLabel {
  /** Monday-first index: Monday = 0, Sunday = 6. */
  weekdayIndex: number;
  abbreviation: string;
}

export interface CalendarGridPosition {
  /** Zero-based position in a Monday-first calendar grid. */
  index: number;
  /** Zero-based row in the calendar grid. */
  row: number;
  /** Zero-based column in the calendar grid: Monday = 0, Sunday = 6. */
  column: number;
}

export interface CalendarDay extends CalendarGridPosition {
  dayNumber: number;
  /** Monday-first index: Monday = 0, Sunday = 6. */
  weekdayIndex: number;
  isWeekend: boolean;
}

export interface CalendarGridPlaceholder extends CalendarGridPosition {
  type: "leading" | "trailing";
}

export interface GermanCalendarMonth {
  year: number;
  month: CalendarMonth;
  monthName: string;
  weekdayAbbreviations: CalendarWeekdayLabel[];
  days: CalendarDay[];
  leadingGridPositions: CalendarGridPlaceholder[];
  trailingGridPositions: CalendarGridPlaceholder[];
  totalGridPositions: number;
}

const weekdayFormatter = new Intl.DateTimeFormat(GERMAN_CALENDAR_LOCALE, {
  weekday: "short",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat(GERMAN_CALENDAR_LOCALE, {
  month: "long",
  timeZone: "UTC",
});

export const GERMAN_MONTH_NAMES: string[] = Array.from({ length: 12 }, (_, monthIndex) =>
  monthFormatter.format(new Date(Date.UTC(2024, monthIndex, 1))),
);

export const GERMAN_WEEKDAY_ABBREVIATIONS: CalendarWeekdayLabel[] = Array.from(
  { length: 7 },
  (_, weekdayIndex) => ({
    weekdayIndex,
    // 2024-01-01 is a Monday; stepping forward produces Monday-first labels.
    abbreviation: weekdayFormatter.format(new Date(Date.UTC(2024, 0, 1 + weekdayIndex))),
  }),
);

export function getGermanCalendarMonthName(month: CalendarMonth): string {
  return GERMAN_MONTH_NAMES[month - 1];
}

export function getDaysInMonth(year: number, month: CalendarMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getMondayFirstWeekdayIndex(year: number, month: CalendarMonth, dayNumber: number): number {
  const sundayFirstIndex = new Date(Date.UTC(year, month - 1, dayNumber)).getUTCDay();
  return (sundayFirstIndex + 6) % 7;
}

export function isWeekendWeekday(weekdayIndex: number): boolean {
  return weekdayIndex === 5 || weekdayIndex === 6;
}

function createGridPosition(index: number): CalendarGridPosition {
  return {
    index,
    row: Math.floor(index / 7),
    column: index % 7,
  };
}

export function generateGermanCalendarMonth(year: number, month: CalendarMonth): GermanCalendarMonth {
  const dayCount = getDaysInMonth(year, month);
  const leadingCount = getMondayFirstWeekdayIndex(year, month, 1);
  const occupiedPositions = leadingCount + dayCount;
  const trailingCount = (7 - (occupiedPositions % 7)) % 7;

  const leadingGridPositions: CalendarGridPlaceholder[] = Array.from(
    { length: leadingCount },
    (_, index) => ({ ...createGridPosition(index), type: "leading" }),
  );

  const days: CalendarDay[] = Array.from({ length: dayCount }, (_, dayIndex) => {
    const dayNumber = dayIndex + 1;
    const weekdayIndex = getMondayFirstWeekdayIndex(year, month, dayNumber);

    return {
      ...createGridPosition(leadingCount + dayIndex),
      dayNumber,
      weekdayIndex,
      isWeekend: isWeekendWeekday(weekdayIndex),
    };
  });

  const trailingGridPositions: CalendarGridPlaceholder[] = Array.from(
    { length: trailingCount },
    (_, index) => ({ ...createGridPosition(occupiedPositions + index), type: "trailing" }),
  );

  return {
    year,
    month,
    monthName: getGermanCalendarMonthName(month),
    weekdayAbbreviations: GERMAN_WEEKDAY_ABBREVIATIONS.map((weekday) => ({ ...weekday })),
    days,
    leadingGridPositions,
    trailingGridPositions,
    totalGridPositions: occupiedPositions + trailingCount,
  };
}

export function formatGermanCalendarMonthGrid(calendarMonth: GermanCalendarMonth): string {
  const weekdayRow = calendarMonth.weekdayAbbreviations
    .map((weekday) => weekday.abbreviation.padStart(2, " "))
    .join(" ");
  const dayCells = Array.from({ length: calendarMonth.totalGridPositions }, () => "  ");

  for (const day of calendarMonth.days) {
    dayCells[day.index] = String(day.dayNumber).padStart(2, " ");
  }

  const weekRows = Array.from({ length: Math.ceil(dayCells.length / 7) }, (_, rowIndex) =>
    dayCells.slice(rowIndex * 7, rowIndex * 7 + 7).join(" "),
  );

  return [weekdayRow, ...weekRows].join("\n");
}
