import { describe, it, expect } from "vitest";
import {
  flattenToUnits,
  groupIntoPages,
  packPages,
  type MeasuredUnit,
} from "./pagination";
import type { AnyBlock } from "../types";

const mk = (type: AnyBlock["type"], id: string, data: unknown = {}): AnyBlock =>
  ({ id, type, data }) as AnyBlock;

describe("groupIntoPages", () => {
  it("returns a single empty page when no blocks", () => {
    expect(groupIntoPages([])).toEqual([[]]);
  });

  it("splits at pagebreak and isolates cover blocks", () => {
    const a = mk("heading", "id_a");
    const b = mk("paragraph", "id_b");
    const cover = mk("cover", "id_c");
    const d = mk("paragraph", "id_d");
    const pb = mk("pagebreak", "id_pb");
    const e = mk("paragraph", "id_e");

    const pages = groupIntoPages([a, b, cover, d, pb, e]);
    expect(pages).toEqual([[a, b], [cover], [d], [e]]);
  });

  it("ignores trailing pagebreak without creating empty page", () => {
    const a = mk("paragraph", "id_a");
    const pb = mk("pagebreak", "id_pb");
    expect(groupIntoPages([a, pb])).toEqual([[a]]);
  });
});

describe("flattenToUnits", () => {
  it("maps a plain block to a single atomic unit", () => {
    const h = mk("heading", "h1", { level: 2, text: "Hi", align: "left" });
    expect(flattenToUnits([h])).toEqual([{ kind: "block", block: h }]);
  });

  it("emits a standalone unit for cover and a sentinel for pagebreak", () => {
    const cover = mk("cover", "c", { eyebrow: "", title: "T", subtitle: "", dateline: "" });
    const pb = mk("pagebreak", "pb");
    expect(flattenToUnits([cover, pb])).toEqual([
      { kind: "standalone", block: cover },
      { kind: "pagebreak" },
    ]);
  });

  it("breaks a verses block into a title unit plus one unit per group", () => {
    const v = mk("verses", "v", {
      title: "Passages",
      groups: [
        { ref: "John 3:16", text: "16 For God" },
        { ref: "Rom 8:1", text: "1 No condemnation" },
      ],
    });
    const units = flattenToUnits([v]);
    expect(units.map((u) => u.kind)).toEqual(["verses-title", "verse-group", "verse-group"]);
    expect(units[0]).toMatchObject({ blockId: "v", title: "Passages" });
    expect(units[1]).toMatchObject({ blockId: "v", showRef: true });
  });

  it("omits the verses title unit when there is no title", () => {
    const v = mk("verses", "v", { title: "", groups: [{ ref: "A 1:1", text: "x" }] });
    expect(flattenToUnits([v]).map((u) => u.kind)).toEqual(["verse-group"]);
  });

  it("breaks a notes block into a title unit plus a parametric lines unit", () => {
    const n = mk("notes", "n", { title: "Notes", lines: 12 });
    const units = flattenToUnits([n]);
    expect(units).toEqual([
      { kind: "notes-title", blockId: "n", title: "Notes" },
      { kind: "notes-lines", blockId: "n", lines: 12 },
    ]);
  });

  it("falls back to the default line count for a titleless notes block", () => {
    const n = mk("notes", "n", { title: "", lines: 0 });
    const units = flattenToUnits([n]);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ kind: "notes-lines", blockId: "n" });
    expect((units[0] as { lines: number }).lines).toBeGreaterThan(0);
  });
});

const block = (id: string, height: number): MeasuredUnit => ({
  unit: { kind: "block", block: mk("paragraph", id) },
  height,
});

