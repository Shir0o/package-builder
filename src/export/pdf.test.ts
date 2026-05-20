import { describe, it, expect, vi } from "vitest";
import { exportPDF } from "./pdf";

describe("exportPDF", () => {
  it("calls window.print", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    exportPDF();
    expect(print).toHaveBeenCalledTimes(1);
  });
});
