import { describe, it, expect, vi, beforeEach } from "vitest";

const captured: { filename?: string; content?: string } = {};

vi.mock("./util", async () => {
  const actual = await vi.importActual<typeof import("./util")>("./util");
  return {
    ...actual,
    downloadBlob: (filename: string, _mime: string, content: string) => {
      captured.filename = filename;
      captured.content = content;
    },
  };
});

import { exportMarkdown } from "./markdown";
import { FULL_PACKAGE } from "./fixtures";
import type { Package } from "../types";

describe("exportMarkdown", () => {
  beforeEach(() => {
    captured.filename = undefined;
    captured.content = undefined;
  });

  it("renders every block type", () => {
    exportMarkdown(FULL_PACKAGE);
    const md = captured.content as string;
    expect(captured.filename).toBe("My_Package.md");
    expect(md).toContain("# My Package");
    expect(md).toContain("# Title");
    expect(md).toContain("### *Sub*");
    expect(md).toContain("*EYEBROW*");
    expect(md).toContain("*Date*");
    expect(md).toContain("# H1");
    expect(md).toContain("## H2");
    expect(md).toContain("### H3");
    expect(md).toContain("Some body text.");
    expect(md).toContain("| # | Topic | When |");
    expect(md).toContain("Topic A<br/>Line 2");
    expect(md).toContain("### Lesson");
    expect(md).toContain("**Gen 1:1**");
    expect(md).toContain("> 1 In the beginning");
    expect(md).toContain("> no number here");
    expect(md).toContain("### Hymn");
    expect(md).toContain("**1.**");
    expect(md).toContain("*Chorus*");
    expect(md).toContain("### Notes");
    expect(md).toContain("_________________________________________________");
    expect(md).toContain("---");
    expect(md).toContain('page-break-after:always');
  });

  it("handles fallback package title and heading without level", () => {
    const pkg: Package = {
      title: "",
      pageNumbers: false,
      blocks: [
        { id: "h", type: "heading", data: { level: 0 as unknown as 1, text: "X", align: "left" } },
      ],
    };
    exportMarkdown(pkg);
    expect(captured.content).toContain("# Package");
    expect(captured.content).toContain("## X");
  });
});
