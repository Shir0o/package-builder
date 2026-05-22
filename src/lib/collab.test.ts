import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import {
  generateIdentity,
  getOrCreateLocalUser,
  getRoomFromHash,
  getYText,
  makeRoomId,
  makeShareUrl,
  snapshotPackage,
  applyPackageToYDoc,
  PKG_KEY,
  LOCAL_ORIGIN,
  type YPackageRoot,
} from "./collab";
import type { Package, AnyBlock } from "../types";

function freshRoot(): { doc: Y.Doc; root: YPackageRoot } {
  const doc = new Y.Doc();
  const root = doc.getMap(PKG_KEY) as YPackageRoot;
  return { doc, root };
}

function basePkg(): Package {
  return { title: "Hello", pageNumbers: true, blocks: [] };
}

describe("getRoomFromHash", () => {
  beforeEach(() => {
    history.replaceState(null, "", location.pathname + location.search);
  });

  it("returns null with no hash", () => {
    expect(getRoomFromHash()).toBeNull();
  });

  it("parses room param", () => {
    location.hash = "room=abc123";
    expect(getRoomFromHash()).toBe("abc123");
  });

  it("returns null for empty room param", () => {
    location.hash = "room=";
    expect(getRoomFromHash()).toBeNull();
  });

  it("returns null when hash exists without room key", () => {
    location.hash = "other=x";
    expect(getRoomFromHash()).toBeNull();
  });
});

describe("makeRoomId", () => {
  it("returns an adjective-noun-NNNNNN slug", () => {
    const id = makeRoomId();
    expect(id).toMatch(/^[a-z]+-[a-z]+-\d{6}$/);
  });

  it("uses URL-safe characters only", () => {
    const id = makeRoomId();
    expect(encodeURIComponent(id)).toBe(id);
  });

  it("generates mostly-unique ids in a small batch", () => {
    // 25M combinations — 50 samples should collide with negligible
    // probability (~5e-5). Allow a single collision to keep the test
    // non-flaky without weakening intent.
    const ids = new Set(Array.from({ length: 50 }, () => makeRoomId()));
    expect(ids.size).toBeGreaterThanOrEqual(49);
  });
});

describe("makeShareUrl", () => {
  it("includes the room hash", () => {
    const url = makeShareUrl("abc");
    expect(url).toContain("#room=abc");
  });

  it("encodes special chars", () => {
    expect(makeShareUrl("a b/c")).toContain("#room=a%20b%2Fc");
  });
});

describe("applyPackageToYDoc / snapshotPackage round-trip", () => {
  it("round-trips an empty package", () => {
    const { doc, root } = freshRoot();
    const pkg = basePkg();
    doc.transact(() => applyPackageToYDoc(root, pkg));
    expect(snapshotPackage(root)).toEqual(pkg);
  });

  it("round-trips a package with custom fontSize", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "Hello",
      pageNumbers: true,
      fontSize: 14.5,
      blocks: [],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg));
    expect(snapshotPackage(root)).toEqual(pkg);
  });

  it("round-trips a cover block", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "T",
      pageNumbers: false,
      blocks: [
        {
          id: "1",
          type: "cover",
          data: {
            eyebrow: "Eye",
            title: "TT",
            subtitle: "S",
            dateline: "D",
          },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg));
    expect(snapshotPackage(root)).toEqual(pkg);
  });

  it("round-trips heading + paragraph", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        { id: "h", type: "heading", data: { level: 2, text: "Hi", align: "center" } } as AnyBlock,
        { id: "p", type: "paragraph", data: { text: "Body", align: "left" } } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg));
    expect(snapshotPackage(root)).toEqual(pkg);
  });

  it("round-trips schedule rows", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        {
          id: "s",
          type: "schedule",
          data: {
            rows: [
              { num: "1", topic: "Open", when: "9am" },
              { num: "2", topic: "Close", when: "5pm" },
            ],
          },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg));
    expect(snapshotPackage(root)).toEqual(pkg);
  });

  it("round-trips verses groups", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        {
          id: "v",
          type: "verses",
          data: {
            title: "Readings",
            groups: [
              { ref: "Gen 1", text: "In the beginning" },
              { ref: "Ps 23", text: "The Lord" },
            ],
          },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg));
    expect(snapshotPackage(root)).toEqual(pkg);
  });

  it("round-trips song stanzas with type field", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        {
          id: "song",
          type: "song",
          data: {
            title: "Anthem",
            stanzas: [
              { type: "verse", text: "Verse one" },
              { type: "chorus", text: "Chorus!" },
            ],
          },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg));
    expect(snapshotPackage(root)).toEqual(pkg);
  });

  it("round-trips notes, rule, and pagebreak", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        { id: "n", type: "notes", data: { title: "Notes", lines: 5 } } as AnyBlock,
        { id: "r", type: "rule", data: {} } as AnyBlock,
        { id: "pb", type: "pagebreak", data: {} } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg));
    expect(snapshotPackage(root)).toEqual(pkg);
  });
});