describe("packPages", () => {
  it("returns a single empty page for no units", () => {
    expect(packPages([], 100)).toEqual([[]]);
  });

  it("packs units that fit onto the same page and overflows to the next", () => {
    const pages = packPages([block("a", 30), block("b", 40), block("c", 50)], 100);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(2);
    expect(pages[1]).toHaveLength(1);
  });

  it("forces a break at a pagebreak sentinel", () => {
    const pb: MeasuredUnit = { unit: { kind: "pagebreak" }, height: 0 };
    const pages = packPages([block("a", 10), pb, block("b", 10)], 100);
    expect(pages).toHaveLength(2);
  });

  it("gives a standalone unit its own page even mid-content", () => {
    const cover = mk("cover", "cover");
    const standalone: MeasuredUnit = { unit: { kind: "standalone", block: cover }, height: 5 };
    const pages = packPages([block("a", 10), standalone, block("b", 10)], 100);
    expect(pages).toHaveLength(3);
    expect(pages[1]).toEqual([{ kind: "block", block: cover }]);
  });

  it("splits a tall line-based unit across pages", () => {
    const notes: MeasuredUnit = {
      unit: { kind: "notes-lines", blockId: "n", lines: 30 },
      height: 300,
      split: { lineHeight: 10, lines: 30 },
    };
    const pages = packPages([notes], 100);
    expect(pages).toHaveLength(3);
    for (const p of pages) {
      expect(p).toHaveLength(1);
      expect(p[0]).toMatchObject({ kind: "notes-lines", lines: 10 });
    }
  });

  it("fills the remainder of a page before splitting onto the next", () => {
    const notes: MeasuredUnit = {
      unit: { kind: "notes-lines", blockId: "n", lines: 12 },
      height: 120,
      split: { lineHeight: 10, lines: 12 },
    };
    // 50px already used -> 5 lines fit here, remaining 7 onto the next page.
    const pages = packPages([block("a", 50), notes], 100);
    expect(pages).toHaveLength(2);
    expect(pages[0][1]).toMatchObject({ kind: "notes-lines", lines: 5 });
    expect(pages[1][0]).toMatchObject({ kind: "notes-lines", lines: 7 });
  });

  it("splits a verse group by line, keeping the ref only on the first slice", () => {
    const group = { ref: "John 1:1", text: "1 a\n2 b\n3 c\n4 d" };
    const vg: MeasuredUnit = {
      unit: { kind: "verse-group", blockId: "v", group, showRef: true },
      height: 200,
      split: { lineHeight: 10, lines: 4 },
    };
    const pages = packPages([vg], 25); // 2 lines per page
    expect(pages).toHaveLength(2);
    expect(pages[0][0]).toMatchObject({ kind: "verse-group", showRef: true });
    expect((pages[0][0] as { group: { ref: string } }).group.ref).toBe("John 1:1");
    expect(pages[1][0]).toMatchObject({ kind: "verse-group", showRef: false });
    expect((pages[1][0] as { group: { ref: string } }).group.ref).toBe("");
  });

  it("flushes a nearly-full page before starting a split unit that can't fit", () => {
    const notes: MeasuredUnit = {
      unit: { kind: "notes-lines", blockId: "n", lines: 2 },
      height: 80,
      split: { lineHeight: 40, lines: 2 },
    };
    // Page is 90/100 used; no line fits, so flush first, then place both lines.
    const pages = packPages([block("a", 90), notes], 100);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(1);
    expect(pages[1][0]).toMatchObject({ kind: "notes-lines", lines: 2 });
  });

  it("forces one line per page when a single line is taller than the page", () => {
    const notes: MeasuredUnit = {
      unit: { kind: "notes-lines", blockId: "n", lines: 3 },
      height: 600,
      split: { lineHeight: 200, lines: 3 },
    };
    const pages = packPages([notes], 100);
    expect(pages).toHaveLength(3);
    for (const p of pages) expect(p[0]).toMatchObject({ kind: "notes-lines", lines: 1 });
  });

  it("places an un-splittable oversized block alone (overflow case)", () => {
    const pages = packPages([block("a", 30), block("big", 500)], 100);
    expect(pages).toHaveLength(2);
    expect(pages[1]).toEqual([{ kind: "block", block: expect.objectContaining({ id: "big" }) }]);
  });
});
