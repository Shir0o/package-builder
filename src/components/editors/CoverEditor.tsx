import type { CoverData } from "../../types";

type Props = { data: CoverData; set: (patch: Partial<CoverData>) => void };

export function CoverEditor({ data, set }: Props) {
  return (
    <>
      <div className="field">
        <label>Eyebrow (small text above title)</label>
        <input
          type="text"
          value={data.eyebrow}
          onChange={(e) => set({ eyebrow: e.target.value })}
          placeholder="Church in Santa Ana"
        />
      </div>
      <div className="field">
        <label>Title</label>
        <input
          type="text"
          value={data.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Title of the packet"
        />
      </div>
      <div className="field">
        <label>Subtitle</label>
        <input
          type="text"
          value={data.subtitle}
          onChange={(e) => set({ subtitle: e.target.value })}
          placeholder="Optional"
        />
      </div>
      <div className="field">
        <label>Dateline</label>
        <input
          type="text"
          value={data.dateline}
          onChange={(e) => set({ dateline: e.target.value })}
          placeholder="June 13–22, 2025"
        />
      </div>
    </>
  );
}
