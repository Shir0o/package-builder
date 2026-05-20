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

import { exportJSON } from "./json";
import { FULL_PACKAGE } from "./fixtures";

describe("exportJSON", () => {
  beforeEach(() => {
    captured.filename = undefined;
    captured.mime = undefined;
    captured.content = undefined;
  });

  it("emits a .pkg.json with the package serialised", () => {
    exportJSON(FULL_PACKAGE);
    expect(captured.filename).toBe("My_Package.pkg.json");
    expect(captured.mime).toBe("application/json");
    expect(JSON.parse(captured.content as string)).toEqual(FULL_PACKAGE);
  });
});
