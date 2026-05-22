export type CoverData = {
  eyebrow: string;
  title: string;
  subtitle: string;
  dateline: string;
};

export type HeadingData = { level: 1 | 2 | 3; text: string; align: "left" | "center" };
export type ParagraphData = { text: string; align: "left" | "center" };
export type ScheduleRow = { num: string; topic: string; when: string };
export type ScheduleData = { rows: ScheduleRow[] };
export type VerseGroup = { ref: string; text: string };
export type VersesData = { title: string; groups: VerseGroup[] };
export type Stanza = { type: "verse" | "chorus"; text: string };
export type SongData = { title: string; stanzas: Stanza[] };
export type NotesData = { title: string; lines: number; autoLines?: boolean };

export type BlockTypeKey =
  | "cover"
  | "heading"
  | "paragraph"
  | "schedule"
  | "verses"
  | "song"
  | "notes"
  | "rule"
  | "pagebreak";

export type BlockDataByType = {
  cover: CoverData;
  heading: HeadingData;
  paragraph: ParagraphData;
  schedule: ScheduleData;
  verses: VersesData;
  song: SongData;
  notes: NotesData;
  rule: Record<string, never>;
  pagebreak: Record<string, never>;
};

export type Block<T extends BlockTypeKey = BlockTypeKey> = {
  id: string;
  type: T;
  data: BlockDataByType[T];
};

export type AnyBlock = { [K in BlockTypeKey]: Block<K> }[BlockTypeKey];

export type Package = {
  title: string;
  pageNumbers: boolean;
  fontSize?: number;
  blocks: AnyBlock[];
};
