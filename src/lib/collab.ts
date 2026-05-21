import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import type {
  AnyBlock,
  BlockTypeKey,
  CoverData,
  HeadingData,
  NotesData,
  Package,
  ParagraphData,
  ScheduleData,
  ScheduleRow,
  SongData,
  Stanza,
  VerseGroup,
  VersesData,
} from "../types";

const ROOM_KEY = "room";
const PKG_KEY = "pkg";
const JOIN_SEED_DELAY_MS = 1500;
const LOCAL_ORIGIN = "local";
const SEED_ORIGIN = "local-seed";

export function getRoomFromHash(): string | null {
  if (typeof location === "undefined") return null;
  const hash = location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const room = params.get(ROOM_KEY);
  return room && room.length > 0 ? room : null;
}

export function makeRoomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function makeShareUrl(roomId: string): string {
  const base = location.origin + location.pathname + location.search;
  return `${base}#${ROOM_KEY}=${encodeURIComponent(roomId)}`;
}

// ─── Yjs schema ───────────────────────────────────────────────────────────────
//
// Root: doc.getMap("pkg")
//   title       : Y.Text
//   pageNumbers : boolean (plain)
//   blocks      : Y.Array<Y.Map>
//     each block:
//       id   : string (plain)
//       type : string (plain, BlockTypeKey)
//       data : Y.Map (shape depends on type — see buildBlockData)
//
// Strings inside blocks are Y.Text so concurrent typing merges per-character.
// Inner arrays (schedule.rows, verses.groups, song.stanzas) are Y.Array<Y.Map>.
// Other primitives (numbers, enums like align/level/stanza.type) are plain.

type YPackageRoot = Y.Map<unknown>;
type YBlock = Y.Map<unknown>;
type YBlockData = Y.Map<unknown>;
type YRow = Y.Map<unknown>;

function getOrCreateText(parent: Y.Map<unknown>, key: string, initial = ""): Y.Text {
  let t = parent.get(key) as Y.Text | undefined;
  if (!(t instanceof Y.Text)) {
    t = new Y.Text(initial);
    parent.set(key, t);
  }
  return t;
}

function syncYText(yt: Y.Text, next: string) {
  const cur = yt.toString();
  if (cur === next) return;
  let s = 0;
  const minLen = Math.min(cur.length, next.length);
  while (s < minLen && cur.charCodeAt(s) === next.charCodeAt(s)) s++;
  let ec = cur.length;
  let en = next.length;
  while (ec > s && en > s && cur.charCodeAt(ec - 1) === next.charCodeAt(en - 1)) {
    ec--;
    en--;
  }
  if (ec > s) yt.delete(s, ec - s);
  if (en > s) yt.insert(s, next.slice(s, en));
}

function setIfChanged<T>(parent: Y.Map<unknown>, key: string, value: T) {
  if (parent.get(key) !== value) parent.set(key, value);
}

// ─── Snapshot: Y.Doc → Package ────────────────────────────────────────────────

export function snapshotPackage(root: YPackageRoot): Package {
  const title = (root.get("title") as Y.Text | undefined)?.toString() ?? "";
  const pageNumbers = (root.get("pageNumbers") as boolean | undefined) ?? false;
  const blocksY = root.get("blocks") as Y.Array<YBlock> | undefined;
  const blocks: AnyBlock[] = blocksY
    ? blocksY.toArray().map((b) => snapshotBlock(b)).filter((b): b is AnyBlock => b !== null)
    : [];
  return { title, pageNumbers, blocks };
}

function snapshotBlock(yb: YBlock): AnyBlock | null {
  const id = yb.get("id") as string | undefined;
  const type = yb.get("type") as BlockTypeKey | undefined;
  const data = yb.get("data") as YBlockData | undefined;
  if (!id || !type) return null;
  return { id, type, data: snapshotData(type, data) } as AnyBlock;
}

