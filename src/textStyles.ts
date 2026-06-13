import caveatFontUrl from "./assets/fonts/Caveat-VariableFont_wght.ttf";
import type { TextAlign, TextElement } from "./types";

export const BUNDLED_HANDWRITING_FONT_FAMILY = "Caveat";
export const BUNDLED_HANDWRITING_FONT_URL = caveatFontUrl;
export const BUNDLED_HANDWRITING_FONT_SAMPLE = "März Grüße äußern fürs Öl";
export const CALENDAR_HANDWRITING_FONT_STACK = `"${BUNDLED_HANDWRITING_FONT_FAMILY}", "Comic Neue", "Comic Sans MS", "Bradley Hand", "Segoe Print", cursive`;

export type CalendarFontOption = {
  id: string;
  label: string;
  family: string;
  description: string;
};

export const CALENDAR_FONT_OPTIONS: CalendarFontOption[] = [
  {
    id: "clean-sans",
    label: "Clean Sans",
    family: "Inter, Noto Sans, Arial, Helvetica, sans-serif",
    description: "Clean sans-serif for month grids and labels; supports German characters.",
  },
  {
    id: "classic-sans",
    label: "Classic Sans",
    family: "Arial, Helvetica, sans-serif",
    description: "System sans-serif fallback with broad German character support.",
  },
  {
    id: "handwriting",
    label: "Handwriting (bundled Caveat)",
    family: CALENDAR_HANDWRITING_FONT_STACK,
    description: "Bundled OFL handwriting/script font for decorative calendar headings; supports German umlauts and ß.",
  },
  {
    id: "script",
    label: "Script",
    family: `"${BUNDLED_HANDWRITING_FONT_FAMILY}", "Segoe Script", "Brush Script MT", "Apple Chancery", cursive`,
    description: "Decorative script stack led by the bundled Caveat font for titles with umlauts and ß.",
  },
  {
    id: "mono-grid",
    label: "Mono Grid",
    family: "Courier New, Courier, monospace",
    description: "Monospace option for aligned calendar date grids.",
  },
];

export const DEFAULT_TEXT_FONT_WEIGHT = "400";
export const DEFAULT_TEXT_ALIGN: TextAlign = "left";
export const DEFAULT_TEXT_LETTER_SPACING = 0;

export function getTextFontWeight(element: Pick<TextElement, "fontWeight">): string {
  return element.fontWeight ?? DEFAULT_TEXT_FONT_WEIGHT;
}

export function getTextAlign(element: Pick<TextElement, "textAlign">): TextAlign {
  return element.textAlign ?? DEFAULT_TEXT_ALIGN;
}

export function getTextLetterSpacing(element: Pick<TextElement, "letterSpacing">): number {
  return element.letterSpacing ?? DEFAULT_TEXT_LETTER_SPACING;
}
