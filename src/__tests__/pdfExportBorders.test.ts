import { describe, expect, it } from "vitest";
import type { ImageElement } from "../types";
import { resolvePdfImageBorder } from "../canvas/export";

function image(overrides: Partial<ImageElement>): ImageElement {
  return {
    id: "image-1",
    elementType: "image",
    src: "/tmp/photo.png",
    alt: "photo",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 80 },
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    locked: false,
    visible: true,
    ...overrides,
  };
}

describe("resolvePdfImageBorder", () => {
  it("uses style preset defaults when only style is set", () => {
    const result = resolvePdfImageBorder(
      image({ borderStyle: "matte-frame", borderColor: undefined, borderWidth: undefined }),
    );

    expect(result).toEqual({
      borderStyle: "matte-frame",
      borderColor: "#f5f1e8",
      borderWidth: 12,
    });
  });

  it("keeps explicit color and width overrides", () => {
    const result = resolvePdfImageBorder(
      image({ borderStyle: "ornate-gold", borderColor: "#ffffff", borderWidth: 3 }),
    );

    expect(result).toEqual({
      borderStyle: "ornate-gold",
      borderColor: "#ffffff",
      borderWidth: 3,
    });
  });

  it("returns empty fields when no border is set", () => {
    expect(resolvePdfImageBorder(image({}))).toEqual({});
  });
});