function snapshotData(type: BlockTypeKey, data: YBlockData | undefined): unknown {
  switch (type) {
    case "cover": {
      const d: CoverData = {
        eyebrow: (data?.get("eyebrow") as Y.Text | undefined)?.toString() ?? "",
        title: (data?.get("title") as Y.Text | undefined)?.toString() ?? "",
        subtitle: (data?.get("subtitle") as Y.Text | undefined)?.toString() ?? "",
        dateline: (data?.get("dateline") as Y.Text | undefined)?.toString() ?? "",
      };
      return d;
    }
    case "heading": {
      const d: HeadingData = {
        level: ((data?.get("level") as 1 | 2 | 3 | undefined) ?? 1),
        text: (data?.get("text") as Y.Text | undefined)?.toString() ?? "",
        align: (data?.get("align") as "left" | "center" | undefined) ?? "left",
      };
      return d;
    }
    case "paragraph": {
      const d: ParagraphData = {
        text: (data?.get("text") as Y.Text | undefined)?.toString() ?? "",
        align: (data?.get("align") as "left" | "center" | undefined) ?? "left",
      };
      return d;
    }
    case "schedule": {
      const rowsY = data?.get("rows") as Y.Array<YRow> | undefined;
      const rows: ScheduleRow[] = rowsY
        ? rowsY.toArray().map((r) => ({
            num: (r.get("num") as Y.Text | undefined)?.toString() ?? "",
            topic: (r.get("topic") as Y.Text | undefined)?.toString() ?? "",
            when: (r.get("when") as Y.Text | undefined)?.toString() ?? "",
          }))
        : [];
      const d: ScheduleData = { rows };
      return d;
    }
    case "verses": {
      const groupsY = data?.get("groups") as Y.Array<YRow> | undefined;
      const groups: VerseGroup[] = groupsY
        ? groupsY.toArray().map((g) => ({
            ref: (g.get("ref") as Y.Text | undefined)?.toString() ?? "",
            text: (g.get("text") as Y.Text | undefined)?.toString() ?? "",
          }))
        : [];
      const d: VersesData = {
        title: (data?.get("title") as Y.Text | undefined)?.toString() ?? "",
        groups,
      };
      return d;
    }
    case "song": {
      const stanzasY = data?.get("stanzas") as Y.Array<YRow> | undefined;
      const stanzas: Stanza[] = stanzasY
        ? stanzasY.toArray().map((st) => ({
            type: ((st.get("type") as "verse" | "chorus" | undefined) ?? "verse"),
            text: (st.get("text") as Y.Text | undefined)?.toString() ?? "",
          }))
        : [];
      const d: SongData = {
        title: (data?.get("title") as Y.Text | undefined)?.toString() ?? "",
        stanzas,
      };
      return d;
    }
    case "notes": {
      const d: NotesData = {
        title: (data?.get("title") as Y.Text | undefined)?.toString() ?? "",
        lines: (data?.get("lines") as number | undefined) ?? 0,
      };
      return d;
    }
    case "rule":
    case "pagebreak":
      return {};
  }
}

// ─── Apply: Package → Y.Doc (idempotent) ──────────────────────────────────────

export function applyPackageToYDoc(root: YPackageRoot, pkg: Package) {
  const titleY = getOrCreateText(root, "title");
  syncYText(titleY, pkg.title);
  setIfChanged(root, "pageNumbers", pkg.pageNumbers);

  let blocksY = root.get("blocks") as Y.Array<YBlock> | undefined;
  if (!blocksY) {
    blocksY = new Y.Array<YBlock>();
    root.set("blocks", blocksY);
  }
  syncBlocks(blocksY, pkg.blocks);
}

