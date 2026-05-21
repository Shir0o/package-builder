import { describe, it, expect } from "vitest";
import {
  BLOCK_TYPES,
  BLOCK_ORDER_FOR_PICKER,
  makeBlock,
  uid,
  incrementString,
  predictBlockData,
  makeBlockWithPrediction,
} from "./blocks";
import type { BlockTypeKey } from "./types";

const ALL_TYPES: BlockTypeKey[] = [
  "cover",
  "heading",
  "paragraph",
  "schedule",
  "verses",
  "song",
  "notes",
  "rule",
  "pagebreak",
];

describe("uid / makeBlock", () => {
  it("uid returns a prefixed unique id", () => {
    const a = uid();
    const b = uid();
    expect(a).toMatch(/^b_[a-z0-9]+$/);
    expect(a).not.toBe(b);
  });

  it("makeBlock creates blocks for every type with default data", () => {
    for (const t of ALL_TYPES) {
      const b = makeBlock(t);
      expect(b.type).toBe(t);
      expect(b.id).toMatch(/^b_/);
      expect(b.data).toEqual(BLOCK_TYPES[t].create());
    }
  });
});

describe("BLOCK_TYPES.summary", () => {
  it("cover: uses title; falls back when empty", () => {
    const def = BLOCK_TYPES.cover;
    expect(def.summary({ ...def.create(), title: "Hello" })).toBe("Hello");
    expect(def.summary(def.create())).toBe("Untitled Package");
    expect(def.summary({ eyebrow: "", title: "", subtitle: "", dateline: "" })).toBe(
      "Untitled cover",
    );
  });

  it("heading: shows level and text or (empty)", () => {
    const def = BLOCK_TYPES.heading;
    expect(def.summary({ level: 1, text: "Hi", align: "left" })).toBe("H1 · Hi");
    expect(def.summary({ level: 2, text: "", align: "left" })).toBe("H2 · (empty)");
  });

  it("paragraph: truncates text to 48 chars or fallback", () => {
    const def = BLOCK_TYPES.paragraph;
    expect(def.summary({ text: "", align: "left" })).toBe("Empty paragraph");
    const long = "x".repeat(60);
    expect(def.summary({ text: long, align: "left" })).toBe("x".repeat(48));
  });

  it("schedule: pluralizes rows", () => {
    const def = BLOCK_TYPES.schedule;
    expect(def.summary({ rows: [{ num: "1", topic: "", when: "" }] })).toBe("1 row");
    expect(
      def.summary({
        rows: [
          { num: "1", topic: "", when: "" },
          { num: "2", topic: "", when: "" },
        ],
      }),
    ).toBe("2 rows");
  });

  it("verses: prefers title, then ref, then group count (pluralization)", () => {
    const def = BLOCK_TYPES.verses;
    expect(def.summary({ title: "T", groups: [{ ref: "R", text: "" }] })).toBe("T");
    expect(def.summary({ title: "", groups: [{ ref: "R", text: "" }] })).toBe("R");
    expect(
      def.summary({
        title: "",
        groups: [
          { ref: "", text: "" },
          { ref: "", text: "" },
        ],
      }),
    ).toBe("2 verse groups");
    expect(def.summary({ title: "", groups: [{ ref: "", text: "" }] })).toBe(
      "1 verse group",
    );
  });

  it("song: title or fallback", () => {
    const def = BLOCK_TYPES.song;
    expect(def.summary({ title: "Hymn", stanzas: [] })).toBe("Hymn");
    expect(def.summary({ title: "", stanzas: [] })).toBe("Untitled song");
  });

  it("notes: shows title and line count", () => {
    const def = BLOCK_TYPES.notes;
    expect(def.summary({ title: "T", lines: 5 })).toBe("T · 5 lines");
    expect(def.summary({ title: "", lines: 0 })).toBe("Notes · 0 lines");
  });

  it("rule and pagebreak have fixed labels", () => {
    expect(BLOCK_TYPES.rule.summary({})).toBe("—");
    expect(BLOCK_TYPES.pagebreak.summary({})).toBe("New page →");
  });
});

describe("BLOCK_ORDER_FOR_PICKER", () => {
  it("is an array of rows referencing known types or null", () => {
    expect(Array.isArray(BLOCK_ORDER_FOR_PICKER)).toBe(true);
    for (const row of BLOCK_ORDER_FOR_PICKER) {
      for (const k of row) {
        if (k !== null) expect(ALL_TYPES).toContain(k);
      }
    }
  });
});

describe("prediction and incrementString", () => {
  describe("incrementString", () => {
    it("increments digits at the end of string", () => {
      expect(incrementString("Lesson 1")).toBe("Lesson 2");
      expect(incrementString("Message 9")).toBe("Message 10");
      expect(incrementString("Page 09")).toBe("Page 10");
      expect(incrementString("Chapter 001")).toBe("Chapter 002");
    });

    it("increments word numbers", () => {
      expect(incrementString("Message One")).toBe("Message Two");
      expect(incrementString("Lesson zero")).toBe("Lesson one");
      expect(incrementString("CHAPTER ELEVEN")).toBe("CHAPTER TWELVE");
    });

    it("returns original string if it cannot be incremented", () => {
      expect(incrementString("Hello World")).toBe("Hello World");
      expect(incrementString("Message Twenty")).toBe("Message Twenty");
    });
  });

  describe("predictBlockData", () => {
    it("prefills heading text based on previous heading", () => {
      const blocksBefore = [
        makeBlock("cover"),
        { id: "1", type: "heading", data: { level: 2, text: "Message One", align: "left" } },
        makeBlock("paragraph"),
      ] as any[];

      const data = predictBlockData("heading", blocksBefore);
      expect(data).toEqual({
        level: 2,
        text: "Message Two",
        align: "left",
      });
    });

    it("prefills verses title based on previous verses", () => {
      const blocksBefore = [
        { id: "1", type: "verses", data: { title: "Lesson 1", groups: [] } },
      ] as any[];

      const data = predictBlockData("verses", blocksBefore);
      expect(data.title).toBe("Lesson 2");
    });

    it("prefills notes title based on previous heading containing 'Message'", () => {
      const blocksBefore = [
        { id: "1", type: "heading", data: { level: 2, text: "Message One", align: "left" } },
        makeBlock("paragraph"),
      ] as any[];

      const data = predictBlockData("notes", blocksBefore);
      expect(data.title).toBe("Message One – Notes");
    });

    it("does not prefill notes title if previous heading does not contain 'Message'", () => {
      const blocksBefore = [
        { id: "1", type: "heading", data: { level: 2, text: "Introduction", align: "left" } },
      ] as any[];

      const data = predictBlockData("notes", blocksBefore);
      expect(data.title).toBe("Notes");
    });

    it("returns default data when there are no preceding blocks of relevant types", () => {
      const dataH = predictBlockData("heading", []);
      expect(dataH.text).toBe("Heading");

      const dataV = predictBlockData("verses", []);
      expect(dataV.title).toBe("");

      const dataN = predictBlockData("notes", []);
      expect(dataN.title).toBe("Notes");
    });
  });
});
