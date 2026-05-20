import { describe, it, expect, vi } from "vitest";
import { downloadBlob, safeName, escapeHtml } from "./util";

describe("safeName", () => {
  it("uses fallback when undefined or empty", () => {
    expect(safeName(undefined)).toBe("package");
    expect(safeName("")).toBe("package");
  });

  it("strips disallowed chars, collapses whitespace, truncates at 60", () => {
    expect(safeName("Hello, World! 2025")).toBe("Hello_World_2025");
    expect(safeName("  a   b  ")).toBe("a_b");
    expect(safeName("/".repeat(20))).toBe("package");
    const long = "a".repeat(80);
    expect(safeName(long)).toHaveLength(60);
  });
});

describe("escapeHtml", () => {
  it("escapes &, <, >, and \"", () => {
    expect(escapeHtml('<a href="x">&"')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&quot;");
  });

  it("leaves safe characters untouched", () => {
    expect(escapeHtml("plain text 123")).toBe("plain text 123");
  });
});

describe("downloadBlob", () => {
  it("creates a temporary anchor, clicks it, and cleans up", () => {
    vi.useFakeTimers();
    const createSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const append = vi.spyOn(document.body, "appendChild");
    const remove = vi.spyOn(document.body, "removeChild");
    const clicked: HTMLAnchorElement[] = [];
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag) as HTMLElement;
      if (tag === "a") {
        (el as HTMLAnchorElement).click = () => clicked.push(el as HTMLAnchorElement);
      }
      return el as never;
    });

    downloadBlob("f.txt", "text/plain", "hi");

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe("f.txt");
    expect(clicked[0].href).toContain("blob:fake");

    vi.advanceTimersByTime(1500);
    expect(revokeSpy).toHaveBeenCalledWith("blob:fake");
  });
});
