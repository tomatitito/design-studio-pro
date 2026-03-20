import { Gradient } from "fabric";

export interface BackgroundPreset {
  id: string;
  label: string;
  spec: string;
  preview: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: "paper-white",
    label: "Paper White",
    spec: "#ffffff",
    preview: "#ffffff",
  },
  {
    id: "sandstone",
    label: "Sandstone",
    spec: "#f4e7d3",
    preview: "#f4e7d3",
  },
  {
    id: "sage",
    label: "Sage",
    spec: "#dce8d8",
    preview: "#dce8d8",
  },
  {
    id: "midnight-ink",
    label: "Midnight Ink",
    spec: "#22304a",
    preview: "#22304a",
  },
  {
    id: "sunset-bloom",
    label: "Sunset Bloom",
    spec: "linear-gradient(135deg, #f97316 0%, #ec4899 55%, #7c3aed 100%)",
    preview: "linear-gradient(135deg, #f97316 0%, #ec4899 55%, #7c3aed 100%)",
  },
  {
    id: "ocean-mist",
    label: "Ocean Mist",
    spec: "linear-gradient(135deg, #0f766e 0%, #38bdf8 100%)",
    preview: "linear-gradient(135deg, #0f766e 0%, #38bdf8 100%)",
  },
  {
    id: "golden-hour",
    label: "Golden Hour",
    spec: "linear-gradient(160deg, #fff7cc 0%, #fbbf24 45%, #fb7185 100%)",
    preview: "linear-gradient(160deg, #fff7cc 0%, #fbbf24 45%, #fb7185 100%)",
  },
  {
    id: "forest-haze",
    label: "Forest Haze",
    spec: "linear-gradient(145deg, #1f4d3a 0%, #7dd3a7 100%)",
    preview: "linear-gradient(145deg, #1f4d3a 0%, #7dd3a7 100%)",
  },
];

interface SolidBackground {
  kind: "solid";
  color: string;
}

interface GradientStop {
  color: string;
  offset: number;
}

interface LinearGradientBackground {
  kind: "gradient";
  angleDeg: number;
  stops: GradientStop[];
}

export type BackgroundSpec = SolidBackground | LinearGradientBackground;

const DEFAULT_BACKGROUND = "#ffffff";

function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!/^#([\da-f]{3}|[\da-f]{6})$/i.test(trimmed)) {
    return null;
  }

  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return trimmed.toLowerCase();
}

function splitGradientArgs(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of input) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function parseGradientStop(segment: string, index: number, total: number): GradientStop | null {
  const match = segment.trim().match(/^(#[\da-fA-F]{3,6})(?:\s+(-?\d+(?:\.\d+)?)%)?$/);

  if (!match) {
    return null;
  }

  const color = normalizeHexColor(match[1]);
  if (!color) {
    return null;
  }

  const parsedOffset = match[2] ? Number(match[2]) / 100 : index / (total - 1);
  const offset = Math.max(0, Math.min(1, parsedOffset));

  return { color, offset };
}

export function resolveBackgroundInput(input: string): string {
  const trimmed = input.trim();
  const preset = BACKGROUND_PRESETS.find((entry) => entry.id === trimmed);
  return preset?.spec ?? trimmed;
}

export function parseBackgroundSpec(input: string): BackgroundSpec {
  const resolved = resolveBackgroundInput(input || DEFAULT_BACKGROUND);
  const solid = normalizeHexColor(resolved);
  if (solid) {
    return { kind: "solid", color: solid };
  }

  const gradientMatch = resolved.match(/^linear-gradient\((.*)\)$/i);
  if (!gradientMatch) {
    return { kind: "solid", color: DEFAULT_BACKGROUND };
  }

  const parts = splitGradientArgs(gradientMatch[1]);
  if (parts.length < 3) {
    return { kind: "solid", color: DEFAULT_BACKGROUND };
  }

  const angleMatch = parts[0].match(/^(-?\d+(?:\.\d+)?)deg$/i);
  if (!angleMatch) {
    return { kind: "solid", color: DEFAULT_BACKGROUND };
  }

  const stops = parts
    .slice(1)
    .map((part, index, all) => parseGradientStop(part, index, all.length))
    .filter((value): value is GradientStop => value !== null);

  if (stops.length < 2) {
    return { kind: "solid", color: DEFAULT_BACKGROUND };
  }

  return {
    kind: "gradient",
    angleDeg: Number(angleMatch[1]),
    stops,
  };
}

export function getBackgroundPreviewStyle(input: string): string {
  const resolved = resolveBackgroundInput(input || DEFAULT_BACKGROUND);
  return normalizeHexColor(resolved) ?? resolved;
}

export function createPageBackgroundFill(
  input: string,
  width: number,
  height: number,
): string | Gradient<"linear"> {
  const spec = parseBackgroundSpec(input);
  if (spec.kind === "solid") {
    return spec.color;
  }

  const radians = (spec.angleDeg * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const length = Math.max(width, height);
  const centerX = width / 2;
  const centerY = height / 2;

  return new Gradient({
    type: "linear",
    gradientUnits: "pixels",
    coords: {
      x1: centerX - dx * length,
      y1: centerY - dy * length,
      x2: centerX + dx * length,
      y2: centerY + dy * length,
    },
    colorStops: spec.stops.map((stop) => ({
      color: stop.color,
      offset: stop.offset,
    })),
  });
}
