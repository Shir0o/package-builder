import { useCallback, useEffect, useRef, useState } from "react";
import type { AnyBlock, BlockTypeKey, Package } from "./types";
import { makeBlock, uid } from "./blocks";
import { loadPackage, savePackage } from "./lib/storage";
import { usePackageState } from "./lib/history";
import {
  isFsaSupported,
  readPackageFromHandle,
  verifyPermission,
  writePackageToHandle,
} from "./lib/fileHandle";
import { getSavedHandle, setSavedHandle } from "./lib/handleStore";
import { BlockList } from "./components/BlockList";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { DocumentPreview } from "./components/DocumentPreview";
import { Icons } from "./icons";
import { exportPDF } from "./export/pdf";
import { exportHTML } from "./export/html";
import { exportMarkdown } from "./export/markdown";
import { exportText } from "./export/text";
import { exportJSON } from "./export/json";
import { safeName } from "./export/util";

type SaveStatus = "idle" | "saving" | "saved" | "error";

declare global {
  interface Window {
    showSaveFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
  }
}

function relativeTime(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function renderSaveLabel(
  handle: FileSystemFileHandle | null,
  status: SaveStatus,
  lastSavedAt: number | null,
): string {
  if (!handle) return "saved locally";
  const name = handle.name;
  if (status === "saving") return `${name} · saving…`;
  if (status === "error") return `${name} · save failed — click to retry`;
  if (lastSavedAt) return `${name} · saved ${relativeTime(lastSavedAt)}`;
  return `${name} · linked`;
}

export default function App() {
  const {
    pkg,
    selectedId,
    setSelectedId,
    pushState,
    resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = usePackageState(loadPackage());
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  fileHandleRef.current = fileHandle;
  const firstSaveRef = useRef(true);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 1800);
  }, []);

  // Adopt previously linked file (Chromium only). queryPermission returning
  // "granted" means we can read silently — otherwise we wait for the user to
  // re-link via the button (a user gesture is required to re-prompt).
  useEffect(() => {
    if (!isFsaSupported()) return;
    let cancelled = false;
    (async () => {
      const handle = await getSavedHandle();
      if (cancelled || !handle) return;
      const h = handle as FileSystemFileHandle & {
        queryPermission?: (o: { mode: "read" | "readwrite" }) => Promise<PermissionState>;
      };
      const granted =
        !h.queryPermission || (await h.queryPermission({ mode: "readwrite" })) === "granted";
      if (!granted) {
        setFileHandle(handle);
        return;
      }
      try {
        const loaded = await readPackageFromHandle(handle);
        if (cancelled) return;
        resetHistory(loaded);
        setFileHandle(handle);
        setLastSavedAt(Date.now());
        setSaveStatus("saved");
      } catch (e) {
        console.warn("adopt handle failed", e);
        setFileHandle(handle);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced auto-save: localStorage always, file only when linked.
  useEffect(() => {
    if (firstSaveRef.current) {
      firstSaveRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      savePackage(pkg);
      const handle = fileHandleRef.current;
      if (!handle) return;
      setSaveStatus("saving");
      writePackageToHandle(handle, pkg)
        .then(() => {
          setLastSavedAt(Date.now());
          setSaveStatus("saved");
        })
        .catch((e: unknown) => {
          console.warn("file save failed", e);
          setSaveStatus("error");
          showToast("Save to file failed");
        });
    }, 400);
    return () => clearTimeout(t);
  }, [pkg, showToast]);

  // Tick the relative-time label once per minute so "saved 2m ago" updates.
  useEffect(() => {
    if (!fileHandle || lastSavedAt == null) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [fileHandle, lastSavedAt]);

  const linkFile = async () => {
    if (!isFsaSupported() || !window.showSaveFilePicker) return;
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: safeName(pkg.title) + ".pkg.json",
        types: [
          {
            description: "Package",
            accept: { "application/json": [".pkg.json", ".json"] },
          },
        ],
      });
      await writePackageToHandle(handle, pkg);
      await setSavedHandle(handle);
      setFileHandle(handle);
      setLastSavedAt(Date.now());
      setSaveStatus("saved");
      showToast(`Linked to ${handle.name}`);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      console.warn("linkFile failed", e);
      showToast("Could not link file");
    }
  };

  const openLinked = async () => {
    if (!isFsaSupported() || !window.showOpenFilePicker) return;
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: "Package",
            accept: { "application/json": [".pkg.json", ".json"] },
          },
        ],
        multiple: false,
      });
      if (!(await verifyPermission(handle, "readwrite"))) {
        showToast("Permission denied");
        return;
      }
      const loaded = await readPackageFromHandle(handle);
      await setSavedHandle(handle);
      resetHistory(loaded);
      setFileHandle(handle);
      setLastSavedAt(Date.now());
      setSaveStatus("saved");
      showToast(`Opened ${handle.name}`);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      console.warn("openLinked failed", e);
      showToast("Could not open file");
    }
  };

  const unlinkFile = async () => {
    await setSavedHandle(null);
    setFileHandle(null);
    setSaveStatus("idle");
    setLastSavedAt(null);
    showToast("Unlinked file");
  };

  const retrySave = async () => {
    const handle = fileHandleRef.current;
    if (!handle) return;
    if (!(await verifyPermission(handle, "readwrite"))) {
      showToast("Permission denied");
      return;
    }
    setSaveStatus("saving");
    try {
      await writePackageToHandle(handle, pkg);
      setLastSavedAt(Date.now());
      setSaveStatus("saved");
    } catch (e) {
      console.warn("retry save failed", e);
      setSaveStatus("error");
      showToast("Save to file failed");
    }
  };

  const updateBlock = (next: AnyBlock) => {
    pushState(
      (s) => ({
        ...s,
        pkg: {
          ...s.pkg,
          blocks: s.pkg.blocks.map((b) => (b.id === next.id ? next : b)),
        },
      }),
      `edit-block-${next.id}`,
      true // is continuous
    );
  };
  const deleteBlock = (id: string) => {
    pushState(
      (s) => ({
        pkg: {
          ...s.pkg,
          blocks: s.pkg.blocks.filter((b) => b.id !== id),
        },
        selectedId: s.selectedId === id ? null : s.selectedId,
      }),
      `delete-block-${id}`,
      false
    );
  };
  const duplicateBlock = (id: string) => {
    pushState(
      (s) => {
        const idx = s.pkg.blocks.findIndex((b) => b.id === id);
        if (idx < 0) return s;
        const orig = s.pkg.blocks[idx];
        const copy = {
          ...orig,
          id: uid(),
          data: JSON.parse(JSON.stringify(orig.data)),
        } as AnyBlock;
        const blocks = s.pkg.blocks.slice();
        blocks.splice(idx + 1, 0, copy);
        return {
          pkg: { ...s.pkg, blocks },
          selectedId: copy.id,
        };
      },
      `duplicate-block-${id}`,
      false
    );
  };
  const moveBlock = (from: number, to: number) => {
    pushState(
      (s) => {
        const blocks = s.pkg.blocks.slice();
        const [m] = blocks.splice(from, 1);
        blocks.splice(to, 0, m);
        return {
          ...s,
          pkg: { ...s.pkg, blocks },
        };
      },
      `move-block-${from}-${to}`,
      false
    );
  };
  const addBlock = (type: BlockTypeKey) => {
    const newB = makeBlock(type) as AnyBlock;
    pushState(
      (s) => {
        const idx = s.selectedId
          ? s.pkg.blocks.findIndex((b) => b.id === s.selectedId)
          : -1;
        const blocks = s.pkg.blocks.slice();
        if (idx >= 0) blocks.splice(idx + 1, 0, newB);
        else blocks.push(newB);
        return {
          pkg: { ...s.pkg, blocks },
          selectedId: newB.id,
        };
      },
      `add-block-${type}`,
      false
    );
  };
  const setTitle = (title: string) => {
    pushState(
      (s) => ({
        ...s,
        pkg: { ...s.pkg, title },
      }),
      "edit-title",
      true // is continuous
    );
  };

  const newPackage = () => {
    if (
      !confirm(
        "Start a fresh package? Your current one will be replaced (export first if you want to keep it).",
      )
    )
      return;
    resetHistory({
      title: "Untitled Package",
      pageNumbers: true,
      blocks: [makeBlock("cover") as AnyBlock],
    });
  };

  const loadFromFile = () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json,.json";
    inp.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(String(ev.target?.result)) as Package;
          if (parsed && parsed.blocks) {
            resetHistory(parsed);
            showToast("Loaded package");
          }
        } catch (err) {
          alert("Could not parse file: " + (err as Error).message);
        }
      };
      reader.readAsText(file);
    };
    inp.click();
  };

  const selected = pkg.blocks.find((b) => b.id === selectedId) || null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;

      // Intercept undo/redo globally (even inside inputs)
      if (e.metaKey || e.ctrlKey) {
        const keyLower = e.key.toLowerCase();
        if (keyLower === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        } else if (keyLower === "y") {
          e.preventDefault();
          redo();
          return;
        }
      }

      if (t && t.matches && t.matches("input, textarea, select")) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        exportPDF();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIdRef.current) {
          e.preventDefault();
          deleteBlock(selectedIdRef.current);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  return (
    <div
      className={`app${leftCollapsed ? " left-collapsed" : ""}${selected ? "" : " right-hidden"}`}
    >
      <header className="topbar">
        <div className="brand">
          <div className="mark">P</div>
          <span>Package Builder</span>
        </div>
        <div className="pkg-title-wrap">
          <input
            className="pkg-title"
            value={pkg.title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Package"
          />
          {saveStatus === "error" ? (
            <button
              type="button"
              className="meta"
              onClick={retrySave}
              style={{
                cursor: "pointer",
                color: "#c0392b",
                background: "none",
                border: "none",
                padding: 0,
                font: "inherit",
              }}
            >
              {pkg.blocks.length} blocks ·{" "}
              {renderSaveLabel(fileHandle, saveStatus, lastSavedAt)}
            </button>
          ) : (
            <span className="meta">
              {pkg.blocks.length} blocks ·{" "}
              {renderSaveLabel(fileHandle, saveStatus, lastSavedAt)}
            </span>
          )}
        </div>
        <div className="actions">
          <button
            className="btn ghost tiny icon"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
          >
            <Icons.Undo size={14} />
          </button>
          <button
            className="btn ghost tiny icon"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
          >
            <Icons.Redo size={14} />
          </button>
          <div style={{ width: 1, height: 18, background: "var(--line)", margin: "0 4px" }} />
          <button className="btn ghost tiny" onClick={newPackage}>
            New
          </button>
          <button className="btn ghost tiny" onClick={loadFromFile}>
            Open…
          </button>
          {isFsaSupported() && !fileHandle && (
            <button className="btn ghost tiny" onClick={linkFile}>
              Link file…
            </button>
          )}
          {isFsaSupported() && !fileHandle && (
            <button className="btn ghost tiny" onClick={openLinked}>
              Open linked…
            </button>
          )}
          {fileHandle && (
            <button className="btn ghost tiny" onClick={unlinkFile}>
              Unlink
            </button>
          )}
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--muted)",
              padding: "0 8px",
            }}
          >
            <input
              type="checkbox"
              checked={!!pkg.pageNumbers}
              onChange={(e) =>
                pushState(
                  (s) => ({
                    ...s,
                    pkg: { ...s.pkg, pageNumbers: e.target.checked },
                  }),
                  "toggle-page-numbers",
                  false
                )
              }
            />
            Page #s
          </label>
          <div className="menu-wrap">
            <button className="btn" onClick={() => setMenuOpen((o) => !o)}>
              <Icons.Down2 size={13} /> Export <Icons.Chevron size={12} />
            </button>
            {menuOpen && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                  onClick={() => setMenuOpen(false)}
                />
                <div className="menu">
                  <div
                    className="item"
                    onClick={() => {
                      exportPDF();
                      setMenuOpen(false);
                    }}
                  >
                    <Icons.Print size={14} /> Print / Save as PDF
                    <span className="kbd">⌘P</span>
                  </div>
                  <div className="sep" />
                  <div
                    className="item"
                    onClick={() => {
                      exportHTML(pkg);
                      setMenuOpen(false);
                      showToast("Downloaded HTML");
                    }}
                  >
                    <Icons.Doc size={14} /> Standalone HTML
                  </div>
                  <div
                    className="item"
                    onClick={() => {
                      exportMarkdown(pkg);
                      setMenuOpen(false);
                      showToast("Downloaded Markdown");
                    }}
                  >
                    <Icons.Doc size={14} /> Markdown (.md)
                  </div>
                  <div
                    className="item"
                    onClick={() => {
                      exportText(pkg);
                      setMenuOpen(false);
                      showToast("Downloaded Text");
                    }}
                  >
                    <Icons.Doc size={14} /> Plain text (.txt)
                  </div>
                  <div className="sep" />
                  <div
                    className="item"
                    onClick={() => {
                      exportJSON(pkg);
                      setMenuOpen(false);
                      showToast("Downloaded package source");
                    }}
                  >
                    <Icons.Doc size={14} /> Package source (.json)
                  </div>
                </div>
              </>
            )}
          </div>
          <button className="btn primary" onClick={exportPDF}>
            <Icons.Print size={13} /> Print
          </button>
        </div>
      </header>

      <BlockList
        pkg={pkg}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onMove={moveBlock}
        onDelete={deleteBlock}
        onDuplicate={duplicateBlock}
        onAdd={addBlock}
      />

      <button
        className="panel-toggle left-toggle"
        onClick={() => setLeftCollapsed((c) => !c)}
        title={leftCollapsed ? "Show blocks panel" : "Hide blocks panel"}
      >
        <Icons.Chevron size={12} />
      </button>

      <main className="center" onClick={() => setSelectedId(null)}>
        <div className="paper-stack">
          <DocumentPreview
            pkg={pkg}
            selectedId={selectedId}
            onSelectBlock={setSelectedId}
            interactive
          />
        </div>
      </main>

      <PropertiesPanel
        block={selected}
        onChange={updateBlock}
        onDelete={deleteBlock}
        onDuplicate={duplicateBlock}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
