import type { AnyBlock, BlockDataByType, BlockTypeKey } from "./types";

type BlockTypeDef<K extends BlockTypeKey> = {
  label: string;
  desc: string;
  create: () => BlockDataByType[K];
  summary: (d: BlockDataByType[K]) => string;
  standalonePage?: boolean;
};

type Registry = { [K in BlockTypeKey]: BlockTypeDef<K> };

export const BLOCK_TYPES: Registry = {
  cover: {
    label: "Cover",
    desc: "Title page",
    create: () => ({ eyebrow: "", title: "Untitled Package", subtitle: "", dateline: "" }),
    summary: (d) => d.title || "Untitled cover",
    standalonePage: true,
  },
  heading: {
    label: "Heading",
    desc: "H1 / H2 / H3",
    create: () => ({ level: 2, text: "Heading", align: "left" }),
    summary: (d) => `H${d.level} · ${d.text || "(empty)"}`,
  },
  paragraph: {
    label: "Body",
    desc: "Paragraph",
    create: () => ({ text: "", align: "left" }),
    summary: (d) => (d.text || "Empty paragraph").slice(0, 48),
  },
  schedule: {
    label: "Schedule",
    desc: "Numbered table",
    create: () => ({ rows: [{ num: "1", topic: "", when: "" }] }),
    summary: (d) => `${d.rows.length} row${d.rows.length === 1 ? "" : "s"}`,
  },
  verses: {
    label: "Verses",
    desc: "Bible passages",
    create: () => ({ title: "", groups: [{ ref: "", text: "" }] }),
    summary: (d) =>
      d.title ||
      d.groups[0]?.ref ||
      `${d.groups.length} verse group${d.groups.length === 1 ? "" : "s"}`,
  },
  song: {
    label: "Song",
    desc: "Verses & choruses",
    create: () => ({ title: "Untitled Song", stanzas: [{ type: "verse", text: "" }] }),
    summary: (d) => d.title || "Untitled song",
  },
  notes: {
    label: "Notes",
    desc: "Lined writing space",
    create: () => ({ title: "Notes", lines: 10 }),
    summary: (d) => `${d.title || "Notes"} · ${d.lines} lines`,
  },
  rule: {
    label: "Divider",
    desc: "Horizontal rule",
    create: () => ({}),
    summary: () => "—",
  },
  pagebreak: {
    label: "Page break",
    desc: "Start a new page",
    create: () => ({}),
    summary: () => "New page →",
    standalonePage: false,
  },
};

export const BLOCK_ORDER_FOR_PICKER: (BlockTypeKey | null)[][] = [
  ["cover", "heading"],
  ["paragraph", "verses"],
  ["song", "notes"],
  ["schedule", "rule"],
  ["pagebreak", null],
];

export function uid(): string {
  return "b_" + Math.random().toString(36).slice(2, 9);
}

export function makeBlock(type: BlockTypeKey): AnyBlock {
  return { id: uid(), type, data: BLOCK_TYPES[type].create() } as AnyBlock;
}
