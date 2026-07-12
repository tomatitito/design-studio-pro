import type {
  CalendarElementRole,
  CalendarMonth,
  CalendarPageRole,
  CalendarThemeId,
  Element,
  GroupElement,
  ImageElement,
  Page,
  Position,
  Project,
  ShapeElement,
  Size,
  TextElement,
} from "./types";
import {
  formatGermanCalendarMonthGrid,
  generateGermanCalendarMonth,
  getGermanCalendarMonthName,
} from "./calendarDates";
import { CALENDAR_HANDWRITING_FONT_STACK } from "./textStyles";

export const CALENDAR_PAGE_ROLES = ["title", "month"] as const satisfies readonly CalendarPageRole[];

export const CALENDAR_ELEMENT_ROLES = [
  "photo-placeholder",
  "title-text",
  "subtitle-text",
  "calendar-data",
  "month-label",
  "date-grid",
  "theme",
  "decorative",
] as const satisfies readonly CalendarElementRole[];

export interface CalendarThemePreset {
  id: CalendarThemeId;
  label: string;
  swatches: readonly string[];
  tokens: {
    pageBackground: string;
    titleBackground: string;
    titleText: string;
    subtitleText: string;
    monthLabel: string;
    dateGrid: string;
    decorativeFill: string;
    decorativeStroke: string;
  };
}

export const DEFAULT_CALENDAR_THEME_ID: CalendarThemeId = "classic";

export const CALENDAR_THEME_PRESETS = [
  {
    id: "classic",
    label: "Classic light",
    swatches: ["#ffffff", "#f3f4f6", "#1f2937", "#4b5563"],
    tokens: {
      pageBackground: "#ffffff",
      titleBackground: "#f3f4f6",
      titleText: "#1f2937",
      subtitleText: "#4b5563",
      monthLabel: "#1f2937",
      dateGrid: "#374151",
      decorativeFill: "#f3f4f6",
      decorativeStroke: "#f3f4f6",
    },
  },
  {
    id: "warm",
    label: "Warm sand",
    swatches: ["#fffbeb", "#fde68a", "#92400e", "#b45309"],
    tokens: {
      pageBackground: "#fffbeb",
      titleBackground: "#fde68a",
      titleText: "#78350f",
      subtitleText: "#92400e",
      monthLabel: "#92400e",
      dateGrid: "#b45309",
      decorativeFill: "#fde68a",
      decorativeStroke: "#f59e0b",
    },
  },
  {
    id: "forest",
    label: "Forest green",
    swatches: ["#f0fdf4", "#bbf7d0", "#14532d", "#166534"],
    tokens: {
      pageBackground: "#f0fdf4",
      titleBackground: "#bbf7d0",
      titleText: "#14532d",
      subtitleText: "#166534",
      monthLabel: "#14532d",
      dateGrid: "#166534",
      decorativeFill: "#bbf7d0",
      decorativeStroke: "#22c55e",
    },
  },
  {
    id: "ocean",
    label: "Ocean blue",
    swatches: ["#eff6ff", "#bfdbfe", "#1e3a8a", "#2563eb"],
    tokens: {
      pageBackground: "#eff6ff",
      titleBackground: "#bfdbfe",
      titleText: "#1e3a8a",
      subtitleText: "#1d4ed8",
      monthLabel: "#1e3a8a",
      dateGrid: "#2563eb",
      decorativeFill: "#bfdbfe",
      decorativeStroke: "#3b82f6",
    },
  },
] as const satisfies readonly CalendarThemePreset[];

const DISPLAY_DPI = 72;

const A4_PORTRAIT_PAGE = {
  width: 210,
  height: 297,
  backgroundColor: "#ffffff",
};

function mmToDisplayPx(mm: number): number {
  return (mm * DISPLAY_DPI) / 25.4;
}

function calendarLayoutSlot(xMm: number, yMm: number, widthMm: number, heightMm: number): CalendarPhotoLayoutSlot {
  return {
    position: { x: mmToDisplayPx(xMm), y: mmToDisplayPx(yMm) },
    size: { width: mmToDisplayPx(widthMm), height: mmToDisplayPx(heightMm) },
  };
}

