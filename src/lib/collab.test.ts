import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { applyPackageToYDoc, snapshotPackage, syncYText } from "./collab";
import type { AnyBlock, Package } from "../types";

function makePkg(blocks: AnyBlock[] = []): Package {
  return { title: "Test", pageNumbers: true, blocks };
}

function freshRoot(): { doc: Y.Doc; root: Y.Map<unknown> } {
  const doc = new Y.Doc();
  const root = doc.getMap("pkg");
  return { doc, root };
}

/** Capture the delta of every observer event into a flat array. The deltas
 *  are read synchronously inside the observer so they reflect the change
 *  rather than the post-transaction state. */
function captureDeltas(t: Y.Text): {
  deltas: unknown[][];
  unobserve: () => void;
} {
  const deltas: unknown[][] = [];
  const fn = (e: Y.YTextEvent) => deltas.push(e.delta);
  t.observe(fn);
  return { deltas, unobserve: () => t.unobserve(fn) };
}

describe("syncYText", () => {
  it("inserts into an empty text", () => {
    const doc = new Y.Doc();
    const t = doc.getText("t");
    doc.transact(() => syncYText(t, "hello"));
    expect(t.toString()).toBe("hello");
  });

  it("is a no-op when current equals next (no events fire)", () => {
    const doc = new Y.Doc();
    const t = doc.getText("t");
    t.insert(0, "hello");
    const { deltas } = captureDeltas(t);
    doc.transact(() => syncYText(t, "hello"));
    expect(deltas).toEqual([]);
    expect(t.toString()).toBe("hello");
  });

  it("inserts in the middle without rewriting prefix/suffix", () => {
    const doc = new Y.Doc();
    const t = doc.getText("t");
    t.insert(0, "abcfgh");
    const { deltas } = captureDeltas(t);
    doc.transact(() => syncYText(t, "abcdefgh"));
    expect(t.toString()).toBe("abcdefgh");
    expect(deltas).toEqual([[{ retain: 3 }, { insert: "de" }]]);
  });

  it("deletes from the middle without rewriting prefix/suffix", () => {
    const doc = new Y.Doc();
    const t = doc.getText("t");
    t.insert(0, "abcXYZdef");
    const { deltas } = captureDeltas(t);
    doc.transact(() => syncYText(t, "abcdef"));
    expect(t.toString()).toBe("abcdef");
    expect(deltas).toEqual([[{ retain: 3 }, { delete: 3 }]]);
  });

  it("replaces middle as a single delete+insert in one transaction", () => {
    const doc = new Y.Doc();
    const t = doc.getText("t");
    t.insert(0, "abcXYZdef");
    const { deltas } = captureDeltas(t);
    doc.transact(() => syncYText(t, "abc123def"));
    expect(t.toString()).toBe("abc123def");
    expect(deltas).toEqual([
      [{ retain: 3 }, { delete: 3 }, { insert: "123" }],
    ]);
  });
});

describe("snapshotPackage / applyPackageToYDoc round-trip", () => {
  it("round-trips a package across every block type", () => {
    const pkg: Package = {
      title: "Title",
      pageNumbers: true,
      blocks: [
        {
          id: "c1",
          type: "cover",
          data: { eyebrow: "Eye", title: "T", subtitle: "S", dateline: "D" },
        },
        { id: "h1", type: "heading", data: { level: 2, text: "Heading", align: "center" } },
        { id: "p1", type: "paragraph", data: { text: "Body text", align: "left" } },
        {
          id: "s1",
          type: "schedule",
          data: {
            rows: [
              { num: "1", topic: "Welcome", when: "9:00" },
              { num: "2", topic: "Session", when: "9:15" },
            ],
          },
        },
        {
          id: "v1",
          type: "verses",
          data: {
            title: "Readings",
            groups: [{ ref: "Jn 3:16", text: "For God so loved…" }],
          },
        },
        {
          id: "so1",
          type: "song",
          data: {
            title: "Hymn",
            stanzas: [
              { type: "verse", text: "verse one" },
              { type: "chorus", text: "chorus one" },
            ],
          },
        },
        { id: "n1", type: "notes", data: { title: "Notes", lines: 5 } },
        { id: "r1", type: "rule", data: {} },
        { id: "pb1", type: "pagebreak", data: {} },
      ],
    };
    const { root } = freshRoot();
    applyPackageToYDoc(root, pkg);
    const snap = snapshotPackage(root);
    expect(snap).toEqual(pkg);
  });
});

describe("applyPackageToYDoc idempotency", () => {
  it("a second apply with the same package produces zero observer events", () => {
    const pkg = makePkg([
      { id: "h1", type: "heading", data: { level: 1, text: "Hi", align: "left" } },
      { id: "p1", type: "paragraph", data: { text: "Body", align: "left" } },
      {
        id: "s1",
        type: "schedule",
        data: { rows: [{ num: "1", topic: "x", when: "y" }] },
      },
    ]);
    const { doc, root } = freshRoot();
    applyPackageToYDoc(root, pkg);

    let eventCount = 0;
    const listener = (events: unknown[]) => {
      eventCount += events.length;
    };
    root.observeDeep(listener);

    doc.transact(() => {
      applyPackageToYDoc(root, pkg);
    });

    expect(eventCount).toBe(0);
    expect(snapshotPackage(root)).toEqual(pkg);
  });
});

describe("syncBlocks in-place edits preserve Y.Map identity", () => {
  it("reuses the same Y.Map and Y.Text for unchanged-position blocks", () => {
    // When `next` has the same ids in the same order, syncBlocks should
    // mutate Y.Maps in place rather than rebuild — so any in-progress
    // text typing keeps its Y.Text identity and incoming peer edits merge.
    const pkg = makePkg([
      { id: "a", type: "paragraph", data: { text: "A", align: "left" } },
      { id: "b", type: "paragraph", data: { text: "B", align: "left" } },
    ]);
    const { root } = freshRoot();
    applyPackageToYDoc(root, pkg);

    const blocksY = root.get("blocks") as Y.Array<Y.Map<unknown>>;
    const yBlockB = blocksY.get(1);
    const yTextB = (yBlockB.get("data") as Y.Map<unknown>).get("text") as Y.Text;

    // Apply the same package with an updated B text (as if the user typed).
    const next = makePkg([
      pkg.blocks[0],
      { id: "b", type: "paragraph", data: { text: "B!", align: "left" } },
    ]);
    applyPackageToYDoc(root, next);

    const blocksAfter = (root.get("blocks") as Y.Array<Y.Map<unknown>>).toArray();
    expect(blocksAfter[1]).toBe(yBlockB);
    expect((blocksAfter[1].get("data") as Y.Map<unknown>).get("text")).toBe(yTextB);
    expect(yTextB.toString()).toBe("B!");
  });
});

describe("syncBlocks reorder preserves text content", () => {
  it("a reorder keeps each block's text by id at its new position", () => {
    const pkg = makePkg([
      { id: "a", type: "paragraph", data: { text: "Alpha", align: "left" } },
      { id: "b", type: "paragraph", data: { text: "Bravo", align: "left" } },
      { id: "c", type: "paragraph", data: { text: "Charlie", align: "left" } },
    ]);
    const { root } = freshRoot();
    applyPackageToYDoc(root, pkg);

    // Reorder: c, a, b.
    const reordered = makePkg([pkg.blocks[2], pkg.blocks[0], pkg.blocks[1]]);
    applyPackageToYDoc(root, reordered);

    const snap = snapshotPackage(root);
    expect(snap.blocks.map((b) => b.id)).toEqual(["c", "a", "b"]);
    expect(snap).toEqual(reordered);
  });
});
