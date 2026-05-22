import type { NotesData } from "../../types";
import { useYText } from "../../lib/collabContext";
import { useYTextInput } from "../../lib/useYTextInput";

type Props = {
  blockId: string;
  data: NotesData;
  set: (patch: Partial<NotesData>) => void;
};

export function NotesEditor({ blockId, data, set }: Props) {
  const titleY = useYText(blockId, ["title"]);
  const title = useYTextInput(titleY, data.title, (v) => set({ title: v }));

  return (
    <>
      <div className="field">
        <label>Heading</label>
        <input type="text" ref={title.ref} onChange={title.onChange} />
      </div>
      <div className="field">
        <label>Lines Mode</label>
        <select
          value={data.autoLines !== false ? "auto" : "manual"}
          onChange={(e) => {
            const isAuto = e.target.value === "auto";
            set({ autoLines: isAuto });
          }}
        >
          <option value="auto">Auto (Prefill Page)</option>
          <option value="manual">Manual (Set Line Count)</option>
        </select>
        {data.autoLines !== false && (
          <span className="hint">
            Prefills the remaining height of the page up to the cut-off.
          </span>
        )}
      </div>
      {data.autoLines === false && (
        <div className="field">
          <label>Number of lines · {data.lines}</label>
          <input
            type="range"
            min={2}
            max={40}
            value={data.lines}
            onChange={(e) => set({ lines: Number(e.target.value) })}
          />
        </div>
      )}
    </>
  );
}
