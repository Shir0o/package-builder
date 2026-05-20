import type { VerseGroup, VersesData } from "../../types";
import { Icons } from "../../icons";

type Props = { data: VersesData; set: (patch: Partial<VersesData>) => void };

export function VersesEditor({ data, set }: Props) {
  const update = (i: number, patch: Partial<VerseGroup>) => {
    const groups = data.groups.slice();
    groups[i] = { ...groups[i], ...patch };
    set({ groups });
  };
  const add = () => set({ groups: [...data.groups, { ref: "", text: "" }] });
  const del = (i: number) => set({ groups: data.groups.filter((_, j) => j !== i) });

  return (
    <>
      <div className="field">
        <label>Section title (optional)</label>
        <input
          type="text"
          value={data.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="e.g. Lesson 4"
        />
      </div>
      <div className="field">
        <label>Verses</label>
        <div className="hint">
          Each line is one verse. Start a line with a number to label it (e.g.{" "}
          <span style={{ fontFamily: "var(--mono-font)" }}>26 And God said…</span>).
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {data.groups.map((g, i) => (
            <div className="verse-card" key={i}>
              <input
                className="ref"
                type="text"
                value={g.ref}
                onChange={(e) => update(i, { ref: e.target.value })}
                placeholder="John 3:16"
              />
              <textarea
                value={g.text}
                onChange={(e) => update(i, { text: e.target.value })}
                placeholder={"16 For God so loved the world…\n17 For God did not send his Son…"}
              />
              <button className="x" onClick={() => del(i)} title="Remove">
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
          <Icons.Plus size={12} /> Add reference
        </button>
      </div>
    </>
  );
}
