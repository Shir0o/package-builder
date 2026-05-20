import { useState, useEffect } from "react";
import type { VerseGroup, VersesData } from "../../types";
import { Icons } from "../../icons";
import { parseVerses, stringifyVerses } from "../../lib/verses";

type Props = { data: VersesData; set: (patch: Partial<VersesData>) => void };

export function VersesEditor({ data, set }: Props) {
  const [mode, setMode] = useState<"list" | "bulk">("list");
  const [bulkText, setBulkText] = useState(() => stringifyVerses(data.groups));

  // Keep bulkText in sync with data.groups when they change from outside (e.g. card edits, undo/redo, etc.)
  useEffect(() => {
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
    set({ groups: parseVerses(text) });
  };

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