describe("applyPackageToYDoc idempotency", () => {
  it("emits no observed changes on a second identical apply", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "T",
      pageNumbers: true,
      blocks: [
        { id: "p", type: "paragraph", data: { text: "Hello", align: "left" } } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);

    let events = 0;
    const listen = () => {
      events++;
    };
    root.observeDeep(listen);
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);
    root.unobserveDeep(listen);
    expect(events).toBe(0);
  });

  it("emits a minimal Y.Text delta when a string changes by one char", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        { id: "p", type: "paragraph", data: { text: "hello", align: "left" } } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);

    let observedDelta: unknown = null;
    const text = (
      (root.get("blocks") as Y.Array<Y.Map<unknown>>).get(0).get("data") as Y.Map<unknown>
    ).get("text") as Y.Text;
    text.observe((e) => {
      observedDelta = e.changes.delta;
    });

    const updated: Package = {
      ...pkg,
      blocks: [
        { id: "p", type: "paragraph", data: { text: "hellp", align: "left" } } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, updated), LOCAL_ORIGIN);

    // Expect: retain 4 chars, delete 1, insert "p" — minimal diff.
    expect(observedDelta).toEqual([
      { retain: 4 },
      { delete: 1 },
      { insert: "p" },
    ]);
  });
});

describe("applyPackageToYDoc block reuse on reorder", () => {
  it("preserves data when blocks are reordered by id", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        { id: "a", type: "paragraph", data: { text: "A", align: "left" } } as AnyBlock,
        { id: "b", type: "paragraph", data: { text: "B", align: "left" } } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);

    const swapped: Package = { ...pkg, blocks: [pkg.blocks[1], pkg.blocks[0]] };
    doc.transact(() => applyPackageToYDoc(root, swapped), LOCAL_ORIGIN);
    expect(snapshotPackage(root)).toEqual(swapped);
  });

  it("updates in place when block sequence is unchanged", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        { id: "a", type: "paragraph", data: { text: "A", align: "left" } } as AnyBlock,
        { id: "b", type: "paragraph", data: { text: "B", align: "left" } } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);

    const blocksY = root.get("blocks") as Y.Array<Y.Map<unknown>>;
    const aBefore = blocksY.get(0);

    const edited: Package = {
      ...pkg,
      blocks: [
        { id: "a", type: "paragraph", data: { text: "A!", align: "left" } } as AnyBlock,
        pkg.blocks[1],
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, edited), LOCAL_ORIGIN);

    // Same id-sequence ⇒ in-place update preserves the Y.Map identity,
    // which is what keeps inner Y.Text edits flowing without churn.
    expect(blocksY.get(0)).toBe(aBefore);
    expect(snapshotPackage(root)).toEqual(edited);
  });

  it("handles add, remove, and update in one apply", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        { id: "a", type: "paragraph", data: { text: "A", align: "left" } } as AnyBlock,
        { id: "b", type: "paragraph", data: { text: "B", align: "left" } } as AnyBlock,
        { id: "c", type: "paragraph", data: { text: "C", align: "left" } } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);

    const next: Package = {
      ...pkg,
      blocks: [
        { id: "c", type: "paragraph", data: { text: "C!", align: "left" } } as AnyBlock,
        { id: "d", type: "paragraph", data: { text: "D", align: "left" } } as AnyBlock,
        { id: "a", type: "paragraph", data: { text: "A", align: "left" } } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, next), LOCAL_ORIGIN);
    expect(snapshotPackage(root)).toEqual(next);
  });

  it("replaces data when a block's type changes", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        { id: "x", type: "paragraph", data: { text: "P", align: "left" } } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);

    const next: Package = {
      ...pkg,
      blocks: [
        { id: "x", type: "heading", data: { level: 1, text: "H", align: "center" } } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, next), LOCAL_ORIGIN);
    expect(snapshotPackage(root)).toEqual(next);
  });
});

