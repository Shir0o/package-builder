import type { ScheduleData, ScheduleRow } from "../../types";
import { Icons } from "../../icons";
import { useYText } from "../../lib/useCollabSync";
import { useYTextInput } from "../../lib/useYTextInput";

type Props = {
  blockId: string;
  data: ScheduleData;
  set: (patch: Partial<ScheduleData>) => void;
};

type RowProps = {
  blockId: string;
  index: number;
  row: ScheduleRow;
  onUpdate: (patch: Partial<ScheduleRow>) => void;
  onDelete: () => void;
};

function ScheduleRowEditor({ blockId, index, row, onUpdate, onDelete }: RowProps) {
  const numY = useYText(blockId, ["rows", index, "num"]);
  const topicY = useYText(blockId, ["rows", index, "topic"]);
  const whenY = useYText(blockId, ["rows", index, "when"]);

  const num = useYTextInput(numY, row.num, (v) => onUpdate({ num: v }));
  const topic = useYTextInput(topicY, row.topic, (v) => onUpdate({ topic: v }));
  const when = useYTextInput(whenY, row.when, (v) => onUpdate({ when: v }));

  return (
    <div className="sched-row">
      <input type="text" ref={num.ref} onChange={num.onChange} placeholder="#" />
      <textarea
        rows={2}
        style={{ minHeight: 38, fontFamily: "var(--ui-font)", fontSize: 12 }}
        ref={topic.ref}
        onChange={topic.onChange}
        placeholder="Topic — newlines allowed"
      />
      <input type="text" ref={when.ref} onChange={when.onChange} placeholder="When" />
      <button className="x" onClick={onDelete} title="Remove row">
        <Icons.Trash size={12} />
      </button>
    </div>
  );
}

export function ScheduleEditor({ blockId, data, set }: Props) {
  const update = (i: number, patch: Partial<ScheduleRow>) => {
    const rows = data.rows.slice();
    rows[i] = { ...rows[i], ...patch };
    set({ rows });
  };
  const add = () =>
    set({ rows: [...data.rows, { num: String(data.rows.length + 1), topic: "", when: "" }] });
  const del = (i: number) => set({ rows: data.rows.filter((_, j) => j !== i) });

  return (
    <div className="field">
      <label>Rows</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.rows.map((r, i) => (
          <ScheduleRowEditor
            key={i}
            blockId={blockId}
            index={i}
            row={r}
            onUpdate={(patch) => update(i, patch)}
            onDelete={() => del(i)}
          />
        ))}
      </div>
      <button
        className="btn tiny"
        style={{ marginTop: 8, alignSelf: "flex-start" }}
        onClick={add}
      >
        <Icons.Plus size={12} /> Add row
      </button>
    </div>
  );
}
