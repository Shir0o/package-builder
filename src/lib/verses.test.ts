import { describe, it, expect } from "vitest";
import { parseVerseLines, parseVerses, stringifyVerses } from "./verses";

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

describe("parseVerses & stringifyVerses", () => {
  it("parses standard single-line references and texts", () => {
    const text = "John 3:6 That which is born of the flesh is flesh, and that which is born of the Spirit is spirit.\n\nJohn 4:24 God is Spirit, and those who worship Him must worship in spirit and truthfulness.";
    const parsed = parseVerses(text);
    expect(parsed).toEqual([
      {
        ref: "John 3:6",
        text: "That which is born of the flesh is flesh, and that which is born of the Spirit is spirit.",
      },
      {
        ref: "John 4:24",
        text: "God is Spirit, and those who worship Him must worship in spirit and truthfulness.",
      },
    ]);
  });

  it("parses complex book references and formats", () => {
    const text = "1 Tim. 6:16 Who alone has immortality...\nRom. 8:16 The Spirit Himself...\nSong of Songs 2:1 I am a rose of Sharon...\nJohn 3:16-4:5 That which is born...\n1 Cor. 13:4, 13:13 Love is...";
    const parsed = parseVerses(text);
    expect(parsed).toEqual([
      { ref: "1 Tim. 6:16", text: "Who alone has immortality..." },
      { ref: "Rom. 8:16", text: "The Spirit Himself..." },
      { ref: "Song of Songs 2:1", text: "I am a rose of Sharon..." },
      { ref: "John 3:16-4:5", text: "That which is born..." },
      { ref: "1 Cor. 13:4, 13:13", text: "Love is..." },
    ]);
  });

  it("handles multi-line verse text", () => {
    const text = "John 3:16 For God so loved the world,\nthat He gave His only begotten Son,\nthat whoever believes...\n\nJohn 3:17 For God did not...";
    const parsed = parseVerses(text);
    expect(parsed).toEqual([
      {
        ref: "John 3:16",
        text: "For God so loved the world,\nthat He gave His only begotten Son,\nthat whoever believes...",
      },
      {
        ref: "John 3:17",
        text: "For God did not...",
      },
    ]);
  });

  it("handles lines without any reference at start of document", () => {
    const text = "Some header or title\nJohn 3:6 God is Spirit";
    const parsed = parseVerses(text);
    expect(parsed).toEqual([
      { ref: "", text: "Some header or title" },
      { ref: "John 3:6", text: "God is Spirit" },
    ]);
  });

  it("roundtrips stringify and parse", () => {
    const groups = [
      { ref: "John 3:6", text: "That which is born of the flesh is flesh." },
      { ref: "Rom. 8:16", text: "The Spirit Himself witnesses..." },
      { ref: "", text: "Just a free-floating comment" },
    ];
    const stringified = stringifyVerses(groups);
    const parsed = parseVerses(stringified);
    expect(parsed).toEqual(groups);
  });

  it("covers reference matching with empty text content and multi-line without reference empty-text check", () => {
    // 1. Reference matching with empty text content (match[2] is undefined/empty)
    const text1 = "John 3:16";
    const parsed1 = parseVerses(text1);
    expect(parsed1).toEqual([{ ref: "John 3:16", text: "" }]);

    // 2. Multi-line without reference starting with empty text on the last group
    const text2 = "John 3:16\nIn the beginning";
    const parsed2 = parseVerses(text2);
    expect(parsed2).toEqual([{ ref: "John 3:16", text: "In the beginning" }]);
  });
});
