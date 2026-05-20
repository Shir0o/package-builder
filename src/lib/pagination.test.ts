import { describe, it, expect } from "vitest";
import { groupIntoPages } from "./pagination";
import type { AnyBlock } from "../types";

const mk = (type: AnyBlock["type"], id: string): AnyBlock =>
  ({ id, type, data: {} as never }) as AnyBlock;

describe("groupIntoPages", () => {
  it("returns a single empty page when no blocks", () => {
    expect(groupIntoPages([])).toEqual([[]]);
  });

  it("splits at pagebreak and isolates cover blocks", () => {
    const a = mk("heading", "id_a");
    const b = mk("paragraph", "id_b");
    const cover = mk("cover", "id_c");
    const d = mk("paragraph", "id_d");
    const pb = mk("pagebreak", "id_pb");
    const e = mk("paragraph", "id_e");

    const pages = groupIntoPages([a, b, cover, d, pb, e]);
    expect(pages).toEqual([[a, b], [cover], [d], [e]]);
  });

  it("ignores trailing pagebreak without creating empty page", () => {
    const a = mk("paragraph", "id_a");
    const pb = mk("pagebreak", "id_pb");
    expect(groupIntoPages([a, pb])).toEqual([[a]]);
  });
});