describe("syncYText delta shapes (via applyPackageToYDoc)", () => {
  function paragraphPkg(text: string): Package {
    return {
      title: "",
      pageNumbers: true,
      blocks: [
        { id: "p", type: "paragraph", data: { text, align: "left" } } as AnyBlock,
      ],
    };
  }

  it("insert at start", () => {
    const { doc, root } = freshRoot();
    doc.transact(() => applyPackageToYDoc(root, paragraphPkg("world")), LOCAL_ORIGIN);
    const text = (
      (root.get("blocks") as Y.Array<Y.Map<unknown>>).get(0).get("data") as Y.Map<unknown>
    ).get("text") as Y.Text;
    let delta: unknown = null;
    text.observe((e) => {
      delta = e.changes.delta;
    });
    doc.transact(() => applyPackageToYDoc(root, paragraphPkg("hello world")), LOCAL_ORIGIN);
    expect(delta).toEqual([{ insert: "hello " }]);
  });

  it("delete from end", () => {
    const { doc, root } = freshRoot();
    doc.transact(() => applyPackageToYDoc(root, paragraphPkg("hello world")), LOCAL_ORIGIN);
    const text = (
      (root.get("blocks") as Y.Array<Y.Map<unknown>>).get(0).get("data") as Y.Map<unknown>
    ).get("text") as Y.Text;
    let delta: unknown = null;
    text.observe((e) => {
      delta = e.changes.delta;
    });
    doc.transact(() => applyPackageToYDoc(root, paragraphPkg("hello")), LOCAL_ORIGIN);
    expect(delta).toEqual([{ retain: 5 }, { delete: 6 }]);
  });

  it("empty to non-empty", () => {
    const { doc, root } = freshRoot();
    doc.transact(() => applyPackageToYDoc(root, paragraphPkg("")), LOCAL_ORIGIN);
    const text = (
      (root.get("blocks") as Y.Array<Y.Map<unknown>>).get(0).get("data") as Y.Map<unknown>
    ).get("text") as Y.Text;
    let delta: unknown = null;
    text.observe((e) => {
      delta = e.changes.delta;
    });
    doc.transact(() => applyPackageToYDoc(root, paragraphPkg("hi")), LOCAL_ORIGIN);
    expect(delta).toEqual([{ insert: "hi" }]);
  });
});

describe("in-place row updates (length unchanged)", () => {
  it("updates schedule rows in place", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        {
          id: "s",
          type: "schedule",
          data: {
            rows: [
              { num: "1", topic: "A", when: "9" },
              { num: "2", topic: "B", when: "10" },
            ],
          },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);
    const edited: Package = {
      ...pkg,
      blocks: [
        {
          id: "s",
          type: "schedule",
          data: {
            rows: [
              { num: "1", topic: "Aa", when: "9" },
              { num: "2", topic: "B", when: "10:30" },
            ],
          },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, edited), LOCAL_ORIGIN);
    expect(snapshotPackage(root)).toEqual(edited);
  });

  it("updates verses groups in place", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        {
          id: "v",
          type: "verses",
          data: {
            title: "Readings",
            groups: [{ ref: "Gen 1", text: "x" }],
          },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);
    const edited: Package = {
      ...pkg,
      blocks: [
        {
          id: "v",
          type: "verses",
          data: { title: "Readings", groups: [{ ref: "Gen 1:1", text: "x" }] },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, edited), LOCAL_ORIGIN);
    expect(snapshotPackage(root)).toEqual(edited);
  });

  it("updates song stanzas in place including type switch", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        {
          id: "song",
          type: "song",
          data: {
            title: "T",
            stanzas: [{ type: "verse", text: "v1" }],
          },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);
    const edited: Package = {
      ...pkg,
      blocks: [
        {
          id: "song",
          type: "song",
          data: { title: "T", stanzas: [{ type: "chorus", text: "c1" }] },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, edited), LOCAL_ORIGIN);
    expect(snapshotPackage(root)).toEqual(edited);
  });
});

