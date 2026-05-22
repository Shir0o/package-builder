import { describe, it, expect, vi } from "vitest";
import {
  isFsaSupported,
  verifyPermission,
  writePackageToHandle,
  readPackageFromHandle,
} from "./fileHandle";
import type { Package } from "../types";

function makeWritableMock() {
  const chunks: string[] = [];
  return {
    chunks,
    write: vi.fn(async (data: string) => {
      chunks.push(data);
    }),
    close: vi.fn(async () => {}),
  };
}

function makeHandle(opts: {
  text?: string;
  writable?: ReturnType<typeof makeWritableMock>;
  query?: PermissionState;
  request?: PermissionState;
  noPerm?: boolean;
}) {
  const writable = opts.writable ?? makeWritableMock();
  const handle: Record<string, unknown> = {
    name: "test.pkg.json",
    createWritable: vi.fn(async () => writable),
    getFile: vi.fn(async () => ({
      text: async () => opts.text ?? "",
    })),
  };
  if (!opts.noPerm) {
    handle.queryPermission = vi.fn(async () => opts.query ?? "granted");
    handle.requestPermission = vi.fn(async () => opts.request ?? "granted");
  }
  return handle as unknown as FileSystemFileHandle;
}

const PKG: Package = { title: "X", pageNumbers: true, blocks: [] };

describe("fileHandle", () => {
  describe("isFsaSupported", () => {
    it("returns false when showSaveFilePicker is missing", () => {
      expect(isFsaSupported()).toBe(false);
    });
    it("returns true when showSaveFilePicker is present", () => {
      vi.stubGlobal("window", {
        ...window,
        showSaveFilePicker: () => undefined,
      });
      expect(isFsaSupported()).toBe(true);
      vi.unstubAllGlobals();
    });
  });

  describe("verifyPermission", () => {
    it("returns true immediately when permission is already granted", async () => {
      const h = makeHandle({ query: "granted" });
      expect(await verifyPermission(h)).toBe(true);
    });
    it("requests permission when not yet granted", async () => {
      const h = makeHandle({ query: "prompt", request: "granted" });
      expect(await verifyPermission(h, "read")).toBe(true);
    });
    it("returns false when request is denied", async () => {
      const h = makeHandle({ query: "prompt", request: "denied" });
      expect(await verifyPermission(h)).toBe(false);
    });
    it("returns true when permission API is unavailable", async () => {
      const h = makeHandle({ noPerm: true });
      expect(await verifyPermission(h)).toBe(true);
    });
  });

  describe("writePackageToHandle", () => {
    it("serializes package and closes the writable", async () => {
      const writable = makeWritableMock();
      const h = makeHandle({ writable });
      await writePackageToHandle(h, PKG);
      expect(writable.chunks).toEqual([JSON.stringify(PKG, null, 2)]);
      expect(writable.close).toHaveBeenCalled();
    });
  });

  describe("readPackageFromHandle", () => {
    it("parses a valid package", async () => {
      const h = makeHandle({ text: JSON.stringify(PKG) });
      expect(await readPackageFromHandle(h)).toEqual(PKG);
    });
    it("parses a package with a valid block", async () => {
      const pkg: Package = {
        title: "Y",
        pageNumbers: true,
        blocks: [
          { id: "a", type: "cover", data: {} } as unknown as Package["blocks"][number],
        ],
      };
      const h = makeHandle({ text: JSON.stringify(pkg) });
      expect(await readPackageFromHandle(h)).toEqual(pkg);
    });
    it("throws when the top-level shape is wrong", async () => {
      const h = makeHandle({ text: JSON.stringify({ nope: true }) });
      await expect(readPackageFromHandle(h)).rejects.toThrow(/Invalid package/);
    });
    it("throws when title is missing", async () => {
      const h = makeHandle({
        text: JSON.stringify({ pageNumbers: true, blocks: [] }),
      });
      await expect(readPackageFromHandle(h)).rejects.toThrow(/Invalid package/);
    });
    it("throws when pageNumbers is the wrong type", async () => {
      const h = makeHandle({
        text: JSON.stringify({ title: "X", pageNumbers: "yes", blocks: [] }),
      });
      await expect(readPackageFromHandle(h)).rejects.toThrow(/Invalid package/);
    });
    it("parses a package with a valid fontSize", async () => {
      const pkg: Package = {
        title: "X",
        pageNumbers: true,
        fontSize: 14.5,
        blocks: [],
      };
      const h = makeHandle({ text: JSON.stringify(pkg) });
      expect(await readPackageFromHandle(h)).toEqual(pkg);
    });
    it("throws when fontSize is the wrong type", async () => {
      const h = makeHandle({
        text: JSON.stringify({ title: "X", pageNumbers: true, fontSize: "12pt", blocks: [] }),
      });
      await expect(readPackageFromHandle(h)).rejects.toThrow(/Invalid package/);
    });
    it("throws when a block is malformed", async () => {
      const h = makeHandle({
        text: JSON.stringify({
          title: "X",
          pageNumbers: true,
          blocks: [{ id: "a", type: "cover" }],
        }),
      });
      await expect(readPackageFromHandle(h)).rejects.toThrow(/Invalid package/);
    });
    it("throws when blocks is not an array", async () => {
      const h = makeHandle({
        text: JSON.stringify({
          title: "X",
          pageNumbers: true,
          blocks: "not-an-array",
        }),
      });
      await expect(readPackageFromHandle(h)).rejects.toThrow(/Invalid package/);
    });
    it("throws on null", async () => {
      const h = makeHandle({ text: "null" });
      await expect(readPackageFromHandle(h)).rejects.toThrow(/Invalid package/);
    });
    it("throws on invalid JSON", async () => {
      const h = makeHandle({ text: "{not-json" });
      await expect(readPackageFromHandle(h)).rejects.toThrow();
    });
  });
});
