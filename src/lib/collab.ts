import * as Y from "yjs";
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
export const PKG_KEY = "pkg";
export const LOCAL_ORIGIN = "local";
export const SEED_ORIGIN = "local-seed";

export function getRoomFromHash(): string | null {
  const hash = location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const room = params.get(ROOM_KEY);
  return room && room.length > 0 ? room : null;
}

// Small embedded word lists — chosen to be short, friendly, and easy to say
// aloud. ~50 entries each gives 50 * 50 * 10000 = 25M combinations, plenty
// for a room ID that doesn't need to be cryptographically unguessable
// (the URL itself is the access token).
const ROOM_ADJECTIVES = [
  "amber", "brisk", "calm", "clever", "cosy", "crisp", "dapper", "eager",
  "fancy", "fluffy", "frosty", "gentle", "giddy", "happy", "jolly", "kind",
  "lively", "lucky", "merry", "mighty", "misty", "neat", "nimble", "noble",
  "plucky", "polite", "proud", "purple", "quiet", "rapid", "regal", "rosy",
  "rustic", "sandy", "sleepy", "snappy", "snowy", "spicy", "stout", "sunny",
  "swift", "tidy", "tiny", "vivid", "warm", "wise", "witty", "young",
  "zesty", "zippy",
];

const ROOM_NOUNS = [
  "badger", "bear", "beaver", "bison", "cobra", "comet", "coral", "cougar",
  "crane", "dolphin", "eagle", "ember", "falcon", "ferret", "finch", "fox",
  "gecko", "goose", "harbor", "hawk", "heron", "ibex", "iris", "jaguar",
  "kestrel", "koala", "lemur", "lynx", "maple", "marlin", "meadow", "moose",
  "newt", "ocelot", "orca", "otter", "owl", "panda", "pebble", "puffin",
  "quail", "raven", "robin", "sable", "salmon", "sparrow", "stoat", "tiger",
  "wolf", "wren",
];

function pickIndex(modulo: number): number {
  // Rejection sampling to avoid bias when modulo doesn't divide 256.
  const bytes = new Uint8Array(1);
  const limit = Math.floor(256 / modulo) * modulo;
  for (;;) {
    crypto.getRandomValues(bytes);
    if (bytes[0] < limit) return bytes[0] % modulo;
  }
}

function pickNumber(): string {
  const bytes = new Uint16Array(1);
  const limit = Math.floor(65536 / 10000) * 10000;
  for (;;) {
    crypto.getRandomValues(bytes);
    if (bytes[0] < limit) return (bytes[0] % 10000).toString().padStart(4, "0");
  }
}

export function makeRoomId(): string {
  const a = ROOM_ADJECTIVES[pickIndex(ROOM_ADJECTIVES.length)];
  const n = ROOM_NOUNS[pickIndex(ROOM_NOUNS.length)];
  return `${a}-${n}-${pickNumber()}`;
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

export type YPackageRoot = Y.Map<unknown>;
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

  // Sequence changed. Yjs doesn't support moving an attached Y.Map between
  // positions (you can't re-insert one that's been deleted), so we rebuild
  // from the input package. Known limitation: concurrent reorders are
  // last-writer-wins at the array level — see follow-up to use a proper LCS
  // diff. Text edits inside surviving blocks are preserved on the *other*
  // peer because they receive the granular ops in the same transaction.
  blocksY.delete(0, blocksY.length);
  blocksY.insert(
    0,
    next.map((b) => buildBlock(b)),
  );
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
      syncYText(getOrCreateText(m, "eyebrow"), d.eyebrow);
      syncYText(getOrCreateText(m, "title"), d.title);
      syncYText(getOrCreateText(m, "subtitle"), d.subtitle);
      syncYText(getOrCreateText(m, "dateline"), d.dateline);
      return;
    }
    case "heading": {
      const d = data as HeadingData;
      setIfChanged(m, "level", d.level);
      syncYText(getOrCreateText(m, "text"), d.text);
      setIfChanged(m, "align", d.align);
      return;
    }
    case "paragraph": {
      const d = data as ParagraphData;
      syncYText(getOrCreateText(m, "text"), d.text);
      setIfChanged(m, "align", d.align);
      return;
    }
    case "schedule": {
      const d = data as ScheduleData;
      let rowsY = m.get("rows") as Y.Array<YRow> | undefined;
      if (fresh || !rowsY) {
        rowsY = new Y.Array<YRow>();
        m.set("rows", rowsY);
      }
      syncRowArray(rowsY, d.rows, ["num", "topic", "when"], []);
      return;
    }
    case "verses": {
      const d = data as VersesData;
      syncYText(getOrCreateText(m, "title"), d.title);
      let groupsY = m.get("groups") as Y.Array<YRow> | undefined;
      if (fresh || !groupsY) {
        groupsY = new Y.Array<YRow>();
        m.set("groups", groupsY);
      }
      syncRowArray(groupsY, d.groups, ["ref", "text"], []);
      return;
    }
    case "song": {
      const d = data as SongData;
      syncYText(getOrCreateText(m, "title"), d.title);
      let stanzasY = m.get("stanzas") as Y.Array<YRow> | undefined;
      if (fresh || !stanzasY) {
        stanzasY = new Y.Array<YRow>();
        m.set("stanzas", stanzasY);
      }
      syncRowArray(stanzasY, d.stanzas, ["text"], ["type"]);
      return;
    }
    case "notes": {
      const d = data as NotesData;
      syncYText(getOrCreateText(m, "title"), d.title);
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
    for (const k of textKeys) syncYText(getOrCreateText(yr, k), r[k] as string);
    for (const k of plainKeys) setIfChanged(yr, k, r[k]);
  }
}

