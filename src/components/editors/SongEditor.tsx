import type { SongData, Stanza } from "../../types";
import { Icons } from "../../icons";

type Props = { data: SongData; set: (patch: Partial<SongData>) => void };

export function SongEditor({ data, set }: Props) {
  const update = (i: number, patch: Partial<Stanza>) => {
    const stanzas = data.stanzas.slice();
    stanzas[i] = { ...stanzas[i], ...patch };
    set({ stanzas });
  };
  const add = (type: Stanza["type"]) =>
    set({ stanzas: [...data.stanzas, { type, text: "" }] });
  const del = (i: number) => set({ stanzas: data.stanzas.filter((_, j) => j !== i) });
  const move = (i: number, di: number) => {
    const j = i + di;
    if (j < 0 || j >= data.stanzas.length) return;
    const stanzas = data.stanzas.slice();
    [stanzas[i], stanzas[j]] = [stanzas[j], stanzas[i]];
    set({ stanzas });
  };

  let vCount = 0;
  return (
    <>
      <div className="field">
        <label>Song title</label>
        <input
          type="text"
          value={data.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Song title"
        />
      </div>
      <div className="field">
        <label>Stanzas</label>
        <div className="hint">
          Each line is one line of the song. Verses are auto-numbered. Choruses indent further and
          skip the number.
        </div>
        <div className="stanza-list" style={{ marginTop: 4 }}>
          {data.stanzas.map((s, i) => {
            if (s.type === "verse") vCount += 1;
            const verseLabel = s.type === "verse" ? `Verse ${vCount}` : "Chorus";
            return (
              <div
                key={i}
                className={"stanza-card " + (s.type === "chorus" ? "chorus" : "")}
              >
                <div className="stanza-card-head">
                  <span>{verseLabel}</span>
                  <div className="seg" style={{ marginLeft: 8 }}>
                    <button
                      className={s.type === "verse" ? "on" : ""}
                      onClick={() => update(i, { type: "verse" })}
                    >
                      Verse
                    </button>
                    <button
                      className={s.type === "chorus" ? "on" : ""}
                      onClick={() => update(i, { type: "chorus" })}
                    >
                      Chorus
                    </button>
                  </div>
                  <div className="actions">
                    <button onClick={() => move(i, -1)} title="Move up">
                      <Icons.Up size={11} />
                    </button>
                    <button onClick={() => move(i, +1)} title="Move down">
                      <Icons.Down size={11} />
                    </button>
                    <button onClick={() => del(i)} title="Remove">
                      <Icons.Trash size={11} />
                    </button>
                  </div>
                </div>
                <textarea
                  value={s.text}
                  onChange={(e) => update(i, { text: e.target.value })}
                  placeholder={
                    s.type === "verse" ? "Verse lines…\nOne per line." : "Chorus lines…"
                  }
                />
              </div>
            );
          })}
        </div>
        <div className="add-stanza-row" style={{ marginTop: 8 }}>
          <button onClick={() => add("verse")}>
            <Icons.Plus size={11} /> Add verse
          </button>
          <button onClick={() => add("chorus")}>
            <Icons.Plus size={11} /> Add chorus
          </button>
        </div>
      </div>
    </>
  );
}
