import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { AnyBlock, BlockTypeKey, Package } from "../types";
import { BLOCK_ORDER_FOR_PICKER, BLOCK_TYPES } from "../blocks";
import { Icons } from "../icons";
import type { Peer } from "../lib/collab";

type Props = {
  pkg: Package;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAdd: (type: BlockTypeKey) => void;
  peers?: Peer[];
};

export function BlockList({
  pkg,
  selectedId,
  onSelect,
  onMove,
  onDelete,
  onDuplicate,
  onAdd,
  peers = [],
}: Props) {
  // First peer per block keeps the UI calm even if two peers select the
  // same block — the second one just doesn't get a badge.
  const editorsByBlock = useMemo(() => {
    const m = new Map<string, Peer>();
    const blockIds = new Set(pkg.blocks.map((b) => b.id));
    for (const p of peers) {
      if (
        p.selectedBlockId &&
        blockIds.has(p.selectedBlockId) &&
        !m.has(p.selectedBlockId)
      ) {
        m.set(p.selectedBlockId, p);
      }
    }
    return m;
  }, [peers, pkg.blocks]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  return (
    <div className="left">
      <div className="section-header">
        <span>Blocks · {pkg.blocks.length}</span>
      </div>
      <div className="block-list">
        {pkg.blocks.length === 0 && (
          <div className="empty-state">
            No blocks yet.
            <br />
            Add one below.
          </div>
        )}
        {pkg.blocks.map((b: AnyBlock, i) => {
          const def = BLOCK_TYPES[b.type];
          const editor = editorsByBlock.get(b.id);
          return (
            <div
              key={b.id}
              className={
                "block-row" +
                (selectedId === b.id ? " selected" : "") +
                (overIdx === i ? " over" : "") +
                (editor ? " peer-editing" : "")
              }
              draggable
              onDragStart={(e) => {
                setDragIdx(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIdx(i);
              }}
              onDragLeave={() => setOverIdx(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== i) onMove(dragIdx, i);
                setDragIdx(null);
                setOverIdx(null);
              }}
              onClick={() => onSelect(b.id)}
              style={{
                ...(overIdx === i && dragIdx !== null && dragIdx !== i
                  ? { borderTopColor: "var(--accent)" }
                  : {}),
                ...(editor
                  ? ({ ["--peer-color"]: editor.user.color } as CSSProperties)
                  : {}),
              }}
            >
              <div className="drag" title="Drag to reorder">
                <Icons.Drag size={12} />
              </div>
              <div className="num">{i + 1}</div>
              <div className="label">
                <span className="type">{def.label}</span>
                {(def.summary as (d: AnyBlock["data"]) => string)(b.data)}
                {editor && (
                  <span
                    className="peer-editing-badge"
                    style={{ background: editor.user.color }}
                    title={`${editor.user.name} is editing`}
                  >
                    {editor.user.name} editing
                  </span>
                )}
              </div>
              <div className="actions">
                <button
                  title="Move up"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (i > 0) onMove(i, i - 1);
                  }}
                >
                  <Icons.Up size={12} />
                </button>
                <button
                  title="Move down"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (i < pkg.blocks.length - 1) onMove(i, i + 1);
                  }}
                >
                  <Icons.Down size={12} />
                </button>
                <button
                  title="Duplicate"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(b.id);
                  }}
                >
                  <Icons.Copy size={12} />
                </button>
                <button
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(b.id);
                  }}
                >
                  <Icons.Trash size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <BlockPicker onAdd={onAdd} />
    </div>
  );
}

function BlockPicker({ onAdd }: { onAdd: (type: BlockTypeKey) => void }) {
  return (
    <div className="add-block">
      <div className="add-block-header">
        <Icons.Plus size={12} />
        <span>Add a block</span>
      </div>
      <div className="add-block-grid">
        {BLOCK_ORDER_FOR_PICKER.flat().map((t, i) => {
          if (!t) return <div key={i} />;
          const def = BLOCK_TYPES[t];
          return (
            <button key={t} onClick={() => onAdd(t)} title={def.desc}>
              <span className="h">{def.label}</span>
              <span className="d">{def.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