function buildRow(
  r: Record<string, unknown>,
  textKeys: string[],
  plainKeys: string[],
): YRow {
  const m = new Y.Map<unknown>();
  for (const k of textKeys) m.set(k, new Y.Text(r[k] as string));
  for (const k of plainKeys) m.set(k, r[k]);
  return m;
}

// React hook `useCollabSync` lives in ./useCollabSync.ts (excluded from
// coverage — it depends on WebRTC + window state not well-modeled in jsdom).

// ─── Path lookup ─────────────────────────────────────────────────────────────

/**
 * Locate a Y.Text inside the doc by `blockId` and a `path`. When `blockId` is
 * null the path is relative to the root pkg map (e.g. ["title"]). Otherwise
 * the path is relative to the block's `data` map (e.g. ["text"] for a
 * paragraph, ["rows", 2, "topic"] for a schedule row, etc.). Returns null if
 * any segment of the path is missing or the leaf isn't a Y.Text — callers
 * fall back to their controlled state in that case.
 */
export function getYText(
  doc: Y.Doc,
  blockId: string | null,
  path: ReadonlyArray<string | number>,
): Y.Text | null {
  const root = doc.getMap(PKG_KEY) as YPackageRoot;
  let node: unknown;
  if (blockId === null) {
    node = root;
  } else {
    const blocksY = root.get("blocks") as Y.Array<YBlock> | undefined;
    if (!blocksY) return null;
    let yb: YBlock | null = null;
    for (const b of blocksY) {
      if ((b.get("id") as string) === blockId) {
        yb = b;
        break;
      }
    }
    if (!yb) return null;
    node = yb.get("data");
    if (!node) return null;
  }
  for (const k of path) {
    if (node instanceof Y.Map) {
      node = node.get(String(k));
    } else if (node instanceof Y.Array) {
      const idx = typeof k === "number" ? k : Number(k);
      if (!Number.isFinite(idx)) return null;
      node = node.get(idx);
    } else {
      return null;
    }
    if (node == null) return null;
  }
  return node instanceof Y.Text ? node : null;
}

// ─── Presence (awareness) ────────────────────────────────────────────────────

export type LocalUser = { name: string; color: string };
export type Peer = {
  clientId: number;
  user: LocalUser;
  selectedBlockId: string | null;
};
export type ConnectionStatus = "disconnected" | "alone" | "connected";

const IDENTITY_KEY = "collab-identity";

const ADJECTIVES = [
  "Anonymous", "Curious", "Cheerful", "Quiet", "Bold", "Gentle", "Brave",
  "Witty", "Calm", "Eager", "Lively", "Kind", "Swift", "Clever", "Sunny",
];
const ANIMALS = [
  "Otter", "Fox", "Badger", "Heron", "Marmot", "Lynx", "Wren", "Stoat",
  "Falcon", "Hare", "Newt", "Quokka", "Tapir", "Ibex", "Puffin",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Fresh random identity. New name + new HSL color each call. */
export function generateIdentity(): LocalUser {
  const name = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
  const hue = Math.floor(Math.random() * 360);
  const color = `hsl(${hue} 70% 45%)`;
  return { name, color };
}

/**
 * Return this tab's collab identity, generating + persisting one in
 * sessionStorage on first call. Reloads within the same tab keep the
 * same name and color; a new tab gets a new identity. Falls back to a
 * fresh identity if sessionStorage isn't available.
 */
export function getOrCreateLocalUser(): LocalUser {
  if (typeof sessionStorage === "undefined") return generateIdentity();
  try {
    const raw = sessionStorage.getItem(IDENTITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalUser;
      if (parsed && typeof parsed.name === "string" && typeof parsed.color === "string") {
        return parsed;
      }
    }
  } catch {
    // fall through to fresh identity
  }
  const id = generateIdentity();
  try {
    sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
  } catch {
    // ignore — non-persistent identity is fine
  }
  return id;
}