function syncBlocks(blocksY: Y.Array<YBlock>, next: AnyBlock[]) {
  const current = blocksY.toArray();
  const curIds = current.map((b) => b.get("id") as string);
  const nextIds = next.map((b) => b.id);

  const idsMatch =
    curIds.length === nextIds.length && curIds.every((id, i) => id === nextIds[i]);

  if (idsMatch) {
    for (let i = 0; i < next.length; i++) syncBlock(current[i], next[i]);
    return;
  }

  // Sequence changed — rebuild but reuse existing Y.Maps by id where possible
  // so any in-flight text edits aren't lost.
  const byId = new Map<string, YBlock>();
  for (const yb of current) byId.set(yb.get("id") as string, yb);

  blocksY.delete(0, blocksY.length);

  const fresh: YBlock[] = next.map((b) => {
    const existing = byId.get(b.id);
    if (existing) {
      syncBlock(existing, b);
      return existing;
    }
    return buildBlock(b);
  });
  blocksY.insert(0, fresh);
}

function syncBlock(yb: YBlock, b: AnyBlock) {
  setIfChanged(yb, "id", b.id);
  const curType = yb.get("type") as BlockTypeKey | undefined;
  if (curType !== b.type) {
    // Type change: replace data entirely.
    yb.set("type", b.type);
    yb.set("data", buildBlockData(b.type, b.data));
    return;
  }
  let data = yb.get("data") as YBlockData | undefined;
  if (!data) {
    data = buildBlockData(b.type, b.data);
    yb.set("data", data);
    return;
  }
  syncBlockData(b.type, data, b.data);
}

function buildBlock(b: AnyBlock): YBlock {
  const yb = new Y.Map<unknown>();
  yb.set("id", b.id);
  yb.set("type", b.type);
  yb.set("data", buildBlockData(b.type, b.data));
  return yb;
}

function buildBlockData(type: BlockTypeKey, data: unknown): YBlockData {
  const m = new Y.Map<unknown>();
  applyBlockData(type, m, data, /*fresh*/ true);
  return m;
}

function syncBlockData(type: BlockTypeKey, m: YBlockData, data: unknown) {
  applyBlockData(type, m, data, /*fresh*/ false);
}

function applyBlockData(
  type: BlockTypeKey,
  m: YBlockData,
  data: unknown,
  fresh: boolean,
) {
  switch (type) {
    case "cover": {
      const d = data as CoverData;
      syncYText(getOrCreateText(m, "eyebrow"), d.eyebrow ?? "");
      syncYText(getOrCreateText(m, "title"), d.title ?? "");
      syncYText(getOrCreateText(m, "subtitle"), d.subtitle ?? "");
      syncYText(getOrCreateText(m, "dateline"), d.dateline ?? "");
      return;
    }
    case "heading": {
      const d = data as HeadingData;
      setIfChanged(m, "level", d.level);
      syncYText(getOrCreateText(m, "text"), d.text ?? "");
      setIfChanged(m, "align", d.align);
      return;
    }
    case "paragraph": {
      const d = data as ParagraphData;
      syncYText(getOrCreateText(m, "text"), d.text ?? "");
      setIfChanged(m, "align", d.align);
      return;
    }
    case "schedule": {
      const d = data as ScheduleData;
      let rowsY = m.get("rows") as Y.Array<YRow> | undefined;
      if (!rowsY || fresh) {
        rowsY = new Y.Array<YRow>();
        m.set("rows", rowsY);
      }
      syncRowArray(rowsY, d.rows ?? [], ["num", "topic", "when"], []);
      return;
    }
    case "verses": {
      const d = data as VersesData;
      syncYText(getOrCreateText(m, "title"), d.title ?? "");
      let groupsY = m.get("groups") as Y.Array<YRow> | undefined;
      if (!groupsY || fresh) {
        groupsY = new Y.Array<YRow>();
        m.set("groups", groupsY);
      }
      syncRowArray(groupsY, d.groups ?? [], ["ref", "text"], []);
      return;
    }
    case "song": {
      const d = data as SongData;
      syncYText(getOrCreateText(m, "title"), d.title ?? "");
      let stanzasY = m.get("stanzas") as Y.Array<YRow> | undefined;
      if (!stanzasY || fresh) {
        stanzasY = new Y.Array<YRow>();
        m.set("stanzas", stanzasY);
      }
      syncRowArray(stanzasY, d.stanzas ?? [], ["text"], ["type"]);
      return;
    }
    case "notes": {
      const d = data as NotesData;
      syncYText(getOrCreateText(m, "title"), d.title ?? "");
      setIfChanged(m, "lines", d.lines);
      return;
    }
    case "rule":
    case "pagebreak":
      return;
  }
}

