import { describe, expect, it } from "vitest";
import type { Element } from "../types";
import {
  applyBorderToImageElements,
  resolveImageBorderStyle,
} from "../canvas/imageBorders";

const ELEMENTS: Element[] = [
  {
    id: "image-1",
    elementType: "image",
    src: "/tmp/one.png",
    alt: "One",
    position: { x: 0, y: 0 },
    size: { width: 120, height: 80 },
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    locked: false,
    visible: true,
  },
  {
    id: "image-2",
    elementType: "image",
    src: "/tmp/two.png",
    alt: "Two",
    position: { x: 10, y: 10 },
    size: { width: 100, height: 100 },
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    locked: false,
    visible: true,
  },
  {
    id: "text-1",
    elementType: "text",
    content: "Caption",
    fontFamily: "Arial",
    fontSize: 14,
    color: "#000000",
    position: { x: 5, y: 5 },
    size: { width: 40, height: 10 },
    rotation: 0,
    opacity: 1,
    zIndex: 2,
    locked: false,
    visible: true,
  },
];

describe("applyBorderToImageElements", () => {
  it("applies a border to a single selected image", () => {
    const next = applyBorderToImageElements(ELEMENTS, {
      mode: "selected",
      selectedIds: ["image-1"],
      styleId: "custom",
      borderColor: "#ff0000",
      borderWidth: 3,
    });

    const imageOne = next.find((el) => el.id === "image-1");
    const imageTwo = next.find((el) => el.id === "image-2");
    expect(imageOne).toMatchObject({ borderColor: "#ff0000", borderWidth: 3 });
    expect(imageTwo).not.toHaveProperty("borderColor");
    expect(imageTwo).not.toHaveProperty("borderWidth");
  });

  it("applies a border to multiple selected images", () => {
    const next = applyBorderToImageElements(ELEMENTS, {
      mode: "selected",
      selectedIds: ["image-1", "image-2"],
      styleId: "custom",
      borderColor: "#00ff00",
      borderWidth: 5,
    });

    expect(next.find((el) => el.id === "image-1")).toMatchObject({
      borderColor: "#00ff00",
      borderWidth: 5,
    });
    expect(next.find((el) => el.id === "image-2")).toMatchObject({
      borderColor: "#00ff00",
      borderWidth: 5,
    });
  });

  it("applies a border to all images when mode is all", () => {
    const next = applyBorderToImageElements(ELEMENTS, {
      mode: "all",
      selectedIds: [],
      styleId: "custom",
      borderColor: "#0000ff",
      borderWidth: 2,
    });

    const imageOne = next.find((el) => el.id === "image-1");
    const imageTwo = next.find((el) => el.id === "image-2");
    const text = next.find((el) => el.id === "text-1");

    expect(imageOne).toMatchObject({ borderColor: "#0000ff", borderWidth: 2 });
    expect(imageTwo).toMatchObject({ borderColor: "#0000ff", borderWidth: 2 });
    expect(text?.elementType).toBe("text");
    expect(text).not.toHaveProperty("borderColor");
  });

  it("applies a frame-like style preset", () => {
    const next = applyBorderToImageElements(ELEMENTS, {
      mode: "selected",
      selectedIds: ["image-1"],
      styleId: "ornate-gold",
    });

    expect(next.find((el) => el.id === "image-1")).toMatchObject({
      borderStyle: "ornate-gold",
      borderColor: "#d4af37",
      borderWidth: 8,
    });
  });
});

describe("resolveImageBorderStyle", () => {
  it("resolves matte-frame defaults", () => {
    const style = resolveImageBorderStyle("matte-frame");
    expect(style).toMatchObject({
      styleId: "matte-frame",
      borderColor: "#f5f1e8",
      borderWidth: 12,
    });
  });
});
