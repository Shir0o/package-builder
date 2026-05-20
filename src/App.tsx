import { useCallback, useEffect, useRef, useState } from "react";
import type { AnyBlock, BlockTypeKey, Package } from "./types";
import { makeBlock, uid } from "./blocks";
import { loadPackage, savePackage } from "./lib/storage";
import { BlockList } from "./components/BlockList";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { DocumentPreview } from "./components/DocumentPreview";
import { Icons } from "./icons";
import { exportPDF } from "./export/pdf";
import { exportHTML } from "./export/html";
import { exportMarkdown } from "./export/markdown";
import { exportText } from "./export/text";
import { exportJSON } from "./export/json";

export default function App() {
  const [pkg, setPkg] = useState<Package>(loadPackage);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    savePackage(pkg);
  }, [pkg]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 1800);
  }, []);

  const updateBlock = (next: AnyBlock) => {
    setPkg((p) => ({
      ...p,
      blocks: p.blocks.map((b) => (b.id === next.id ? next : b)),
    }));
  };
  const deleteBlock = (id: string) => {
    setPkg((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id) }));
    if (selectedIdRef.current === id) setSelectedId(null);
  };
  const duplicateBlock = (id: string) => {
    setPkg((p) => {
      const idx = p.blocks.findIndex((b) => b.id === id);
      if (idx < 0) return p;
      const orig = p.blocks[idx];
      const copy = {
        ...orig,
        id: uid(),
        data: JSON.parse(JSON.stringify(orig.data)),
      } as AnyBlock;
      const blocks = p.blocks.slice();
      blocks.splice(idx + 1, 0, copy);
      setTimeout(() => setSelectedId(copy.id), 0);
      return { ...p, blocks };
    });
  };
  const moveBlock = (from: number, to: number) => {
    setPkg((p) => {
      const blocks = p.blocks.slice();
      const [m] = blocks.splice(from, 1);
      blocks.splice(to, 0, m);
      return { ...p, blocks };
    });
  };
  const addBlock = (type: BlockTypeKey) => {
    const newB = makeBlock(type) as AnyBlock;
    setPkg((p) => {
      const idx = selectedIdRef.current
        ? p.blocks.findIndex((b) => b.id === selectedIdRef.current)
        : -1;
      const blocks = p.blocks.slice();
      if (idx >= 0) blocks.splice(idx + 1, 0, newB);
      else blocks.push(newB);
      return { ...p, blocks };
    });
    setSelectedId(newB.id);
  };
  const setTitle = (title: string) => setPkg((p) => ({ ...p, title }));

  const newPackage = () => {
    if (
      !confirm(
        "Start a fresh package? Your current one will be replaced (export first if you want to keep it).",
      )
    )
      return;
    setPkg({
      title: "Untitled Package",
      pageNumbers: true,
      blocks: [makeBlock("cover") as AnyBlock],
    });
    setSelectedId(null);
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
            setPkg(parsed);
            setSelectedId(null);
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
  }, []);

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
          <span className="meta">{pkg.blocks.length} blocks · auto-saved</span>
        </div>
        <div className="actions">
          <button className="btn ghost tiny" onClick={newPackage}>
            New
          </button>
          <button className="btn ghost tiny" onClick={loadFromFile}>
            Open…
          </button>
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
                setPkg((p) => ({ ...p, pageNumbers: e.target.checked }))
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
        <div className="paper-stack" onClick={(e) => e.stopPropagation()}>
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