/**
 * Sync an array of plain-object rows into a Y.Array of Y.Maps. `textKeys`
 * are written as Y.Text (so per-char merge works). `plainKeys` are written
 * as plain values via setIfChanged. Length changes rebuild — rows have no
 * stable id so positional matching is the best we can do.
 */
function syncRowArray(
  rowsY: Y.Array<YRow>,
  rows: Record<string, unknown>[],
  textKeys: string[],
  plainKeys: string[],
) {
  if (rowsY.length !== rows.length) {
    rowsY.delete(0, rowsY.length);
    const fresh = rows.map((r) => buildRow(r, textKeys, plainKeys));
    rowsY.insert(0, fresh);
    return;
  }
  for (let i = 0; i < rows.length; i++) {
    const yr = rowsY.get(i);
    const r = rows[i];
    for (const k of textKeys) syncYText(getOrCreateText(yr, k), (r[k] as string) ?? "");
    for (const k of plainKeys) setIfChanged(yr, k, r[k]);
  }
}

function buildRow(
  r: Record<string, unknown>,
  textKeys: string[],
  plainKeys: string[],
): YRow {
  const m = new Y.Map<unknown>();
  for (const k of textKeys) m.set(k, new Y.Text((r[k] as string) ?? ""));
  for (const k of plainKeys) m.set(k, r[k]);
  return m;
}

// ─── React hook ──────────────────────────────────────────────────────────────

export function useCollabSync(
  roomId: string | null,
  pkg: Package,
  onRemote: (pkg: Package) => void,
) {
  const onRemoteRef = useRef(onRemote);
  const pkgRef = useRef(pkg);
  onRemoteRef.current = onRemote;
  pkgRef.current = pkg;

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!roomId) {
      seededRef.current = false;
      return;
    }
    const doc = new Y.Doc();
    const provider = new WebrtcProvider(roomId, doc);
    docRef.current = doc;
    providerRef.current = provider;
    seededRef.current = false;

    const root = doc.getMap(PKG_KEY) as YPackageRoot;

    const onEvents = (_events: Y.YEvent<Y.AbstractType<unknown>>[], txn: Y.Transaction) => {
      // Ignore our own local writes — React state is already current.
      if (txn.origin === LOCAL_ORIGIN || txn.origin === SEED_ORIGIN) return;
      seededRef.current = true;
      onRemoteRef.current(snapshotPackage(root));
    };
    root.observeDeep(onEvents);

    // If the room already had state when we attached, adopt it immediately.
    if (root.has("blocks") || root.has("title")) {
      seededRef.current = true;
      onRemoteRef.current(snapshotPackage(root));
    }

    // If nothing arrives within the join window, seed the doc from local pkg.
    const seedTimer = setTimeout(() => {
      if (seededRef.current) return;
      seededRef.current = true;
      doc.transact(() => {
        applyPackageToYDoc(root, pkgRef.current);
      }, SEED_ORIGIN);
    }, JOIN_SEED_DELAY_MS);

    return () => {
      clearTimeout(seedTimer);
      root.unobserveDeep(onEvents);
      provider.destroy();
      doc.destroy();
      docRef.current = null;
      providerRef.current = null;
      seededRef.current = false;
    };
  }, [roomId]);

  // Push local pkg edits into the Y.Doc. Idempotent — if Y.Doc already
  // matches, no ops fire and no observer echoes back.
  useEffect(() => {
    if (!roomId) return;
    if (!seededRef.current) return;
    const doc = docRef.current;
    if (!doc) return;
    const root = doc.getMap(PKG_KEY) as YPackageRoot;
    doc.transact(() => {
      applyPackageToYDoc(root, pkg);
    }, LOCAL_ORIGIN);
  }, [roomId, pkg]);
}
