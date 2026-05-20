import type { AnyBlock } from "../types";
import { BLOCK_TYPES } from "../blocks";
import { Icons } from "../icons";
import { CoverEditor } from "./editors/CoverEditor";
import { HeadingEditor } from "./editors/HeadingEditor";
import { ParagraphEditor } from "./editors/ParagraphEditor";
import { ScheduleEditor } from "./editors/ScheduleEditor";
import { VersesEditor } from "./editors/VersesEditor";
import { SongEditor } from "./editors/SongEditor";
import { NotesEditor } from "./editors/NotesEditor";

type Props = {
  block: AnyBlock | null;
  onChange: (next: AnyBlock) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
};

export function PropertiesPanel({ block, onChange, onDelete, onDuplicate }: Props) {
  if (!block) {
    return (
      <div className="right">
        <div className="panel-header">
          <div className="title">No selection</div>
        </div>
        <div className="panel-body">
          <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Pick a block from the left, or click any element in the preview to edit it.
          </div>
          <div
            style={{
              borderTop: "1px solid var(--line-2)",
              paddingTop: 16,
              marginTop: 8,
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
        {block.type === "cover" && <CoverEditor data={block.data} set={set} />}
        {block.type === "heading" && <HeadingEditor data={block.data} set={set} />}
        {block.type === "paragraph" && <ParagraphEditor data={block.data} set={set} />}
        {block.type === "schedule" && <ScheduleEditor data={block.data} set={set} />}
        {block.type === "verses" && <VersesEditor data={block.data} set={set} />}
        {block.type === "song" && <SongEditor data={block.data} set={set} />}
        {block.type === "notes" && <NotesEditor data={block.data} set={set} />}
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
