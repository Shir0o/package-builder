import { useState, useEffect, useRef } from "react";
import type { VerseGroup, VersesData } from "../../types";
import { Icons } from "../../icons";
import { parseVerses, stringifyVerses } from "../../lib/verses";
import { useYText } from "../../lib/useCollabSync";
import { useYTextInput } from "../../lib/useYTextInput";

type Props = {
  blockId: string;
  data: VersesData;
  set: (patch: Partial<VersesData>) => void;
};

type GroupRowProps = {
  blockId: string;
  index: number;
  group: VerseGroup;
  onUpdate: (patch: Partial<VerseGroup>) => void;
  onDelete: () => void;
};

function VerseGroupRow({ blockId, index, group, onUpdate, onDelete }: GroupRowProps) {
  const refY = useYText(blockId, ["groups", index, "ref"]);
  const textY = useYText(blockId, ["groups", index, "text"]);
  const refBinding = useYTextInput(refY, group.ref, (v) => onUpdate({ ref: v }));
  const textBinding = useYTextInput(textY, group.text, (v) => onUpdate({ text: v }));

  return (
    <div className="verse-card">
      <input
        className="ref"
        type="text"
        ref={refBinding.ref}
        onChange={refBinding.onChange}
        placeholder="John 3:16"
      />
      <textarea
        ref={textBinding.ref}
        onChange={textBinding.onChange}
        placeholder={"16 For God so loved the world…\n17 For God did not send his Son…"}
      />
      <button className="x" onClick={onDelete} title="Remove">
        <Icons.Trash size={12} />
      </button>
    </div>
  );
}

export function VersesEditor({ blockId, data, set }: Props) {
  const [mode, setMode] = useState<"list" | "bulk">("list");
  const [bulkText, setBulkText] = useState(() => stringifyVerses(data.groups));
  const lastProducedGroups = useRef<VerseGroup[] | null>(null);

  const titleY = useYText(blockId, ["title"]);
  const title = useYTextInput(titleY, data.title, (v) => set({ title: v }));

  // Keep bulkText in sync with data.groups when they change from outside (e.g. card edits, undo/redo, etc.)
  useEffect(() => {
    if (
      lastProducedGroups.current &&
      JSON.stringify(lastProducedGroups.current) === JSON.stringify(data.groups)
    ) {
      return;
    }

    const parsed = parseVerses(bulkText);
    const isEquivalent = JSON.stringify(parsed) === JSON.stringify(data.groups);
    if (!isEquivalent) {
      setBulkText(stringifyVerses(data.groups));
    }
  }, [data.groups]);

  const update = (i: number, patch: Partial<VerseGroup>) => {
    const groups = data.groups.slice();
    groups[i] = { ...groups[i], ...patch };
    set({ groups });
  };

  const add = () => set({ groups: [...data.groups, { ref: "", text: "" }] });
  const del = (i: number) => set({ groups: data.groups.filter((_, j) => j !== i) });

  const handleBulkChange = (text: string) => {
    setBulkText(text);
    const parsed = parseVerses(text);
    lastProducedGroups.current = parsed;
    set({ groups: parsed });
  };

  return (
    <>
      <div className="field">
        <label>Section title (optional)</label>
        <input
          type="text"
          ref={title.ref}
          onChange={title.onChange}
          placeholder="e.g. Lesson 4"
        />
      </div>

      <div className="field">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <label style={{ margin: 0 }}>Verses</label>
          <div className="seg">
            <button
              type="button"
              className={mode === "list" ? "on" : ""}
              onClick={() => setMode("list")}
            >
              List
            </button>
            <button
              type="button"
              className={mode === "bulk" ? "on" : ""}
              onClick={() => setMode("bulk")}
            >
              Bulk Edit
            </button>
          </div>
        </div>

        {mode === "list" ? (
          <>
            <div className="hint" style={{ marginBottom: 6 }}>
              Each line is one verse. Start a line with a number to label it (e.g.{" "}
              <span style={{ fontFamily: "var(--mono-font)" }}>26 And God said…</span>).
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {data.groups.map((g, i) => (
                <VerseGroupRow
                  key={i}
                  blockId={blockId}
                  index={i}
                  group={g}
                  onUpdate={(patch) => update(i, patch)}
                  onDelete={() => del(i)}
                />
              ))}
            </div>
            <button
              className="btn tiny"
              style={{ marginTop: 8, alignSelf: "flex-start" }}
              onClick={add}
            >
              <Icons.Plus size={12} /> Add reference
            </button>
          </>
        ) : (
          <>
            <div className="hint" style={{ marginBottom: 6 }}>
              Paste one or more verses. Start each verse with its reference (e.g.,{" "}
              <span style={{ fontFamily: "var(--mono-font)" }}>John 3:16 For God so loved...</span>
              ). Empty lines separate verse groups. Multi-line verses are supported.
            </div>
            <textarea
              style={{
                fontFamily: "var(--mono-font)",
                fontSize: "12px",
                lineHeight: "1.5",
                minHeight: "240px",
                width: "100%",
                padding: "8px 10px",
                borderRadius: "5px",
                border: "1px solid var(--line)",
                background: "white",
              }}
              value={bulkText}
              onChange={(e) => handleBulkChange(e.target.value)}
              placeholder={
                "John 3:16 For God so loved the world...\n\nRom. 8:16 The Spirit Himself..."
              }
            />
          </>
        )}
      </div>
    </>
  );
}