export const CALENDAR_PHOTO_LAYOUT_PRESETS = [
  {
    id: "one-full",
    label: "Full image",
    photoCount: 1,
    slots: [calendarLayoutSlot(18, 20, 174, 126)],
  },
  {
    id: "one-polaroid",
    label: "Centered portrait",
    photoCount: 1,
    slots: [calendarLayoutSlot(38, 18, 134, 130)],
  },
  {
    id: "two-stacked",
    label: "Stacked",
    photoCount: 2,
    slots: [calendarLayoutSlot(18, 20, 174, 59), calendarLayoutSlot(18, 87, 174, 59)],
  },
  {
    id: "two-columns",
    label: "Two columns",
    photoCount: 2,
    slots: [calendarLayoutSlot(18, 20, 83, 126), calendarLayoutSlot(109, 20, 83, 126)],
  },
  {
    id: "three-hero-left",
    label: "Hero left",
    photoCount: 3,
    slots: [
      calendarLayoutSlot(18, 20, 105, 126),
      calendarLayoutSlot(131, 20, 61, 59),
      calendarLayoutSlot(131, 87, 61, 59),
    ],
  },
  {
    id: "three-hero-top",
    label: "Hero top",
    photoCount: 3,
    slots: [
      calendarLayoutSlot(18, 20, 174, 76),
      calendarLayoutSlot(18, 104, 83, 42),
      calendarLayoutSlot(109, 104, 83, 42),
    ],
  },
  {
    id: "four-grid-2x2",
    label: "2×2 grid",
    photoCount: 4,
    slots: [
      calendarLayoutSlot(18, 20, 83, 63),
      calendarLayoutSlot(109, 20, 83, 63),
      calendarLayoutSlot(18, 91, 83, 63),
      calendarLayoutSlot(109, 91, 83, 63),
    ],
  },
  {
    id: "four-hero-top",
    label: "Hero top",
    photoCount: 4,
    slots: [
      calendarLayoutSlot(18, 20, 112, 72),
      calendarLayoutSlot(138, 20, 54, 72),
      calendarLayoutSlot(18, 100, 83, 46),
      calendarLayoutSlot(109, 100, 83, 46),
    ],
  },
  {
    id: "four-hero-left",
    label: "Hero left",
    photoCount: 4,
    slots: [
      calendarLayoutSlot(18, 20, 98, 126),
      calendarLayoutSlot(124, 20, 68, 38),
      calendarLayoutSlot(124, 64, 68, 38),
      calendarLayoutSlot(124, 108, 68, 38),
    ],
  },
] as const satisfies readonly CalendarPhotoLayoutPreset[];

let photoPlaceholderIdSequence = 0;

function createPhotoPlaceholderId(): string {
  photoPlaceholderIdSequence += 1;
  return `photo-placeholder-${Date.now()}-${photoPlaceholderIdSequence}`;
}

export interface CreateCalendarPageOptions {
  id?: string;
  name?: string;
  order?: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  elements?: Element[];
}

export interface CreateCalendarTitlePageOptions extends CreateCalendarPageOptions {
  year?: number;
  title?: string;
  subtitle?: string;
}

export interface CreateCalendarMonthPageOptions extends CreateCalendarPageOptions {
  year?: number;
}

export interface CreatePhotoPlaceholderOptions {
  id?: string;
  position?: Position;
  size?: Size;
  zIndex?: number;
  src?: string;
  alt?: string;
}

export interface CalendarPhotoLayoutSlot {
  position: Position;
  size: Size;
}

export interface CalendarPhotoLayoutPreset {
  id: string;
  label: string;
  photoCount: 1 | 2 | 3 | 4;
  slots: CalendarPhotoLayoutSlot[];
}

export function isCalendarPageRole(role: unknown): role is CalendarPageRole {
  return typeof role === "string" && CALENDAR_PAGE_ROLES.includes(role as CalendarPageRole);
}

export function isCalendarElementRole(role: unknown): role is CalendarElementRole {
  return typeof role === "string" && CALENDAR_ELEMENT_ROLES.includes(role as CalendarElementRole);
}

export function getGermanMonthName(month: CalendarMonth): string {
  return getGermanCalendarMonthName(month);
}

function createTitleTextElement(year?: number, title?: string): TextElement {
  const displayYear = year ?? new Date().getFullYear();
  return {
    id: "calendar-title-text",
    elementType: "text",
    role: "title-text",
    content: title ?? `Kalender ${displayYear}`,
    fontFamily: CALENDAR_HANDWRITING_FONT_STACK,
    fontSize: 24,
    color: "#1f2937",
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0.2,
    position: { x: mmToDisplayPx(18), y: mmToDisplayPx(143) },
    size: { width: mmToDisplayPx(174), height: mmToDisplayPx(34) },
    rotation: 0,
    opacity: 1,
    zIndex: 2,
    locked: false,
    visible: true,
  };
}