describe("syncBlock recovery paths", () => {
  it("rebuilds missing data Y.Map for an existing block", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        { id: "p", type: "paragraph", data: { text: "X", align: "left" } } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);

    // Simulate a corrupted block where `data` is missing.
    const blocksY = root.get("blocks") as Y.Array<Y.Map<unknown>>;
    doc.transact(() => blocksY.get(0).delete("data"));

    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);
    expect(snapshotPackage(root)).toEqual(pkg);
  });
});

describe("snapshotPackage with empty inner data for each block type", () => {
  function rootWithBlock(type: string): YPackageRoot {
    const doc = new Y.Doc();
    const root = doc.getMap(PKG_KEY) as YPackageRoot;
    doc.transact(() => {
      const blocks = new Y.Array<Y.Map<unknown>>();
      root.set("blocks", blocks);
      const yb = new Y.Map<unknown>();
      yb.set("id", "x");
      yb.set("type", type);
      yb.set("data", new Y.Map());
      blocks.push([yb]);
    });
    return root;
  }

  it("cover with empty data falls back to empty strings", () => {
    const r = rootWithBlock("cover");
    const b = snapshotPackage(r).blocks[0] as Extract<AnyBlock, { type: "cover" }>;
    expect(b.data).toEqual({ eyebrow: "", title: "", subtitle: "", dateline: "" });
  });

  it("heading with empty data falls back to defaults", () => {
    const r = rootWithBlock("heading");
    const b = snapshotPackage(r).blocks[0] as Extract<AnyBlock, { type: "heading" }>;
    expect(b.data).toEqual({ level: 1, text: "", align: "left" });
  });

  it("paragraph with empty data falls back to defaults", () => {
    const r = rootWithBlock("paragraph");
    const b = snapshotPackage(r).blocks[0] as Extract<AnyBlock, { type: "paragraph" }>;
    expect(b.data).toEqual({ text: "", align: "left" });
  });

  it("schedule with empty data has empty rows", () => {
    const r = rootWithBlock("schedule");
    const b = snapshotPackage(r).blocks[0] as Extract<AnyBlock, { type: "schedule" }>;
    expect(b.data).toEqual({ rows: [] });
  });

  it("verses with empty data has empty groups", () => {
    const r = rootWithBlock("verses");
    const b = snapshotPackage(r).blocks[0] as Extract<AnyBlock, { type: "verses" }>;
    expect(b.data).toEqual({ title: "", groups: [] });
  });

  it("song with empty data has empty stanzas", () => {
    const r = rootWithBlock("song");
    const b = snapshotPackage(r).blocks[0] as Extract<AnyBlock, { type: "song" }>;
    expect(b.data).toEqual({ title: "", stanzas: [] });
  });

  it("notes with empty data falls back to defaults", () => {
    const r = rootWithBlock("notes");
    const b = snapshotPackage(r).blocks[0] as Extract<AnyBlock, { type: "notes" }>;
    expect(b.data).toEqual({ title: "", lines: 0 });
  });

  it("schedule rows with missing text fields snapshot as empty strings", () => {
    const doc = new Y.Doc();
    const root = doc.getMap(PKG_KEY) as YPackageRoot;
    doc.transact(() => {
      const blocks = new Y.Array<Y.Map<unknown>>();
      root.set("blocks", blocks);
      const yb = new Y.Map<unknown>();
      yb.set("id", "s");
      yb.set("type", "schedule");
      const data = new Y.Map();
      const rows = new Y.Array<Y.Map<unknown>>();
      rows.push([new Y.Map()]); // empty row with no fields
      data.set("rows", rows);
      yb.set("data", data);
      blocks.push([yb]);
    });
    const b = snapshotPackage(root).blocks[0] as Extract<AnyBlock, { type: "schedule" }>;
    expect(b.data.rows).toEqual([{ num: "", topic: "", when: "" }]);
  });

  it("verses groups with missing text fields snapshot as empty strings", () => {
    const doc = new Y.Doc();
    const root = doc.getMap(PKG_KEY) as YPackageRoot;
    doc.transact(() => {
      const blocks = new Y.Array<Y.Map<unknown>>();
      root.set("blocks", blocks);
      const yb = new Y.Map<unknown>();
      yb.set("id", "v");
      yb.set("type", "verses");
      const data = new Y.Map();
      const groups = new Y.Array<Y.Map<unknown>>();
      groups.push([new Y.Map()]);
      data.set("groups", groups);
      yb.set("data", data);
      blocks.push([yb]);
    });
    const b = snapshotPackage(root).blocks[0] as Extract<AnyBlock, { type: "verses" }>;
    expect(b.data.groups).toEqual([{ ref: "", text: "" }]);
  });

  it("song stanzas with missing fields snapshot with defaults", () => {
    const doc = new Y.Doc();
    const root = doc.getMap(PKG_KEY) as YPackageRoot;
    doc.transact(() => {
      const blocks = new Y.Array<Y.Map<unknown>>();
      root.set("blocks", blocks);
      const yb = new Y.Map<unknown>();
      yb.set("id", "song");
      yb.set("type", "song");
      const data = new Y.Map();
      const stanzas = new Y.Array<Y.Map<unknown>>();
      stanzas.push([new Y.Map()]);
      data.set("stanzas", stanzas);
      yb.set("data", data);
      blocks.push([yb]);
    });
    const b = snapshotPackage(root).blocks[0] as Extract<AnyBlock, { type: "song" }>;
    expect(b.data.stanzas).toEqual([{ type: "verse", text: "" }]);
  });
});

