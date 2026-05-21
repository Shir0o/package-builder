import type { HeadingData } from "../../types";
import { useYText } from "../../lib/useCollabSync";
import { useYTextInput } from "../../lib/useYTextInput";

type Props = {
  blockId: string;
  data: HeadingData;
  set: (patch: Partial<HeadingData>) => void;
};

export function HeadingEditor({ blockId, data, set }: Props) {
  const textY = useYText(blockId, ["text"]);
  const text = useYTextInput(textY, data.text, (v) => set({ text: v }));

  return (
    <>
      <div className="field">
        <label>Text</label>
        <input type="text" ref={text.ref} onChange={text.onChange} />
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