function createSubtitleTextElement(subtitle?: string): TextElement {
  return {
    id: "calendar-subtitle-text",
    elementType: "text",
    role: "subtitle-text",
    content: subtitle ?? "Familienkalender",
    fontFamily: "Inter, Noto Sans, Arial, Helvetica, sans-serif",
    fontSize: 13,
    color: "#4b5563",
    fontWeight: "400",
    textAlign: "center",
    letterSpacing: 0,
    position: { x: mmToDisplayPx(18), y: mmToDisplayPx(181) },
    size: { width: mmToDisplayPx(174), height: mmToDisplayPx(20) },
    rotation: 0,
    opacity: 1,
    zIndex: 3,
    locked: false,
    visible: true,
  };
}

function createThemeElement(): ShapeElement {
  return {
    id: "calendar-title-theme",
    elementType: "shape",
    role: "theme",
    shapeKind: "rectangle",
    fill: "#f3f4f6",
    stroke: "#f3f4f6",
    strokeWidth: 0,
    position: { x: 0, y: 0 },
    size: { width: mmToDisplayPx(A4_PORTRAIT_PAGE.width), height: mmToDisplayPx(122) },
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    locked: true,
    visible: true,
  };
}

export function createCalendarTitlePageElements(
  options: Pick<CreateCalendarTitlePageOptions, "year" | "title" | "subtitle"> = {},
): Element[] {
  return [
    createThemeElement(),
    createCalendarPhotoPlaceholderElement({
      id: "calendar-title-photo-placeholder",
      position: { x: mmToDisplayPx(18), y: mmToDisplayPx(22) },
      size: { width: mmToDisplayPx(174), height: mmToDisplayPx(92) },
      zIndex: 1,
      alt: "Titelbild-Platzhalter",
    }),
    createTitleTextElement(options.year, options.title),
    createSubtitleTextElement(options.subtitle),
  ];
}

export function createCalendarTitlePage(options: CreateCalendarTitlePageOptions = {}): Page {
  return {
    id: options.id ?? "calendar-title-page",
    name: options.name ?? "Title Page",
    role: "title",
    elements: options.elements ?? createCalendarTitlePageElements(options),
    width: options.width ?? A4_PORTRAIT_PAGE.width,
    height: options.height ?? A4_PORTRAIT_PAGE.height,
    backgroundColor: options.backgroundColor ?? A4_PORTRAIT_PAGE.backgroundColor,
    order: options.order ?? 0,
  };
}

const CALENDAR_DATA_BLOCK_POSITION = { x: mmToDisplayPx(18), y: mmToDisplayPx(161) };
const CALENDAR_DATA_BLOCK_SIZE = { width: mmToDisplayPx(174), height: mmToDisplayPx(64) };

function createCalendarDataGroupElement(year: number, month: CalendarMonth): GroupElement {
  return {
    id: `calendar-month-${month}-data`,
    elementType: "group",
    role: "calendar-data",
    children: [createMonthLabelElement(year, month), createDateGridElement(year, month)],
    position: { ...CALENDAR_DATA_BLOCK_POSITION },
    size: { ...CALENDAR_DATA_BLOCK_SIZE },
    rotation: 0,
    opacity: 1,
    zIndex: 4,
    locked: false,
    visible: true,
  };
}

function createMonthLabelElement(year: number, month: CalendarMonth): TextElement {
  const calendarMonth = generateGermanCalendarMonth(year, month);

  return {
    id: `calendar-month-${month}-label`,
    elementType: "text",
    role: "month-label",
    content: `${calendarMonth.monthName} ${calendarMonth.year}`,
    fontFamily: "Inter, Noto Sans, Arial, Helvetica, sans-serif",
    fontSize: 22,
    color: "#1f2937",
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0,
    position: { x: 0, y: 0 },
    size: { width: CALENDAR_DATA_BLOCK_SIZE.width, height: mmToDisplayPx(14) },
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    locked: false,
    visible: true,
  };
}

function createDateGridElement(year: number, month: CalendarMonth): TextElement {
  const calendarMonth = generateGermanCalendarMonth(year, month);

  return {
    id: `calendar-month-${month}-date-grid`,
    elementType: "text",
    role: "date-grid",
    content: formatGermanCalendarMonthGrid(calendarMonth),
    fontFamily: "Courier New, Courier, monospace",
    fontSize: 10,
    color: "#374151",
    fontWeight: "400",
    textAlign: "center",
    letterSpacing: 0,
    position: { x: 0, y: mmToDisplayPx(20) },
    size: { width: CALENDAR_DATA_BLOCK_SIZE.width, height: mmToDisplayPx(44) },
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    locked: false,
    visible: true,
  };
}