describe("snapshotPackage handles missing/partial Y.Doc state", () => {
  it("returns empty package shape from an empty root", () => {
    const { root } = freshRoot();
    expect(snapshotPackage(root)).toEqual({
      title: "",
      pageNumbers: false,
      blocks: [],
    });
  });

  it("skips a block missing id or type", () => {
    const { doc, root } = freshRoot();
    doc.transact(() => {
      const blocksY = new Y.Array<Y.Map<unknown>>();
      root.set("blocks", blocksY);
      const bad = new Y.Map<unknown>();
      bad.set("type", "paragraph");
      // no id
      bad.set("data", new Y.Map());
      blocksY.push([bad]);
    });
    expect(snapshotPackage(root).blocks).toEqual([]);
  });
});

describe("presence: generateIdentity / getOrCreateLocalUser", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("generateIdentity returns a non-empty name and a parseable hsl(...) color", () => {
    const id = generateIdentity();
    expect(id.name.trim().length).toBeGreaterThan(0);
    expect(id.name.split(/\s+/).length).toBeGreaterThanOrEqual(2);
    expect(id.color).toMatch(/^hsl\(\d{1,3} 70% 45%\)$/);
  });

  it("getOrCreateLocalUser persists across calls within the session", () => {
    const a = getOrCreateLocalUser();
    const b = getOrCreateLocalUser();
    expect(b).toEqual(a);
    const raw = sessionStorage.getItem("collab-identity");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual(a);
  });

  it("getOrCreateLocalUser regenerates if stored value is malformed", () => {
    sessionStorage.setItem("collab-identity", "{not json");
    const u = getOrCreateLocalUser();
    expect(typeof u.name).toBe("string");
    expect(typeof u.color).toBe("string");
  });

  it("getOrCreateLocalUser regenerates if stored value has wrong shape", () => {
    sessionStorage.setItem("collab-identity", JSON.stringify({ name: 1, color: 2 }));
    const u = getOrCreateLocalUser();
    expect(typeof u.name).toBe("string");
    expect(typeof u.color).toBe("string");
  });

  it("getOrCreateLocalUser returns a fresh identity when sessionStorage.setItem throws", () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("quota");
    };
    try {
      sessionStorage.clear();
      const u = getOrCreateLocalUser();
      expect(typeof u.name).toBe("string");
      expect(u.color).toMatch(/^hsl\(/);
    } finally {
      Storage.prototype.setItem = orig;
    }
  });
});

