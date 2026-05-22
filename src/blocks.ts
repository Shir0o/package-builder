import type { AnyBlock, BlockDataByType, BlockTypeKey } from "./types";

export const DEFAULT_NOTES_LINES = 28;

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
    create: () => ({ title: "Notes", lines: DEFAULT_NOTES_LINES, autoLines: true }),
    summary: (d) => `${d.title || "Notes"} · ${d.autoLines !== false ? "Auto lines" : `${d.lines} lines`}`,
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

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

export function incrementString(val: string): string {
  // Capture trailing whitespace and restore it to ensure robustness
  const wsMatch = val.match(/^(.*?)(\s*)$/);
  const content = wsMatch ? wsMatch[1] : val;
  const suffix = wsMatch ? wsMatch[2] : "";

  const digitMatch = content.match(/^(.*?)(\d+)$/);
  if (digitMatch) {
    const prefix = digitMatch[1];
    const numStr = digitMatch[2];
    const nextNum = parseInt(numStr, 10) + 1;
    const paddedNum = String(nextNum).padStart(numStr.length, "0");
    return prefix + paddedNum + suffix;
  }

  const wordMatch = content.match(/^(.*?\b)([a-zA-Z]+)$/);
  if (wordMatch) {
    const prefix = wordMatch[1];
    const word = wordMatch[2];
    const lowerWord = word.toLowerCase();
    const idx = NUMBER_WORDS.indexOf(lowerWord);
    if (idx !== -1 && idx < NUMBER_WORDS.length - 1) {
      const nextWordLower = NUMBER_WORDS[idx + 1];
      let nextWord = nextWordLower;
      if (word === word.toUpperCase()) {
        nextWord = nextWordLower.toUpperCase();
      } else if (word[0] === word[0].toUpperCase()) {
        nextWord = nextWordLower.charAt(0).toUpperCase() + nextWordLower.slice(1);
      }
      return prefix + nextWord + suffix;
    }
  }

  return val;
}

export function uid(): string {
  return "b_" + Math.random().toString(36).slice(2, 9);
}

export function makeBlock(type: BlockTypeKey): AnyBlock {
  return { id: uid(), type, data: BLOCK_TYPES[type].create() } as AnyBlock;
}

export function findLastBlock<T extends BlockTypeKey>(
  blocks: AnyBlock[],
  type: T
): { id: string; type: T; data: BlockDataByType[T] } | null {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (b.type === type) {
      return b as any;
    }
  }
  return null;
}

export function predictBlockData<K extends BlockTypeKey>(type: K, blocksBefore: AnyBlock[]): BlockDataByType[K] {
  const defaultData = BLOCK_TYPES[type].create();

  if (type === "heading") {
    const prev = findLastBlock(blocksBefore, "heading");
    const prevText = prev?.data.text || "";
    if (prevText) {
      return {
        ...defaultData,
        text: incrementString(prevText),
      } as any;
    }
  } else if (type === "verses") {
    const prev = findLastBlock(blocksBefore, "verses");
    const prevTitle = prev?.data.title || "";
    if (prevTitle) {
      return {
        ...defaultData,
        title: incrementString(prevTitle),
      } as any;
    }
  } else if (type === "notes") {
    const prevHeading = findLastBlock(blocksBefore, "heading");
    const prevHeadingText = prevHeading?.data.text || "";
    if (prevHeadingText && /message/i.test(prevHeadingText)) {
      return {
        ...defaultData,
        title: `${prevHeadingText} – Notes`,
      } as any;
    }
  }

  return defaultData as any;
}

export function makeBlockWithPrediction(type: BlockTypeKey, blocksBefore: AnyBlock[]): AnyBlock {
  return {
    id: uid(),
    type,
    data: predictBlockData(type, blocksBefore),
  } as AnyBlock;
}