export function createCalendarMonthPageElements(year: number, month: CalendarMonth): Element[] {
  const gridPreset = CALENDAR_PHOTO_LAYOUT_PRESETS.find((preset) => preset.id === "four-grid-2x2");
  const photoPlaceholders = (gridPreset?.slots ?? []).map((slot, index) =>
    createCalendarPhotoPlaceholderElement({
      id: `calendar-month-${month}-photo-${index + 1}`,
      position: slot.position,
      size: slot.size,
      zIndex: index,
      alt: `${getGermanMonthName(month)} Foto ${index + 1}`,
    }),
  );

  return [
    ...photoPlaceholders,
    createCalendarDataGroupElement(year, month),
  ];
}

export function createCalendarMonthPage(
  month: CalendarMonth,
  options: CreateCalendarMonthPageOptions = {},
): Page {
  const year = options.year ?? new Date().getFullYear();

  return {
    id: options.id ?? `calendar-month-${month}`,
    name: options.name ?? getGermanMonthName(month),
    role: "month",
    calendar: { month },
    elements: options.elements ?? createCalendarMonthPageElements(year, month),
    width: options.width ?? A4_PORTRAIT_PAGE.width,
    height: options.height ?? A4_PORTRAIT_PAGE.height,
    backgroundColor: options.backgroundColor ?? A4_PORTRAIT_PAGE.backgroundColor,
    order: options.order ?? month,
  };
}

export function getCalendarThemePreset(themeId: string | undefined): CalendarThemePreset {
  return (
    CALENDAR_THEME_PRESETS.find((preset) => preset.id === themeId) ??
    CALENDAR_THEME_PRESETS.find((preset) => preset.id === DEFAULT_CALENDAR_THEME_ID) ??
    CALENDAR_THEME_PRESETS[0]
  );
}

function applyCalendarThemeToElements(elements: Element[], preset: CalendarThemePreset): Element[] {
  return elements.map((element) => {
    if (element.elementType === "group") {
      return { ...element, children: applyCalendarThemeToElements(element.children, preset) };
    }

    if (element.elementType === "text") {
      if (element.role === "title-text") return { ...element, color: preset.tokens.titleText };
      if (element.role === "subtitle-text") return { ...element, color: preset.tokens.subtitleText };
      if (element.role === "month-label") return { ...element, color: preset.tokens.monthLabel };
      if (element.role === "date-grid") return { ...element, color: preset.tokens.dateGrid };
    }

    if (element.elementType === "shape") {
      if (element.role === "theme") {
        return { ...element, fill: preset.tokens.titleBackground, stroke: preset.tokens.titleBackground };
      }
      if (element.role === "decorative") {
        return { ...element, fill: preset.tokens.decorativeFill, stroke: preset.tokens.decorativeStroke };
      }
    }

    return element;
  });
}

export function applyCalendarThemeToPage(page: Page, themeId: string | undefined): Page {
  const preset = getCalendarThemePreset(themeId);
  if (page.role !== "title" && page.role !== "month") return page;

  return {
    ...page,
    backgroundColor: preset.tokens.pageBackground,
    elements: applyCalendarThemeToElements(page.elements, preset),
  };
}

export function applyCalendarThemeToProject(project: Project, themeId: string): Project {
  if (project.projectType !== "calendar") return project;
  const preset = getCalendarThemePreset(themeId);

  return {
    ...project,
    calendar: {
      year: project.calendar?.year ?? new Date().getFullYear(),
      locale: project.calendar?.locale ?? "de-DE",
      themeId: preset.id,
    },
    pages: project.pages.map((page) => applyCalendarThemeToPage(page, preset.id)),
  };
}

export function createCalendarPhotoPlaceholderElement(
  options: CreatePhotoPlaceholderOptions = {},
): ImageElement {
  return {
    id: options.id ?? createPhotoPlaceholderId(),
    elementType: "image",
    role: "photo-placeholder",
    src: options.src ?? "",
    alt: options.alt ?? "Photo placeholder",
    position: options.position ?? { x: 0, y: 0 },
    size: options.size ?? { width: 0, height: 0 },
    rotation: 0,
    opacity: 1,
    zIndex: options.zIndex ?? 0,
    locked: false,
    visible: true,
  };
}

export function isPhotoPlaceholderElement(element: Element): element is ImageElement {
  return element.elementType === "image" && element.role === "photo-placeholder";
}

