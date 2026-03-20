import { describe, expect, it } from "vitest";
import {
  BACKGROUND_PRESETS,
  createPageBackgroundFill,
  parseBackgroundSpec,
  resolveBackgroundInput,
} from "../backgrounds";

describe("backgrounds", () => {
  it("resolves preset ids to full specs", () => {
    expect(resolveBackgroundInput("ocean-mist")).toContain("linear-gradient");
  });

  it("parses solid colors", () => {
    expect(parseBackgroundSpec("#abc")).toEqual({
      kind: "solid",
      color: "#aabbcc",
    });
  });

  it("parses gradient presets", () => {
    const spec = parseBackgroundSpec("sunset-bloom");
    expect(spec.kind).toBe("gradient");
    if (spec.kind === "gradient") {
      expect(spec.stops.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("creates a string fill for solid backgrounds", () => {
    const fill = createPageBackgroundFill("#ffffff", 300, 400);
    expect(fill).toBe("#ffffff");
  });

  it("ships a varied preset palette", () => {
    const gradients = BACKGROUND_PRESETS.filter((preset) =>
      preset.spec.startsWith("linear-gradient"),
    );
    const solids = BACKGROUND_PRESETS.filter((preset) => preset.spec.startsWith("#"));
    expect(solids.length).toBeGreaterThanOrEqual(3);
    expect(gradients.length).toBeGreaterThanOrEqual(3);
  });
});
