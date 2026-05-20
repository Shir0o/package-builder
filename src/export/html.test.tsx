import { describe, it, expect, vi, beforeEach } from "vitest";

const captured: { filename?: string; mime?: string; content?: string } = {};

vi.mock("./util", async () => {
  const actual = await vi.importActual<typeof import("./util")>("./util");
  return {
    ...actual,
    downloadBlob: (filename: string, mime: string, content: string) => {
      captured.filename = filename;
      captured.mime = mime;
      captured.content = content;
    },
  };
});

import { exportHTML } from "./html";
import { FULL_PACKAGE } from "./fixtures";
import type { Package } from "../types";

describe("exportHTML", () => {
  beforeEach(() => {
    captured.filename = undefined;
    captured.mime = undefined;
    captured.content = undefined;
  });

  it("produces a complete HTML document with package contents", () => {
    exportHTML(FULL_PACKAGE);
    const html = captured.content as string;
    expect(captured.filename).toBe("My_Package.html");
    expect(captured.mime).toBe("text/html;charset=utf-8");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>My Package</title>");
    expect(html).toContain("<style>");
    expect(html).toContain("class=\"paper\"");
  });

  it("escapes the title and falls back when title is empty", () => {
    const pkg: Package = { title: "<x>&\"", pageNumbers: false, blocks: [] };
    exportHTML(pkg);
    expect(captured.content).toContain("<title>&lt;x&gt;&amp;&quot;</title>");

    const empty: Package = { title: "", pageNumbers: false, blocks: [] };
    exportHTML(empty);
    expect(captured.content).toContain("<title>Package</title>");
  });
});
