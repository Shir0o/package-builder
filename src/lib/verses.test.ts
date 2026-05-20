import { describe, it, expect } from "vitest";
import { parseVerseLines } from "./verses";

describe("parseVerseLines", () => {
  it("returns [] for empty/falsy input", () => {
    expect(parseVerseLines("")).toEqual([]);
  });

  it("parses numbered and unnumbered lines, skipping blanks", () => {
    const out = parseVerseLines("1 In the beginning\n\n  2 God created\nselah");
    expect(out).toEqual([
      { num: "1", text: "In the beginning" },
      { num: "2", text: "God created" },
      { num: null, text: "selah" },
    ]);
  });
});
