import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AnyBlock, Package } from "../types";
import {
  flattenToUnits,
  groupIntoPages,
  packPages,
  type FlattenedUnit,
  type MeasuredUnit,
  type RenderUnit,
} from "../lib/pagination";
import { parseVerseLines } from "../lib/verses";
import { DEFAULT_NOTES_LINES } from "../blocks";
import type { Peer } from "../lib/collab";

// US Letter content box: 11in tall minus 0.85in top + 1in bottom padding,
// at the CSS reference of 96px/in. The packer fills pages up to this height.
const PRINTABLE_HEIGHT_PX = (11 - 0.85 - 1) * 96;

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
          {d.groups.map((g, i) => (
            <VerseGroupView key={i} refLabel={g.ref} text={g.text} />
          ))}
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
          <NotesLines lines={d.lines || DEFAULT_NOTES_LINES} />
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

function VerseGroupView({ refLabel, text }: { refLabel: string; text: string }) {
  const lines = parseVerseLines(text);
  return (
    <div style={{ margin: "6pt 0 10pt" }}>
      {refLabel ? <div className="doc-verse-ref">{refLabel}</div> : null}
      {lines.map((vl, j) => (
        <div key={j} className="doc-verse">
          <div className="vnum">{vl.num || ""}</div>
          <div className="vtext">{vl.text}</div>
        </div>
      ))}
    </div>
  );
}

function NotesLines({ lines }: { lines: number }) {
  return (
    <>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="doc-notes-line" />
      ))}
    </>
  );
}

/** Renders a single paginated unit. Markup matches RenderBlock so heights are identical. */
function RenderUnitView({ unit }: { unit: RenderUnit }) {
  switch (unit.kind) {
    case "block":
      return <RenderBlock block={unit.block} />;
    case "verses-title":
      return (
        <div className="doc-h3" style={{ margin: "8pt 0 4pt" }}>
          {unit.title}
        </div>
      );
    case "verse-group":
      return <VerseGroupView refLabel={unit.showRef ? unit.group.ref : ""} text={unit.group.text} />;
    case "notes-title":
      return <div className="doc-notes-title">{unit.title}</div>;
    case "notes-lines":
      return <NotesLines lines={unit.lines} />;
    default:
      return null;
  }
}

/** Block ids that this unit touches — used to map editor/selection state to a unit. */
function unitBlockId(u: FlattenedUnit): string | null {
  if (u.kind === "pagebreak") return null;
  if (u.kind === "standalone" || u.kind === "block") return u.block.id;
  return u.blockId;
}

/** Fallback pagination (before measurement / non-DOM SSR): block-level grouping. */
function fallbackPages(blocks: AnyBlock[]): RenderUnit[][] {
  return groupIntoPages(blocks).map((page) =>
    page.flatMap((b) =>
      flattenToUnits([b])
        .filter((u) => u.kind !== "pagebreak")
        .map((u) =>
          u.kind === "standalone" ? ({ kind: "block", block: u.block } as RenderUnit) : (u as RenderUnit)
        )
    )
  );
}

type Props = {
  pkg: Package;
  selectedId?: string | null;
  onSelectBlock?: (id: string) => void;
  interactive?: boolean;
  peers?: Peer[];
};

