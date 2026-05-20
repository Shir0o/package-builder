import type { ScheduleData, ScheduleRow } from "../../types";
import { Icons } from "../../icons";

type Props = { data: ScheduleData; set: (patch: Partial<ScheduleData>) => void };

export function ScheduleEditor({ data, set }: Props) {
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
          <div className="sched-row" key={i}>
            <input
              type="text"
              value={r.num}
              onChange={(e) => update(i, { num: e.target.value })}
              placeholder="#"
            />
            <textarea
              rows={2}
              style={{ minHeight: 38, fontFamily: "var(--ui-font)", fontSize: 12 }}
              value={r.topic}
              onChange={(e) => update(i, { topic: e.target.value })}
              placeholder="Topic — newlines allowed"
            />
            <input
              type="text"
              value={r.when}
              onChange={(e) => update(i, { when: e.target.value })}
              placeholder="When"
            />
            <button className="x" onClick={() => del(i)} title="Remove row">
              <Icons.Trash size={12} />
            </button>
          </div>
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
