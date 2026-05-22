import { describe, it, expect, vi } from "vitest";
import { loadPackage, savePackage } from "./storage";
import { SEED_PACKAGE } from "../seed";

const KEY = "package_builder_v1";

describe("storage", () => {
  it("returns a deep clone of the seed when storage is empty", () => {
    const pkg = loadPackage();
    expect(pkg).toEqual(SEED_PACKAGE);
    expect(pkg).not.toBe(SEED_PACKAGE);
    expect(pkg.blocks).not.toBe(SEED_PACKAGE.blocks);
  });

  it("round-trips through savePackage / loadPackage", () => {
    const pkg = { title: "X", pageNumbers: false, fontSize: 13.5, blocks: [] };
    savePackage(pkg);
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual(pkg);
    expect(loadPackage()).toEqual(pkg);
  });

  it("falls back to seed when stored JSON is corrupt", () => {
    localStorage.setItem(KEY, "{not-json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(loadPackage()).toEqual(SEED_PACKAGE);
    expect(warn).toHaveBeenCalled();
  });

  it("warns when localStorage.setItem throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    savePackage({ title: "", pageNumbers: true, blocks: [] });
    expect(warn).toHaveBeenCalled();
    setItem.mockRestore();
  });
});
