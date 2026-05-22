import type { AnyBlock, Package } from "../types";
import { BLOCK_TYPES } from "../blocks";
import { Icons } from "../icons";
import { CoverEditor } from "./editors/CoverEditor";
import { HeadingEditor } from "./editors/HeadingEditor";
import { ParagraphEditor } from "./editors/ParagraphEditor";
import { ScheduleEditor } from "./editors/ScheduleEditor";
import { VersesEditor } from "./editors/VersesEditor";
import { SongEditor } from "./editors/SongEditor";
import { NotesEditor } from "./editors/NotesEditor";
import { useYText } from "../lib/collabContext";
import { useYTextInput } from "../lib/useYTextInput";

type Props = {
  pkg: Package;
  onPackageChange: (patch: Partial<Omit<Package, "blocks">>, isContinuous?: boolean) => void;
  block: AnyBlock | null;
  onChange: (next: AnyBlock) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
};

export function PropertiesPanel({ pkg, onPackageChange, block, onChange, onDelete, onDuplicate }: Props) {
  const titleY = useYText(null, ["title"]);
  const title = useYTextInput(titleY, pkg.title, (v) => onPackageChange({ title: v }, true));

  if (!block) {
    const currentSize = pkg.fontSize !== undefined ? pkg.fontSize : 12.5;

    return (
      <div className="right">
        <div className="panel-header">
          <div className="title">Document Settings</div>
        </div>
        <div className="panel-body">
          <div className="field">
            <label>Document Title</label>
            <input type="text" ref={title.ref} onChange={title.onChange} placeholder="Untitled Package" />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
            <input
              type="checkbox"
              id="prop-page-numbers"
              checked={!!pkg.pageNumbers}
              onChange={(e) => onPackageChange({ pageNumbers: e.target.checked }, false)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <label
              htmlFor="prop-page-numbers"
              style={{
                fontSize: 13,
                color: "var(--ink)",
                cursor: "pointer",
                userSelect: "none",
                fontFamily: "var(--main-font)"
              }}
            >
              Show Page Numbers
            </label>
          </div>

          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <label>Base Font Size</label>
              <span style={{ fontSize: 12, fontFamily: "var(--mono-font)", fontWeight: 500, color: "var(--ink)" }}>
                {currentSize}pt
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="range"
                min={9}
                max={16}
                step={0.5}
                value={currentSize}
                onChange={(e) => onPackageChange({ fontSize: parseFloat(e.target.value) }, true)}
                style={{ flex: 1, cursor: "pointer" }}
              />
              <button
                type="button"
                className="btn tiny"
                disabled={currentSize === 12.5}
                onClick={() => onPackageChange({ fontSize: 12.5 }, false)}
                style={{ flexShrink: 0 }}
              >
                Reset
              </button>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--line-2)",
              paddingTop: 16,
              marginTop: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--mono-font)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--muted)",
                marginBottom: 10,
              }}
            >
              Tip
            </div>
            <div style={{ color: "var(--ink-2)", fontSize: 12, lineHeight: 1.55 }}>
              For songs, each <b>verse</b> is auto-numbered. <b>Choruses</b> sit further indented
              and skip the number — match the printed pattern without fighting indents.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const def = BLOCK_TYPES[block.type];
  const set = (patch: object) => {
    onChange({ ...block, data: { ...(block.data as object), ...patch } } as AnyBlock);
  };

  return (
    <div className="right">
      <div className="panel-header">
        <div className="title">{def.label}</div>
        <span className="type-pill">{block.type}</span>
      </div>
      <div className="panel-body">
        {block.type === "cover" && <CoverEditor blockId={block.id} data={block.data} set={set} />}
        {block.type === "heading" && <HeadingEditor blockId={block.id} data={block.data} set={set} />}
        {block.type === "paragraph" && <ParagraphEditor blockId={block.id} data={block.data} set={set} />}
        {block.type === "schedule" && <ScheduleEditor blockId={block.id} data={block.data} set={set} />}
        {block.type === "verses" && <VersesEditor blockId={block.id} data={block.data} set={set} />}
        {block.type === "song" && <SongEditor blockId={block.id} data={block.data} set={set} />}
        {block.type === "notes" && <NotesEditor blockId={block.id} data={block.data} set={set} />}
        {(block.type === "rule" || block.type === "pagebreak") && (
          <div style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
            No options — this block has no content.
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--line-2)",
          }}
        >
          <button className="btn tiny" onClick={() => onDuplicate(block.id)}>
            <Icons.Copy size={12} /> Duplicate
          </button>
          <button
            className="btn tiny"
            style={{ color: "var(--danger)" }}
            onClick={() => onDelete(block.id)}
          >
            <Icons.Trash size={12} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}
