import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
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
import { ShareModal } from "./components/ShareModal";
import { Icons } from "./icons";
import {
  getRoomFromHash,
  getYText,
  makeRoomId,
  makeShareUrl,
} from "./lib/collab";
import type { ConnectionStatus, Peer } from "./lib/collab";
import { CollabContext } from "./lib/collabContext";
import type { CollabPresence } from "./lib/useCollabSync";
import type * as UseCollabSyncModule from "./lib/useCollabSync";
import { useYTextInput } from "./lib/useYTextInput";
import { exportPDF } from "./export/pdf";
import { exportHTML } from "./export/html";
import { exportMarkdown } from "./export/markdown";
import { exportText } from "./export/text";
import { exportJSON } from "./export/json";
import {
  PACKAGE_ACCEPT_EXTENSIONS,
  PACKAGE_EXTENSION,
  PACKAGE_MIME,
  safeName,
} from "./export/util";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type UseCollabSyncMod = typeof UseCollabSyncModule;

const SOLO_PRESENCE: CollabPresence = {
  doc: null,
  peers: [],
  localUser: { name: "", color: "" },
  status: "disconnected",
  undo: () => {},
  redo: () => {},
  canUndo: false,
  canRedo: false,
};

/**
 * Dynamically load the collab connection layer (y-webrtc + y-indexeddb +
 * UndoManager + awareness) when the user enters a room. The chunk is
 * code-split out of the main bundle and fetched only on first share.
 */
function useUseCollabSyncModule(roomId: string | null): UseCollabSyncMod | null {
  const [mod, setMod] = useState<UseCollabSyncMod | null>(null);
  useEffect(() => {
    if (!roomId) {
      setMod(null);
      return;
    }
    let cancelled = false;
    import("./lib/useCollabSync").then((m) => {
      if (!cancelled) setMod(m);
    });
    return () => {
      cancelled = true;
    };
  }, [roomId]);
  return mod;
}

/**
 * Mounted only when the connection-layer module has loaded and a roomId is
 * active. Calls the module's hook (so it can run unconditionally inside)
 * and lifts the returned presence object into App via onPresence.
 */
function CollabBridge({
  module,
  roomId,
  pkg,
  onRemote,
  selectedId,
  onPresence,
}: {
  module: UseCollabSyncMod;
  roomId: string;
  pkg: Package;
  onRemote: (pkg: Package) => void;
  selectedId: string | null;
  onPresence: (p: CollabPresence) => void;
}) {
  const presence = module.useCollabSync(roomId, pkg, onRemote, selectedId);
  useEffect(() => {
    onPresence(presence);
  }, [presence, onPresence]);
  return null;
}

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

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;

