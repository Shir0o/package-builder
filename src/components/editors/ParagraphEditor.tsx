import type { ParagraphData } from "../../types";
import { useYText } from "../../lib/collabContext";
import { useYTextInput } from "../../lib/useYTextInput";

type Props = {
  blockId: string;
  data: ParagraphData;
  set: (patch: Partial<ParagraphData>) => void;
};

export function ParagraphEditor({ blockId, data, set }: Props) {
  const textY = useYText(blockId, ["text"]);
  const text = useYTextInput(textY, data.text, (v) => set({ text: v }));

  return (
    <>
      <div className="field">
        <label>Text</label>
        <textarea ref={text.ref} onChange={text.onChange} placeholder="Body text…" />
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
