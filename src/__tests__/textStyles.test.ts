import { describe, expect, it } from "vitest";
import {
  BUNDLED_HANDWRITING_FONT_FAMILY,
  BUNDLED_HANDWRITING_FONT_SAMPLE,
  BUNDLED_HANDWRITING_FONT_URL,
  CALENDAR_FONT_OPTIONS,
} from "../textStyles";

type ReadFileSync = (path: string, encoding?: "utf8") => Uint8Array | string;

function readUInt16(font: DataView, offset: number): number {
  return font.getUint16(offset, false);
}

function readUInt32(font: DataView, offset: number): number {
  return font.getUint32(offset, false);
}

function getTableOffset(font: DataView, bytes: Uint8Array, tag: string): number {
  const tableCount = readUInt16(font, 4);
  const decoder = new TextDecoder("ascii");

  for (let index = 0; index < tableCount; index += 1) {
    const entryOffset = 12 + index * 16;
    const tableTag = decoder.decode(bytes.slice(entryOffset, entryOffset + 4));
    if (tableTag === tag) {
      return readUInt32(font, entryOffset + 8);
    }
  }

  throw new Error(`Missing ${tag} table`);
}

function fontHasCodePoint(font: DataView, bytes: Uint8Array, codePoint: number): boolean {
  const cmapOffset = getTableOffset(font, bytes, "cmap");
  const subtableCount = readUInt16(font, cmapOffset + 2);

  for (let index = 0; index < subtableCount; index += 1) {
    const encodingRecordOffset = cmapOffset + 4 + index * 8;
    const subtableOffset = cmapOffset + readUInt32(font, encodingRecordOffset + 4);
    const format = readUInt16(font, subtableOffset);

    if (format === 4) {
      const segCount = readUInt16(font, subtableOffset + 6) / 2;
      const endCodeOffset = subtableOffset + 14;
      const startCodeOffset = endCodeOffset + segCount * 2 + 2;

      for (let segment = 0; segment < segCount; segment += 1) {
        const endCode = readUInt16(font, endCodeOffset + segment * 2);
        const startCode = readUInt16(font, startCodeOffset + segment * 2);
        if (codePoint >= startCode && codePoint <= endCode) return true;
      }
    }

    if (format === 12) {
      const groupCount = readUInt32(font, subtableOffset + 12);
      for (let group = 0; group < groupCount; group += 1) {
        const groupOffset = subtableOffset + 16 + group * 12;
        const startCharCode = readUInt32(font, groupOffset);
        const endCharCode = readUInt32(font, groupOffset + 4);
        if (codePoint >= startCharCode && codePoint <= endCharCode) return true;
      }
    }
  }

  return false;
}

async function readBundledFont(): Promise<Uint8Array> {
  const fsModuleName = "node:fs";
  const { readFileSync } = (await import(fsModuleName)) as { readFileSync: ReadFileSync };
  const cwd = (globalThis as unknown as { process: { cwd(): string } }).process.cwd();
  return readFileSync(`${cwd}/src/assets/fonts/Caveat-VariableFont_wght.ttf`) as Uint8Array;
}

async function readTextFile(path: string): Promise<string> {
  const fsModuleName = "node:fs";
  const { readFileSync } = (await import(fsModuleName)) as { readFileSync: ReadFileSync };
  const cwd = (globalThis as unknown as { process: { cwd(): string } }).process.cwd();
  return readFileSync(`${cwd}/${path}`, "utf8") as string;
}

describe("calendar text font presets", () => {
  it("registers a bundled handwriting font preset with German character coverage", async () => {
    const handwriting = CALENDAR_FONT_OPTIONS.find((font) => font.id === "handwriting");
    const fontBytes = await readBundledFont();
    const font = new DataView(fontBytes.buffer, fontBytes.byteOffset, fontBytes.byteLength);

    expect(BUNDLED_HANDWRITING_FONT_FAMILY).toBe("Caveat");
    expect(BUNDLED_HANDWRITING_FONT_URL).toContain("Caveat-VariableFont_wght.ttf");
    expect(BUNDLED_HANDWRITING_FONT_SAMPLE).toBe("März Grüße äußern fürs Öl");
    for (const char of ["ä", "ö", "ü", "Ä", "Ö", "Ü", "ß"]) {
      expect(fontHasCodePoint(font, fontBytes, char.codePointAt(0)!)).toBe(true);
    }
    expect(handwriting).toMatchObject({
      label: "Handwriting (bundled Caveat)",
      family: expect.stringContaining("Caveat"),
    });
    expect(handwriting?.description).toContain("umlauts and ß");
  });

  it("ships the bundled Caveat OFL license as a public package asset", async () => {
    const sourceLicense = await readTextFile("src/assets/fonts/OFL-Caveat.txt");
    const publicLicense = await readTextFile("public/licenses/OFL-Caveat.txt");

    expect(publicLicense).toBe(sourceLicense);
    expect(publicLicense).toContain("SIL Open Font License");
  });
});