describe("getYText", () => {
  function seeded(): Y.Doc {
    const pkg: Package = {
      title: "Hello",
      pageNumbers: true,
      blocks: [
        { id: "p1", type: "paragraph", data: { text: "hi", align: "left" } } as AnyBlock,
        {
          id: "s1",
          type: "schedule",
          data: { rows: [{ num: "1", topic: "Open", when: "9am" }] },
        } as AnyBlock,
        {
          id: "song1",
          type: "song",
          data: { title: "Anthem", stanzas: [{ type: "verse", text: "line" }] },
        } as AnyBlock,
        {
          id: "v1",
          type: "verses",
          data: { title: "Lesson", groups: [{ ref: "John 3:16", text: "For God…" }] },
        } as AnyBlock,
        { id: "h1", type: "heading", data: { text: "Hi", level: 1, align: "left" } } as AnyBlock,
        { id: "rule1", type: "rule", data: {} } as AnyBlock,
      ],
    };
    const { doc, root } = freshRoot();
    applyPackageToYDoc(root, pkg);
    return doc;
  }

  it("returns the root title Y.Text when blockId is null", () => {
    const doc = seeded();
    const t = getYText(doc, null, ["title"]);
    expect(t?.toString()).toBe("Hello");
  });

  it("returns null for a non-text root key", () => {
    const doc = seeded();
    expect(getYText(doc, null, ["pageNumbers"])).toBeNull();
  });

  it("returns a block field by path", () => {
    const doc = seeded();
    expect(getYText(doc, "p1", ["text"])?.toString()).toBe("hi");
    expect(getYText(doc, "h1", ["text"])?.toString()).toBe("Hi");
  });

  it("returns a row Y.Text via numeric index", () => {
    const doc = seeded();
    expect(getYText(doc, "s1", ["rows", 0, "topic"])?.toString()).toBe("Open");
    expect(getYText(doc, "song1", ["stanzas", 0, "text"])?.toString()).toBe("line");
    expect(getYText(doc, "v1", ["groups", 0, "ref"])?.toString()).toBe("John 3:16");
  });

  it("accepts numeric path segments as strings", () => {
    const doc = seeded();
    expect(getYText(doc, "s1", ["rows", "0", "when"])?.toString()).toBe("9am");
  });

  it("returns null when blocks haven't been seeded", () => {
    const { doc } = freshRoot();
    expect(getYText(doc, "p1", ["text"])).toBeNull();
  });

  it("returns null for an unknown block id", () => {
    const doc = seeded();
    expect(getYText(doc, "nope", ["text"])).toBeNull();
  });

  it("returns null when the block has no data map (rule/pagebreak)", () => {
    const doc = seeded();
    // rule blocks have an empty data map — looking up a missing key is null.
    expect(getYText(doc, "rule1", ["text"])).toBeNull();
  });

  it("returns null when a path segment is missing", () => {
    const doc = seeded();
    expect(getYText(doc, "p1", ["nope"])).toBeNull();
  });

  it("returns null for an out-of-range row index", () => {
    const doc = seeded();
    expect(getYText(doc, "s1", ["rows", 99, "topic"])).toBeNull();
  });

  it("returns null when a path segment hits a non-container leaf", () => {
    const doc = seeded();
    // heading.level is a plain number — descending into it should fail.
    expect(getYText(doc, "h1", ["level", "x"])).toBeNull();
  });

  it("returns null when a numeric index is NaN", () => {
    const doc = seeded();
    expect(getYText(doc, "s1", ["rows", "abc", "topic"])).toBeNull();
  });
});

