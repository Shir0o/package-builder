import type { NotesData } from "../../types";

type Props = { data: NotesData; set: (patch: Partial<NotesData>) => void };

export function NotesEditor({ data, set }: Props) {
  return (
    <>
      <div className="field">
        <label>Heading</label>
        <input
          type="text"
          value={data.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>
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
    </>
  );
}
