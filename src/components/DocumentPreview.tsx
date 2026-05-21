import React, { useEffect, useMemo } from "react";
import type { AnyBlock, Package } from "../types";
import { groupIntoPages } from "../lib/pagination";
import { parseVerseLines } from "../lib/verses";
import type { Peer } from "../lib/collab";

export function RenderBlock({ block }: { block: AnyBlock }) {
  switch (block.type) {
    case "cover": {
      const d = block.data;
      return (
        <div className="doc-cover">
          {d.eyebrow ? <div className="eyebrow">{d.eyebrow}</div> : null}
          <div className="title">{d.title || "Untitled"}</div>
          {d.subtitle ? <div className="ornament" /> : null}
          {d.subtitle ? <div className="subtitle">{d.subtitle}</div> : null}
          {d.dateline ? <div className="dateline">{d.dateline}</div> : null}
        </div>
      );
    }
    case "heading": {
      const d = block.data;
      const cls = `doc-h${d.level || 2}` + (d.align === "center" ? " doc-center" : "");
      const Tag = `h${d.level || 2}` as keyof JSX.IntrinsicElements;
      return React.createElement(Tag, { className: cls }, d.text);
    }
    case "paragraph": {
      const d = block.data;
      return (
        <p className={"doc-p" + (d.align === "center" ? " doc-center" : "")}>
          {d.text || <span style={{ color: "#bbb" }}>(empty paragraph)</span>}
        </p>
      );
    }
    case "schedule": {
      const d = block.data;
      return (
        <table className="doc-schedule">
          <thead>
            <tr>
              <th style={{ width: "0.4in" }}>#</th>
              <th>Topic</th>
              <th style={{ textAlign: "right" }}>When</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r, i) => (
              <tr key={i}>
                <td className="num">{r.num || i + 1}</td>
                <td>
                  {(r.topic || "").split("\n").map((line, j, arr) => (
                    <React.Fragment key={j}>
                      {line}
                      {j < arr.length - 1 ? <br /> : null}
                    </React.Fragment>
                  ))}
                </td>
                <td className="when">{r.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "verses": {
      const d = block.data;
      return (
        <div className="doc-verse-group">
          {d.title ? (
            <div className="doc-h3" style={{ margin: "8pt 0 4pt" }}>
              {d.title}
            </div>
          ) : null}
          {d.groups.map((g, i) => {
            const lines = parseVerseLines(g.text);
            return (
              <div key={i} style={{ margin: "6pt 0 10pt" }}>
                {g.ref ? <div className="doc-verse-ref">{g.ref}</div> : null}
                {lines.map((vl, j) => (
                  <div key={j} className="doc-verse">
                    <div className="vnum">{vl.num || ""}</div>
                    <div className="vtext">{vl.text}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      );
    }
    case "song": {
      const d = block.data;
      const verseStanzaCount = d.stanzas.filter((s) => s.type === "verse").length;
      let verseNum = 0;
      return (
        <div className="doc-song">
          {d.title ? <div className="doc-song-title">{d.title}</div> : null}
          {d.stanzas.map((s, i) => {
            const isChorus = s.type === "chorus";
            if (!isChorus) verseNum += 1;
            const showNum = !isChorus && verseStanzaCount > 1;
            return (
              <div
                key={i}
                className={
                  "doc-song-stanza" +
                  (isChorus ? " chorus" : "") +
                  (!showNum && !isChorus ? " no-num" : "")
                }
              >
                <div className="vnum">{!isChorus && showNum ? verseNum : ""}</div>
                <div className="lines">{s.text}</div>
              </div>
            );
          })}
        </div>
      );
    }
    case "notes": {
      const d = block.data;
      return (
        <div>
          {d.title ? <div className="doc-notes-title">{d.title}</div> : null}
          {Array.from({ length: d.lines || 10 }).map((_, i) => (
            <div key={i} className="doc-notes-line" />
          ))}
        </div>
      );
    }
    case "rule":
      return <hr className="doc-rule" />;
    case "pagebreak":
      return null;
    default:
      return null;
  }
}

type Props = {
  pkg: Package;
  selectedId?: string | null;
  onSelectBlock?: (id: string) => void;
  interactive?: boolean;
  peers?: Peer[];
};

export function DocumentPreview({ pkg, selectedId, onSelectBlock, interactive, peers }: Props) {
  const pages = groupIntoPages(pkg.blocks);
  let pageNum = 0;

  useEffect(() => {
    if (interactive && selectedId) {
      const el = document.querySelector(`[data-block-id="${selectedId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "nearest" });
      }
    }
  }, [selectedId, interactive]);

  const editorsByBlock = useMemo(() => {
    const m = new Map<string, Peer>();
    const blockIds = new Set(pkg.blocks.map((b) => b.id));
    for (const p of peers ?? []) {
      if (
        p.selectedBlockId &&
        blockIds.has(p.selectedBlockId) &&
        !m.has(p.selectedBlockId)
      ) {
        m.set(p.selectedBlockId, p);
      }
    }
    return m;
  }, [peers, pkg.blocks]);
  return (
    <>
      {pages.map((pageBlocks, pi) => {
        pageNum += 1;
        const isCoverPage = pageBlocks.length === 1 && pageBlocks[0].type === "cover";
        const currentPage = pageNum;
        return (
          <React.Fragment key={pi}>
            <div className="paper" data-page={currentPage}>
              {pageBlocks.map((b) => {
                const editor = editorsByBlock.get(b.id);
                const peerOutline =
                  editor && selectedId !== b.id
                    ? `2px dashed ${editor.user.color}`
                    : null;
                return (
                  <div
                    key={b.id}
                    data-block-id={b.id}
                    onClick={
                      interactive
                        ? (e) => {
                            e.stopPropagation();
                            onSelectBlock && onSelectBlock(b.id);
                          }
                        : undefined
                    }
                    style={
                      interactive
                        ? {
                            cursor: "pointer",
                            outline:
                              selectedId === b.id
                                ? "2px solid oklch(70% 0.14 35)"
                                : peerOutline ?? "none",
                            outlineOffset: "4px",
                            borderRadius: "2px",
                            transition: "outline-color .15s",
                            position: "relative",
                          }
                        : undefined
                    }
                  >
                    {editor && interactive && (
                      <div
                        style={{
                          position: "absolute",
                          top: -10,
                          right: 0,
                          padding: "1px 6px",
                          fontSize: 9,
                          fontWeight: 600,
                          color: "#fff",
                          background: editor.user.color,
                          borderRadius: 999,
                          pointerEvents: "none",
                          zIndex: 1,
                        }}
                      >
                        {editor.user.name}
                      </div>
                    )}
                    <RenderBlock block={b} />
                  </div>
                );
              })}
              {pkg.pageNumbers && !isCoverPage ? (
                <div className="pg-number">{currentPage}</div>
              ) : null}
            </div>
            {pi < pages.length - 1 ? (
              <div className="page-break-marker">— Page {currentPage + 1} —</div>
            ) : null}
          </React.Fragment>
        );
      })}
    </>
  );
}
