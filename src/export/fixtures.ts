import type { Package } from "../types";

export const FULL_PACKAGE: Package = {
  title: "My Package",
  pageNumbers: true,
  blocks: [
    {
      id: "c",
      type: "cover",
      data: { eyebrow: "EYEBROW", title: "Title", subtitle: "Sub", dateline: "Date" },
    },
    { id: "c2", type: "cover", data: { eyebrow: "", title: "Bare", subtitle: "", dateline: "" } },
    { id: "h1", type: "heading", data: { level: 1, text: "H1", align: "left" } },
    { id: "h2", type: "heading", data: { level: 2, text: "H2", align: "center" } },
    { id: "h3", type: "heading", data: { level: 3, text: "H3", align: "left" } },
    { id: "p1", type: "paragraph", data: { text: "Some body text.", align: "left" } },
    { id: "p2", type: "paragraph", data: { text: "", align: "center" } },
    {
      id: "s",
      type: "schedule",
      data: {
        rows: [
          { num: "1", topic: "Topic A\nLine 2", when: "Mon" },
          { num: "2", topic: "", when: "Tue" },
        ],
      },
    },
    {
      id: "v",
      type: "verses",
      data: {
        title: "Lesson",
        groups: [
          { ref: "Gen 1:1", text: "1 In the beginning\n2 God created" },
          { ref: "", text: "no number here" },
        ],
      },
    },
    {
      id: "v2",
      type: "verses",
      data: { title: "", groups: [{ ref: "", text: "" }] },
    },
    {
      id: "song",
      type: "song",
      data: {
        title: "Hymn",
        stanzas: [
          { type: "verse", text: "line1\nline2" },
          { type: "chorus", text: "chorus1\nchorus2" },
        ],
      },
    },
    {
      id: "song2",
      type: "song",
      data: { title: "", stanzas: [{ type: "verse", text: "only" }] },
    },
    { id: "n", type: "notes", data: { title: "Notes", lines: 2 } },
    { id: "r", type: "rule", data: {} },
    { id: "pb", type: "pagebreak", data: {} },
  ],
};
