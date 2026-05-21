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

import { exportText } from "./text";
import { FULL_PACKAGE } from "./fixtures";
import type { Package } from "../types";

describe("exportText", () => {
  beforeEach(() => {
    captured.filename = undefined;
    captured.content = undefined;
  });

  it("renders every block type to plain text", () => {
    exportText(FULL_PACKAGE);
    const t = captured.content as string;
    expect(captured.filename).toBe("My_Package.txt");
    expect(t).toContain("My Package");
    expect(t).toContain("Title");
    expect(t).toContain("Sub");
    expect(t).toContain("EYEBROW");
    expect(t).toContain("Date");
    expect(t).toContain("H1");
    expect(t).toContain("H2");
    expect(t).toContain("H3");
    expect(t).toContain("Some body text.");
    expect(t).toContain("Topic A — Line 2");
    expect(t).toContain("[Mon]");
    expect(t).toContain("Lesson");
    expect(t).toContain("Gen 1:1");
    expect(t).toContain("In the beginning");
    expect(t).toContain("Hymn");
    expect(t).toContain("Notes");
    expect(t).toContain("- - -");
    expect(t).toContain("\f");
  });

  it("falls back to 'Package' when title missing", () => {
    const pkg: Package = { title: "", pageNumbers: false, blocks: [] };
    exportText(pkg);
    expect(captured.content).toContain("Package");
  });

  it("handles empty heading text in plain text export", () => {
    const pkg: Package = {
      title: "Test",
      pageNumbers: false,
      blocks: [
        { id: "h", type: "heading", data: { level: 2, text: "", align: "left" } } as any,
      ],
    };
    exportText(pkg);
    expect(captured.content).toBeDefined();
  });
});
