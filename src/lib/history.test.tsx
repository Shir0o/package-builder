import { describe, it, expect } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { usePackageState } from "./history";
import type { Package } from "../types";

// Tell React we are in a testing environment that supports act()
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const initialPkg: Package = {
  title: "Initial Title",
  pageNumbers: true,
  blocks: [],
};

describe("usePackageState hook", () => {
  it("manages undo and redo stacks correctly", () => {
    let hookRef: any = null;

    function TestComponent() {
      hookRef = usePackageState(initialPkg);
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    // Check initial values
    expect(hookRef.pkg).toEqual(initialPkg);
    expect(hookRef.selectedId).toBeNull();
    expect(hookRef.canUndo).toBe(false);
    expect(hookRef.canRedo).toBe(false);

    // Push discrete action
    act(() => {
      hookRef.pushState({ pkg: { ...initialPkg, title: "Title 2" }, selectedId: null }, "edit-title", false);
    });

    expect(hookRef.pkg.title).toBe("Title 2");
    expect(hookRef.canUndo).toBe(true);
    expect(hookRef.canRedo).toBe(false);

    // Undo discrete action
    act(() => {
      hookRef.undo();
    });

    expect(hookRef.pkg.title).toBe("Initial Title");
    expect(hookRef.canUndo).toBe(false);
    expect(hookRef.canRedo).toBe(true);

    // Redo discrete action
    act(() => {
      hookRef.redo();
    });

    expect(hookRef.pkg.title).toBe("Title 2");
    expect(hookRef.canUndo).toBe(true);
    expect(hookRef.canRedo).toBe(false);

    // Test continuous typing (coalescing)
    const originalDateNow = Date.now;
    let mockTime = 1000000;
    globalThis.Date.now = () => mockTime;

    // First continuous change: lastActionType is null, so it commits "Title 2" (before-state) and updates to "Title 3"
    act(() => {
      hookRef.pushState({ pkg: { ...hookRef.pkg, title: "Title 3" }, selectedId: null }, "typing-title", true);
    });

    // Second continuous change: 500ms later, same actionType. Coalesced (no history push, updates to "Title 3a")
    mockTime += 500;
    act(() => {
      hookRef.pushState({ pkg: { ...hookRef.pkg, title: "Title 3a" }, selectedId: null }, "typing-title", true);
    });

    // Third continuous change: 1500ms later, same actionType. Since >1200ms has passed, commits "Title 3a" and updates to "Title 3b"
    mockTime += 1500;
    act(() => {
      hookRef.pushState({ pkg: { ...hookRef.pkg, title: "Title 3b" }, selectedId: null }, "typing-title", true);
    });

    // Undo once: should restore "Title 3a" (the state committed on the third change)
    act(() => {
      hookRef.undo();
    });
    expect(hookRef.pkg.title).toBe("Title 3a");

    // Undo again: should restore "Title 2" (the state committed on the first change)
    act(() => {
      hookRef.undo();
    });
    expect(hookRef.pkg.title).toBe("Title 2");

    // Restore Date.now
    globalThis.Date.now = originalDateNow;

    // Test resetHistory
    act(() => {
      hookRef.resetHistory({ ...initialPkg, title: "Fresh Doc" });
    });
    expect(hookRef.pkg.title).toBe("Fresh Doc");
    expect(hookRef.canUndo).toBe(false);
    expect(hookRef.canRedo).toBe(false);

    // Clean up DOM
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("supports function initializer and function updater, and undo/redo are no-ops when stacks are empty", () => {
    let hookRef: any = null;

    function TestComponent() {
      // Function initializer (covers the lazy-init branch).
      hookRef = usePackageState(() => ({ ...initialPkg, title: "Lazy" }));
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    expect(hookRef.pkg.title).toBe("Lazy");

    // No-op paths: nothing in past/future.
    act(() => {
      hookRef.undo();
      hookRef.redo();
    });
    expect(hookRef.pkg.title).toBe("Lazy");

    // Function-updater form of pushState.
    act(() => {
      hookRef.pushState(
        (s: any) => ({ ...s, pkg: { ...s.pkg, title: "From Updater" } }),
        "edit-title",
        false,
      );
    });
    expect(hookRef.pkg.title).toBe("From Updater");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("setSelectedId resets coalescing state on change and is a no-op when unchanged", () => {
    let hookRef: any = null;

    function TestComponent() {
      hookRef = usePackageState(initialPkg);
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    const originalDateNow = Date.now;
    let mockTime = 2_000_000;
    globalThis.Date.now = () => mockTime;

    // Seed a continuous edit so coalescing refs are non-null.
    act(() => {
      hookRef.pushState(
        { pkg: { ...initialPkg, title: "A" }, selectedId: null },
        "typing-title",
        true,
      );
    });

    // Selecting a different id should clear coalescing refs, so the next
    // continuous edit of the same actionType commits a new history entry
    // even though it happens immediately after.
    act(() => {
      hookRef.setSelectedId("block-1");
    });
    expect(hookRef.selectedId).toBe("block-1");

    const undoDepthBefore = hookRef.canUndo;
    expect(undoDepthBefore).toBe(true);

    mockTime += 10;
    act(() => {
      hookRef.pushState(
        { pkg: { ...hookRef.pkg, title: "B" }, selectedId: "block-1" },
        "typing-title",
        true,
      );
    });

    // Undo should now return to "A" (the change after selection broke the coalesce).
    act(() => {
      hookRef.undo();
    });
    expect(hookRef.pkg.title).toBe("A");

    // Re-selecting the SAME id is a no-op for coalescing refs.
    act(() => {
      hookRef.setSelectedId("block-1");
    });
    expect(hookRef.selectedId).toBe("block-1");

    // Clearing selection (different id: "block-1" -> null) hits the change branch again.
    act(() => {
      hookRef.setSelectedId(null);
    });
    expect(hookRef.selectedId).toBeNull();

    globalThis.Date.now = originalDateNow;
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("replacePkg updates the package only when it actually changes", () => {
    let hookRef: any = null;

    function TestComponent() {
      hookRef = usePackageState(initialPkg);
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    const initialHookStatePkg = hookRef.pkg;
    const samePkgRef = initialHookStatePkg;

    // Call replacePkg with the exact same reference
    act(() => {
      hookRef.replacePkg(samePkgRef);
    });
    // The state object or pkg reference shouldn't change
    expect(hookRef.pkg).toBe(initialHookStatePkg);

    // Call replacePkg with a different package object
    const newPkgObj = { ...initialPkg, title: "Replaced Title" };
    act(() => {
      hookRef.replacePkg(newPkgObj);
    });
    expect(hookRef.pkg).toEqual(newPkgObj);
    expect(hookRef.pkg).not.toBe(initialHookStatePkg);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