export function DocumentPreview({ pkg, selectedId, onSelectBlock, interactive, peers }: Props) {
  const units = useMemo(() => flattenToUnits(pkg.blocks), [pkg.blocks]);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<RenderUnit[][]>(() => fallbackPages(pkg.blocks));
  // Block ids whose single unit is taller than a whole page and can't be split —
  // the residual case auto-pagination can't fix, surfaced as a preview warning.
  const [overflowIds, setOverflowIds] = useState<Set<string>>(() => new Set());

  const [debouncedFontSize, setDebouncedFontSize] = useState(pkg.fontSize);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedFontSize(pkg.fontSize);
    }, 250);
    return () => clearTimeout(t);
  }, [pkg.fontSize]);

  // Measure each unit's rendered height, then pack into US-Letter-height pages.
  // Runs whenever the unit stream changes; re-runs once web fonts settle so
  // measurements reflect the real glyph metrics used in the PDF.
  useLayoutEffect(() => {
    if (!interactive) return;
    let cancelled = false;
    const measureAndPack = () => {
      const container = measureRef.current;
      if (cancelled || !container) return;
      const children = Array.from(container.children) as HTMLElement[];
      const measured: MeasuredUnit[] = units.map((u, i) => {
        const h = children[i] ? children[i].getBoundingClientRect().height : 0;
        let split: MeasuredUnit["split"];
        if (u.kind === "notes-lines" && u.lines > 0) {
          split = { lineHeight: h / u.lines, lines: u.lines };
        } else if (u.kind === "verse-group") {
          const n = parseVerseLines(u.group.text).length;
          if (n > 1) split = { lineHeight: h / n, lines: n };
        }
        return { unit: u, height: h, split };
      });
      const over = new Set<string>();
      for (const m of measured) {
        if (m.height > PRINTABLE_HEIGHT_PX && !m.split) {
          const bid = unitBlockId(m.unit);
          if (bid) over.add(bid);
        }
      }
      if (cancelled) return;
      setPages(packPages(measured, PRINTABLE_HEIGHT_PX));
      setOverflowIds(over);
    };

    measureAndPack();
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) fonts.ready.then(measureAndPack);
    return () => {
      cancelled = true;
    };
  }, [units, interactive, debouncedFontSize]);

  useEffect(() => {
    if (interactive && selectedId) {
      const el = document.querySelector(`[data-block-id="${selectedId}"]`);
      if (el) el.scrollIntoView({ behavior: "auto", block: "nearest" });
    }
  }, [selectedId, interactive, pages]);

  const editorsByBlock = useMemo(() => {
    const m = new Map<string, Peer>();
    const blockIds = new Set(pkg.blocks.map((b) => b.id));
    for (const p of peers ?? []) {
      if (p.selectedBlockId && blockIds.has(p.selectedBlockId) && !m.has(p.selectedBlockId)) {
        m.set(p.selectedBlockId, p);
      }
    }
    return m;
  }, [peers, pkg.blocks]);

  let pageNum = 0;
  return (
    <>
      {pages.map((pageUnits, pi) => {
        pageNum += 1;
        const isCoverPage =
          pageUnits.length === 1 &&
          pageUnits[0].kind === "block" &&
          pageUnits[0].block.type === "cover";
        const currentPage = pageNum;
        return (
          <React.Fragment key={pi}>
            <div
              className="paper"
              data-page={currentPage}
              style={{
                fontSize: debouncedFontSize !== undefined ? `${debouncedFontSize}pt` : undefined
              }}
            >
              {pageUnits.map((u, ui) => {
                const bid = unitBlockId(u);
                const editor = bid ? editorsByBlock.get(bid) : undefined;
                const peerOutline =
                  editor && selectedId !== bid ? `2px dashed ${editor.user.color}` : null;
                return (
                  <div
                    key={`${bid ?? "unit"}-${ui}`}
                    data-block-id={bid ?? undefined}
                    onClick={
                      interactive && bid
                        ? (e) => {
                            e.stopPropagation();
                            onSelectBlock && onSelectBlock(bid);
                          }
                        : undefined
                    }
                    style={{
                      display: "flow-root",
                      ...(interactive
                        ? {
                            cursor: bid ? "pointer" : undefined,
                            outline:
                              selectedId && selectedId === bid
                                ? "2px solid oklch(70% 0.14 35)"
                                : peerOutline ?? "none",
                            outlineOffset: "4px",
                            borderRadius: "2px",
                            transition: "outline-color .15s",
                            position: "relative",
                          }
                        : undefined)
                    }}
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
                    {interactive && bid && overflowIds.has(bid) ? (
                      <div className="overflow-warning">
                        Too tall for one page — add a page break or shorten this block
                      </div>
                    ) : null}
                    <RenderUnitView unit={u} />
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

      {/* Off-screen measuring sheet: same width/font as .paper so unit heights
          match the printed output. Each unit isolated in a flow-root wrapper so
          its vertical margins are included in the measured height. */}
      {interactive ? (
        <div
          ref={measureRef}
          className="paper paper-measure"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -99999,
            top: 0,
            visibility: "hidden",
            height: "auto",
            minHeight: 0,
            boxShadow: "none",
            zoom: 1,
            pointerEvents: "none",
            fontSize: debouncedFontSize !== undefined ? `${debouncedFontSize}pt` : undefined,
          }}
        >
          {units.map((u, i) =>
            u.kind === "pagebreak" ? (
              <div key={i} style={{ display: "flow-root" }} />
            ) : (
              <div key={i} style={{ display: "flow-root" }}>
                <RenderUnitView
                  unit={u.kind === "standalone" ? { kind: "block", block: u.block } : (u as RenderUnit)}
                />
              </div>
            )
          )}
        </div>
      ) : null}
    </>
  );
}
