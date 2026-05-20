import type { HeadingData } from "../../types";

type Props = { data: HeadingData; set: (patch: Partial<HeadingData>) => void };

export function HeadingEditor({ data, set }: Props) {
  return (
    <>
      <div className="field">
        <label>Text</label>
        <input
          type="text"
          value={data.text}
          onChange={(e) => set({ text: e.target.value })}
        />
      </div>
      <div className="row-fields">
        <div className="field">
          <label>Level</label>
          <select
            value={data.level}
            onChange={(e) => set({ level: Number(e.target.value) as 1 | 2 | 3 })}
          >
            <option value={1}>H1 — Large</option>
            <option value={2}>H2 — Section</option>
            <option value={3}>H3 — Caption</option>
          </select>
        </div>
        <div className="field">
          <label>Align</label>
          <select
            value={data.align || "left"}
            onChange={(e) => set({ align: e.target.value as "left" | "center" })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
          </select>
        </div>
      </div>
    </>
  );
}
