import type { SongData, Stanza } from "../../types";
import { Icons } from "../../icons";
import { useYText } from "../../lib/collabContext";
import { useYTextInput } from "../../lib/useYTextInput";

type Props = {
  blockId: string;
  data: SongData;
  set: (patch: Partial<SongData>) => void;
};

type StanzaRowProps = {
  blockId: string;
  index: number;
  stanza: Stanza;
  label: string;
  onUpdate: (patch: Partial<Stanza>) => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
};

function StanzaRow({ blockId, index, stanza, label, onUpdate, onDelete, onMove }: StanzaRowProps) {
  const textY = useYText(blockId, ["stanzas", index, "text"]);
  const text = useYTextInput(textY, stanza.text, (v) => onUpdate({ text: v }));

  return (
    <div className={"stanza-card " + (stanza.type === "chorus" ? "chorus" : "")}>
      <div className="stanza-card-head">
        <span>{label}</span>
        <div className="seg" style={{ marginLeft: 8 }}>
          <button
            className={stanza.type === "verse" ? "on" : ""}
            onClick={() => onUpdate({ type: "verse" })}
          >
            Verse
          </button>
          <button
            className={stanza.type === "chorus" ? "on" : ""}
            onClick={() => onUpdate({ type: "chorus" })}
          >
            Chorus
          </button>
        </div>
        <div className="actions">
          <button onClick={() => onMove(-1)} title="Move up">
            <Icons.Up size={11} />
          </button>
          <button onClick={() => onMove(+1)} title="Move down">
            <Icons.Down size={11} />
          </button>
          <button onClick={onDelete} title="Remove">
            <Icons.Trash size={11} />
          </button>
        </div>
      </div>
      <textarea
        ref={text.ref}
        onChange={text.onChange}
        placeholder={
          stanza.type === "verse" ? "Verse lines…\nOne per line." : "Chorus lines…"
        }
      />
    </div>
  );
}

export function SongEditor({ blockId, data, set }: Props) {
  const titleY = useYText(blockId, ["title"]);
  const title = useYTextInput(titleY, data.title, (v) => set({ title: v }));

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
          ref={title.ref}
          onChange={title.onChange}
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
              <StanzaRow
                key={i}
                blockId={blockId}
                index={i}
                stanza={s}
                label={verseLabel}
                onUpdate={(patch) => update(i, patch)}
                onDelete={() => del(i)}
                onMove={(delta) => move(i, delta)}
              />
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
