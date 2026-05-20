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
    it("throws on a non-package shape", async () => {
      const h = makeHandle({ text: JSON.stringify({ nope: true }) });
      await expect(readPackageFromHandle(h)).rejects.toThrow(/Invalid package/);
    });
    it("throws on invalid JSON", async () => {
      const h = makeHandle({ text: "{not-json" });
      await expect(readPackageFromHandle(h)).rejects.toThrow();
    });
  });
});