export default function App() {
  const {
    pkg,
    selectedId,
    setSelectedId,
    pushState,
    resetHistory,
    replacePkg,
    undo: localUndo,
    redo: localRedo,
    canUndo: localCanUndo,
    canRedo: localCanRedo,
  } = usePackageState(loadPackage);
  const [roomId, setRoomId] = useState<string | null>(() => getRoomFromHash());
  const isCollab = roomId !== null;
  const collabSyncModule = useUseCollabSyncModule(roomId);
  const [collabPresence, setCollabPresence] = useState<CollabPresence>(SOLO_PRESENCE);
  const {
    doc: collabDoc,
    peers,
    status: collabStatus,
    undo: collabUndo,
    redo: collabRedo,
    canUndo: collabCanUndo,
    canRedo: collabCanRedo,
  } = collabPresence;
  // Reset presence to solo defaults whenever the room is cleared so peers
  // / undo state from the previous session don't linger.
  useEffect(() => {
    if (!roomId) setCollabPresence(SOLO_PRESENCE);
  }, [roomId]);
  const undo = isCollab ? collabUndo : localUndo;
  const redo = isCollab ? collabRedo : localRedo;
  const canUndo = isCollab ? collabCanUndo : localCanUndo;
  const canRedo = isCollab ? collabCanRedo : localCanRedo;
  useEffect(() => {
    const onHash = () => setRoomId(getRoomFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const centerRef = useRef<HTMLElement | null>(null);
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
        suggestedName: safeName(pkg.title) + PACKAGE_EXTENSION,
        types: [
          {
            description: "Package",
            accept: { [PACKAGE_MIME]: [...PACKAGE_ACCEPT_EXTENSIONS] },
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
            accept: { [PACKAGE_MIME]: [...PACKAGE_ACCEPT_EXTENSIONS] },
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

  const [shareOpen, setShareOpen] = useState(false);

  const startShare = () => {
    const id = makeRoomId();
    location.hash = `room=${id}`;
    setRoomId(id);
    setShareOpen(true);
  };

  const copyShareLink = async () => {
    if (!roomId) return;
    const url = makeShareUrl(roomId);
    try {
      await navigator.clipboard.writeText(url);
      showToast("Share link copied");
    } catch {
      showToast(`Share link: ${url}`);
    }
  };

  const leaveShare = () => {
    history.replaceState(null, "", location.pathname + location.search);
    setRoomId(null);
    setShareOpen(false);
    showToast("Left shared session");
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

  const updateBlock = useCallback((next: AnyBlock) => {
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
  }, [pushState]);

  const deleteBlock = useCallback((id: string) => {
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
  }, [pushState]);

  const duplicateBlock = useCallback((id: string) => {
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
  }, [pushState]);

  const moveBlock = useCallback((from: number, to: number) => {
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
  }, [pushState]);

  const addBlock = useCallback((type: BlockTypeKey) => {
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
  }, [pushState]);

  const setTitle = useCallback((title: string) => {
    pushState(
      (s) => ({
        ...s,
        pkg: { ...s.pkg, title },
      }),
      "edit-title",
      true // is continuous
    );
  }, [pushState]);

  const newPackage = useCallback(() => {
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
  }, [resetHistory]);

  const loadFromFile = () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = [PACKAGE_MIME, ...PACKAGE_ACCEPT_EXTENSIONS].join(",");
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

  const titleYText = collabDoc ? getYText(collabDoc, null, ["title"]) : null;
  const titleBinding = useYTextInput(titleYText, pkg.title, setTitle);

  const clampZoom = useCallback(
    (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)),
    [],
  );
  const stepZoom = useCallback(
    (delta: number) =>
      setZoom((z) => clampZoom(Math.round((z + delta) * 100) / 100)),
    [clampZoom],
  );
  const resetZoom = useCallback(() => setZoom(1), []);
  const fitWidth = useCallback(() => {
    const el = centerRef.current;
    if (!el) return;
    // 8.5in paper + 0.85in left/right margins; .center has 24px horiz padding.
    const paperPx = 8.5 * 96;
    const available = el.clientWidth - 48;
    setZoom(clampZoom(available / paperPx));
  }, [clampZoom]);

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
        } else if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          stepZoom(0.1);
          return;
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          stepZoom(-0.1);
          return;
        } else if (e.key === "0") {
          e.preventDefault();
          resetZoom();
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
  }, [undo, redo, stepZoom, resetZoom, deleteBlock]);

  // Cmd/Ctrl + wheel zoom on the document area.
  useEffect(() => {
    const el = centerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      // Trackpad pinch-zoom in Chrome sends ctrlKey + small deltaY values.
      const delta = -e.deltaY * 0.0025;
      setZoom((z) => clampZoom(Math.round((z + delta) * 100) / 100));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clampZoom]);

  return (
    <CollabContext.Provider value={collabDoc}>
    <div
      className={`app${leftCollapsed ? " left-collapsed" : ""}${selected ? "" : " right-hidden"}`}
      style={{ "--zoom": zoom } as CSSProperties & Record<string, string | number>}
    >
      <header className="topbar">
        <div className="brand">
          <div className="mark">P</div>
          <span>Package Builder</span>
        </div>
        <div className="pkg-title-wrap">
          <input
            className="pkg-title"
            ref={titleBinding.ref}
            onChange={titleBinding.onChange}
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
          {!isCollab ? (
            <button className="btn ghost tiny" onClick={startShare} title="Start a live shared session">
              Share…
            </button>
          ) : (
            <>
              <PresenceIndicator status={collabStatus} peers={peers} />
              <button
                type="button"
                className="share-pill"
                onClick={() => setShareOpen(true)}
                title="Open share details"
              >
                Sharing · {peers.length} {peers.length === 1 ? "peer" : "peers"}
              </button>
            </>
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
        peers={isCollab ? peers : []}
      />

      <button
        className="panel-toggle left-toggle"
        onClick={() => setLeftCollapsed((c) => !c)}
        title={leftCollapsed ? "Show blocks panel" : "Hide blocks panel"}
      >
        <Icons.Chevron size={12} />
      </button>

      <main
        className="center"
        ref={centerRef}
        onClick={() => setSelectedId(null)}
      >
        <div className="paper-stack">
          <DocumentPreview
            pkg={pkg}
            selectedId={selectedId}
            onSelectBlock={setSelectedId}
            interactive
            peers={isCollab ? peers : []}
          />
        </div>
      </main>

      <div className="zoom-bar" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => stepZoom(-0.1)}
          disabled={zoom <= ZOOM_MIN + 0.001}
          title="Zoom out (⌘−)"
        >
          <Icons.Minus size={13} />
        </button>
        <button
          type="button"
          className="level"
          onClick={resetZoom}
          title="Reset to 100% (⌘0)"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => stepZoom(0.1)}
          disabled={zoom >= ZOOM_MAX - 0.001}
          title="Zoom in (⌘+)"
        >
          <Icons.Plus size={13} />
        </button>
        <div className="sep" />
        <button type="button" onClick={fitWidth} title="Fit width">
          <Icons.Maximize size={13} />
        </button>
      </div>

      <PropertiesPanel
        block={selected}
        onChange={updateBlock}
        onDelete={deleteBlock}
        onDuplicate={duplicateBlock}
      />

      {toast && <div className="toast">{toast}</div>}

      {shareOpen && roomId && (
        <ShareModal
          url={makeShareUrl(roomId)}
          peerCount={peers.length}
          status={collabStatus}
          onCopy={copyShareLink}
          onStop={leaveShare}
          onClose={() => setShareOpen(false)}
        />
      )}

      {collabSyncModule && roomId && (
        <CollabBridge
          module={collabSyncModule}
          roomId={roomId}
          pkg={pkg}
          onRemote={replacePkg}
          selectedId={selectedId}
          onPresence={setCollabPresence}
        />
      )}
    </div>
    </CollabContext.Provider>
  );
}

function PresenceIndicator({
  status,
  peers,
}: {
  status: ConnectionStatus;
  peers: Peer[];
}) {
  const statusLabel =
    status === "disconnected"
      ? "Disconnected"
      : status === "alone"
        ? "Connected — waiting for peers"
        : `Connected · ${peers.length} peer${peers.length === 1 ? "" : "s"}`;
  const MAX_PILLS = 5;
  const shown = peers.slice(0, MAX_PILLS);
  const overflow = peers.length - shown.length;
  return (
    <div className="presence" title={statusLabel}>
      <span className={`presence-dot presence-dot-${status}`} aria-hidden="true" />
      <span className="presence-count" aria-label={statusLabel}>
        {peers.length}
      </span>
      <div className="presence-pills">
        {shown.map((p) => (
          <span
            key={p.clientId}
            className="presence-pill"
            style={{ background: p.user.color }}
            title={p.user.name}
            aria-label={p.user.name}
          >
            {peerInitials(p.user.name)}
          </span>
        ))}
        {overflow > 0 && (
          <span
            className="presence-pill presence-pill-overflow"
            title={`+${overflow} more`}
          >
            +{overflow}
          </span>
        )}
      </div>
    </div>
  );
}

function peerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] || "?").toUpperCase();
}
