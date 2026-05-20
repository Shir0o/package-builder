import type { ParagraphData } from "../../types";

type Props = { data: ParagraphData; set: (patch: Partial<ParagraphData>) => void };

export function ParagraphEditor({ data, set }: Props) {
  return (
    <>
      <div className="field">
        <label>Text</label>
        <textarea
          value={data.text}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="Body text…"
        />
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
    </>
  );
}