export function findPhotoPlaceholderElements(elements: Element[]): ImageElement[] {
  return elements.flatMap((element) => {
    if (isPhotoPlaceholderElement(element)) return [element];
    if (element.elementType === "group") return findPhotoPlaceholderElements(element.children);
    return [];
  });
}

export function findPagePhotoPlaceholders(page: Page): ImageElement[] {
  return findPhotoPlaceholderElements(page.elements);
}

function replacePhotoPlaceholderInElements(
  elements: Element[],
  placeholderId: string,
  replacement: Pick<ImageElement, "src"> & Partial<ImageElement>,
): Element[] {
  return elements.map((element) => {
    if (isPhotoPlaceholderElement(element) && element.id === placeholderId) {
      return {
        ...element,
        ...replacement,
        id: replacement.id ?? element.id,
        elementType: "image",
        role: "photo-placeholder",
      };
    }

    if (element.elementType === "group") {
      return {
        ...element,
        children: replacePhotoPlaceholderInElements(element.children, placeholderId, replacement),
      };
    }

    return element;
  });
}

export function replacePagePhotoPlaceholder(
  page: Page,
  placeholderId: string,
  replacement: Pick<ImageElement, "src"> & Partial<ImageElement>,
): Page {
  return {
    ...page,
    elements: replacePhotoPlaceholderInElements(page.elements, placeholderId, replacement),
  };
}

function removePhotoPlaceholderElements(elements: Element[]): Element[] {
  const filtered: Element[] = [];

  for (const element of elements) {
    if (isPhotoPlaceholderElement(element)) continue;
    if (element.elementType === "group") {
      filtered.push({ ...element, children: removePhotoPlaceholderElements(element.children) });
    } else {
      filtered.push(element);
    }
  }

  return filtered;
}

function isCalendarBackgroundLayer(element: Element): boolean {
  return element.role === "theme" || element.role === "decorative";
}

function isCalendarForegroundLayer(element: Element): boolean {
  return element.role === "calendar-data" || element.role === "month-label" || element.role === "date-grid";
}

function getPlaceholderZIndexStart(elements: Element[]): number {
  const backgroundZIndexes = elements.filter(isCalendarBackgroundLayer).map((element) => element.zIndex);
  return backgroundZIndexes.length > 0 ? Math.max(...backgroundZIndexes) + 1 : 0;
}

function keepCalendarForegroundAbovePlaceholders(elements: Element[], placeholderMaxZIndex: number): Element[] {
  if (!elements.some((element) => isCalendarForegroundLayer(element) && element.zIndex <= placeholderMaxZIndex)) {
    return elements;
  }

  let nextForegroundZIndex = placeholderMaxZIndex + 1;

  return elements.map((element) => {
    if (!isCalendarForegroundLayer(element)) return element;

    const adjusted = { ...element, zIndex: nextForegroundZIndex };
    nextForegroundZIndex += 1;
    return adjusted;
  });
}

export function getCalendarPhotoLayoutPreset(presetId: string): CalendarPhotoLayoutPreset | undefined {
  return CALENDAR_PHOTO_LAYOUT_PRESETS.find((preset) => preset.id === presetId);
}

export function applyCalendarPhotoLayoutPreset(page: Page, presetId: string): Page {
  const preset = getCalendarPhotoLayoutPreset(presetId);
  if (!preset || page.role !== "month") return page;

  const month = page.calendar?.month;
  const existingPlaceholders = findPagePhotoPlaceholders(page);
  const preservedElements = removePhotoPlaceholderElements(page.elements);
  const placeholderZIndexStart = getPlaceholderZIndexStart(preservedElements);
  const photoPlaceholders = preset.slots.map((slot, index) => {
    const existing = existingPlaceholders[index];
    return createCalendarPhotoPlaceholderElement({
      id: existing?.id,
      position: slot.position,
      size: slot.size,
      zIndex: placeholderZIndexStart + index,
      src: existing?.src,
      alt: existing?.alt ?? `${month ? getGermanMonthName(month) : "Kalender"} Foto ${index + 1}`,
    });
  }).map((placeholder, index) => {
    const existing = existingPlaceholders[index];
    return {
      ...placeholder,
      assetId: existing?.assetId,
      borderStyle: existing?.borderStyle,
      borderColor: existing?.borderColor,
      borderWidth: existing?.borderWidth,
      locked: false,
      visible: true,
    };
  });
  const placeholderMaxZIndex = placeholderZIndexStart + photoPlaceholders.length - 1;

  return {
    ...page,
    elements: [
      ...photoPlaceholders,
      ...keepCalendarForegroundAbovePlaceholders(preservedElements, placeholderMaxZIndex),
    ],
  };
}