describe("LCS reconciliation identity preservation", () => {
  it("preserves surviving block Y.Map instances when blocks are added/deleted", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        { id: "a", type: "paragraph", data: { text: "A", align: "left" } } as AnyBlock,
        { id: "b", type: "paragraph", data: { text: "B", align: "left" } } as AnyBlock,
        { id: "c", type: "paragraph", data: { text: "C", align: "left" } } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);

    const blocksY = root.get("blocks") as Y.Array<Y.Map<unknown>>;
    const aMapBefore = blocksY.get(0);
    const bMapBefore = blocksY.get(1);
    const cMapBefore = blocksY.get(2);

    // Now, delete 'b' and add 'd' at the end. 'a' and 'c' should survive.
    const updated: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        { id: "a", type: "paragraph", data: { text: "A", align: "left" } } as AnyBlock,
        { id: "c", type: "paragraph", data: { text: "C", align: "left" } } as AnyBlock,
        { id: "d", type: "paragraph", data: { text: "D", align: "left" } } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, updated), LOCAL_ORIGIN);

    // Verify blocksY has 3 blocks: a, c, d
    expect(blocksY.length).toBe(3);
    // Identity of a should be preserved
    expect(blocksY.get(0)).toBe(aMapBefore);
    // Identity of c should be preserved (now at index 1)
    expect(blocksY.get(1)).toBe(cMapBefore);
    // Identity of d is new
    expect(blocksY.get(2)).not.toBe(bMapBefore);
  });

  it("preserves surviving schedule row Y.Map instances when rows are added/deleted", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        {
          id: "s",
          type: "schedule",
          data: {
            rows: [
              { num: "1", topic: "A", when: "9am" },
              { num: "2", topic: "B", when: "10am" },
              { num: "3", topic: "C", when: "11am" },
            ],
          },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);

    const blocksY = root.get("blocks") as Y.Array<Y.Map<unknown>>;
    const sBlock = blocksY.get(0);
    const rowsY = (sBlock.get("data") as Y.Map<unknown>).get("rows") as Y.Array<Y.Map<unknown>>;

    const aRowBefore = rowsY.get(0);
    const bRowBefore = rowsY.get(1);
    const cRowBefore = rowsY.get(2);

    // Update the package: delete row 'B', add row 'D' at the end. Row 'A' and 'C' should survive.
    const updated: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        {
          id: "s",
          type: "schedule",
          data: {
            rows: [
              { num: "1", topic: "A", when: "9am" },
              { num: "3", topic: "C", when: "11am" },
              { num: "4", topic: "D", when: "12pm" },
            ],
          },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, updated), LOCAL_ORIGIN);

    expect(rowsY.length).toBe(3);
    // Row A preserved
    expect(rowsY.get(0)).toBe(aRowBefore);
    // Row C preserved (now at index 1)
    expect(rowsY.get(1)).toBe(cRowBefore);
    // Row D is new
    expect(rowsY.get(2)).not.toBe(bRowBefore);
  });

  it("handles deleting rows from the end and inserting rows in the middle in schedule row reconciliation", () => {
    const { doc, root } = freshRoot();
    const pkg: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        {
          id: "s",
          type: "schedule",
          data: {
            rows: [
              { num: "1", topic: "A", when: "9am" },
              { num: "2", topic: "B", when: "10am" },
              { num: "3", topic: "C", when: "11am" },
            ],
          },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, pkg), LOCAL_ORIGIN);

    const blocksY = root.get("blocks") as Y.Array<Y.Map<unknown>>;
    const sBlock = blocksY.get(0);
    const rowsY = (sBlock.get("data") as Y.Map<unknown>).get("rows") as Y.Array<Y.Map<unknown>>;

    const aRowBefore = rowsY.get(0);
    const bRowBefore = rowsY.get(1);

    // 1. Delete rows from the end: update rows to only have A and B. C should be deleted.
    const updated1: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        {
          id: "s",
          type: "schedule",
          data: {
            rows: [
              { num: "1", topic: "A", when: "9am" },
              { num: "2", topic: "B", when: "10am" },
            ],
          },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, updated1), LOCAL_ORIGIN);

    expect(rowsY.length).toBe(2);
    expect(rowsY.get(0)).toBe(aRowBefore);
    expect(rowsY.get(1)).toBe(bRowBefore);

    // 2. Insert row in the middle: update rows to have A, X, B.
    const updated2: Package = {
      title: "",
      pageNumbers: true,
      blocks: [
        {
          id: "s",
          type: "schedule",
          data: {
            rows: [
              { num: "1", topic: "A", when: "9am" },
              { num: "99", topic: "X", when: "9:30am" },
              { num: "2", topic: "B", when: "10am" },
            ],
          },
        } as AnyBlock,
      ],
    };
    doc.transact(() => applyPackageToYDoc(root, updated2), LOCAL_ORIGIN);

    expect(rowsY.length).toBe(3);
    expect(rowsY.get(0)).toBe(aRowBefore);
    expect(rowsY.get(1).get("topic")?.toString()).toBe("X");
    expect(rowsY.get(2)).toBe(bRowBefore);
  });
});
