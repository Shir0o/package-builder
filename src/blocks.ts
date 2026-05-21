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
    create: () => ({ title: "Notes", lines: 28 }),
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

export function incrementString(val: string): string {
  const digitMatch = val.match(/^(.*?)(\d+)$/);
  if (digitMatch) {
    const prefix = digitMatch[1];
    const numStr = digitMatch[2];
    const nextNum = parseInt(numStr, 10) + 1;
    const paddedNum = String(nextNum).padStart(numStr.length, "0");
    return prefix + paddedNum;
  }

  const wordMatch = val.match(/^(.*?\b)([a-zA-Z]+)$/);
  if (wordMatch) {
    const prefix = wordMatch[1];
    const word = wordMatch[2];
    const lowerWord = word.toLowerCase();
    const numberWords = [
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
    const idx = numberWords.indexOf(lowerWord);
    if (idx !== -1 && idx < numberWords.length - 1) {
      const nextWordLower = numberWords[idx + 1];
      let nextWord = nextWordLower;
      if (word === word.toUpperCase()) {
        nextWord = nextWordLower.toUpperCase();
      } else if (word[0] === word[0].toUpperCase()) {
        nextWord = nextWordLower.charAt(0).toUpperCase() + nextWordLower.slice(1);
      }
      return prefix + nextWord;
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

export function predictBlockData<K extends BlockTypeKey>(type: K, blocksBefore: AnyBlock[]): BlockDataByType[K] {
  const defaultData = BLOCK_TYPES[type].create();
  if (type === "heading") {
    let prevText = "";
    for (let i = blocksBefore.length - 1; i >= 0; i--) {
      const b = blocksBefore[i];
      if (b.type === "heading") {
        prevText = b.data.text || "";
        break;
      }
    }
    if (prevText) {
      return {
        ...defaultData,
        text: incrementString(prevText),
      } as any;
    }
  } else if (type === "verses") {
    let prevTitle = "";
    for (let i = blocksBefore.length - 1; i >= 0; i--) {
      const b = blocksBefore[i];
      if (b.type === "verses") {
        prevTitle = b.data.title || "";
        break;
      }
    }
    if (prevTitle) {
      return {
        ...defaultData,
        title: incrementString(prevTitle),
      } as any;
    }
  } else if (type === "notes") {
    let prevHeadingText = "";
    for (let i = blocksBefore.length - 1; i >= 0; i--) {
      const b = blocksBefore[i];
      if (b.type === "heading") {
        prevHeadingText = b.data.text || "";
        break;
      }
    }
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
