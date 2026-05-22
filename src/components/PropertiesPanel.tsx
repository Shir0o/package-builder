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
    return <div className="right" />;
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
