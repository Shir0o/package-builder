import { afterEach, vi } from "vitest";

if (typeof URL.createObjectURL !== "function") {
  // jsdom doesn't implement these; stub for downloadBlob.
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () =>
    "blob:mock";
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});
