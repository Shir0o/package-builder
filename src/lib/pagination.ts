import type { AnyBlock, Block, VerseGroup } from "../types";
import { DEFAULT_NOTES_LINES } from "../blocks";
import { parseVerseLines } from "./verses";

export function groupIntoPages(blocks: AnyBlock[]): AnyBlock[][] {
  const pages: AnyBlock[][] = [];
  let current: AnyBlock[] = [];
  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
  };
  for (const b of blocks) {
    if (b.type === "pagebreak") {
      flush();
    } else if (b.type === "cover") {
      flush();
      current = [b];
      flush();
    } else {
      current.push(b);
    }
  }
  flush();
  if (!pages.length) pages.push([]);
  return pages;
}

/**
 * A render unit is the smallest piece the paginator places on a page. Most
 * blocks map to a single atomic unit, but `verses` and `notes` are broken into
 * finer units so a long passage or a tall notes block can flow across pages
 * instead of being clipped.
 */
export type RenderUnit =
  | { kind: "block"; block: AnyBlock }
  | { kind: "verses-title"; blockId: string; title: string }
  | {
      kind: "verse-group";
      blockId: string;
      group: VerseGroup;
      /** When a single group is split across pages, the ref only shows on the first slice. */
      showRef: boolean;
    }
  | { kind: "notes-title"; blockId: string; title: string }
  | { kind: "notes-lines"; blockId: string; lines: number; autoLines?: boolean };

/** Sentinel emitted for explicit page breaks and for blocks that own a page. */
export type FlattenedUnit =
  | { kind: "pagebreak" }
  | { kind: "standalone"; block: AnyBlock }
  | RenderUnit;

/**
 * Turn the block list into an ordered stream of units the paginator can pack.
 * Pure and DOM-free so it is unit-testable; heights are supplied separately.
 */
export function flattenToUnits(blocks: AnyBlock[]): FlattenedUnit[] {
  const units: FlattenedUnit[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "pagebreak":
        units.push({ kind: "pagebreak" });
        break;
      case "cover":
        units.push({ kind: "standalone", block: b });
        break;
      case "verses": {
        const d = (b as Block<"verses">).data;
        if (d.title) units.push({ kind: "verses-title", blockId: b.id, title: d.title });
        for (const group of d.groups) {
          units.push({ kind: "verse-group", blockId: b.id, group, showRef: true });
        }
        break;
      }
      case "notes": {
        const d = (b as Block<"notes">).data;
        if (d.title) units.push({ kind: "notes-title", blockId: b.id, title: d.title });
        units.push({
          kind: "notes-lines",
          blockId: b.id,
          lines: d.lines || DEFAULT_NOTES_LINES,
          autoLines: d.autoLines !== false,
        });
        break;
      }
      default:
        units.push({ kind: "block", block: b });
    }
  }
  return units;
}

/** A unit paired with its measured (or computed) rendered height in px. */
export type MeasuredUnit = {
  unit: FlattenedUnit;
  height: number;
  /** Present for line-based units that may be split across pages. */
  split?: { lineHeight: number; lines: number };
};

const EPSILON = 0.5;

/**
 * Greedily pack measured units into pages no taller than `pageHeight` (px).
 * `pagebreak` forces a break; `standalone` (e.g. cover) gets its own page.
 * Line-based units (notes, and verse groups taller than a whole page) are
 * split at line boundaries so content is never clipped.
 */
export function packPages(measured: MeasuredUnit[], pageHeight: number): RenderUnit[][] {
  const pages: RenderUnit[][] = [];
  let current: RenderUnit[] = [];
  let used = 0;

  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    used = 0;
  };
  const remaining = () => pageHeight - used;

  for (const m of measured) {
    const u = m.unit;

    if (u.kind === "pagebreak") {
      flush();
      continue;
    }
    if (u.kind === "standalone") {
      flush();
      pages.push([{ kind: "block", block: u.block }]);
      continue;
    }

    if (u.kind === "notes-lines" && u.autoLines) {
      const lineHeight = m.split?.lineHeight || (u.lines > 0 ? m.height / u.lines : 20);
      let fit = Math.floor((remaining() + EPSILON) / lineHeight);
      if (fit <= 0) {
        if (current.length) {
          flush();
          fit = Math.floor((remaining() + EPSILON) / lineHeight);
        } else {
          fit = 1;
        }
      }
      if (fit > 0) {
        current.push({ ...u, lines: fit });
        used += fit * lineHeight;
      }
      continue;
    }

    // Fits on the current page.
    if (m.height <= remaining() + EPSILON) {
      current.push(u);
      used += m.height;
      continue;
    }

    // Doesn't fit. If it can be line-split, fill the current page then continue
    // the remainder onto fresh pages.
    if (m.split && m.split.lines > 0) {
      const total = m.split.lines;
      const { lineHeight } = m.split;
      const slice = lineSlicer(u); // parses verse lines once, not per slice
      let offset = 0;
      while (offset < total) {
        let fit = Math.floor((remaining() + EPSILON) / lineHeight);
        if (fit <= 0) {
          // Nothing fits here; start a fresh page (unless it's already empty,
          // in which case force at least one line to guarantee progress).
          if (current.length) {
            flush();
            continue;
          }
          fit = 1;
        }
        fit = Math.min(fit, total - offset);
        current.push(slice(offset, fit));
        used += fit * lineHeight;
        offset += fit;
        if (offset < total) flush();
      }
      continue;
    }

    // Atomic and doesn't fit: move to a fresh page (it may still overflow if it
    // is taller than a whole page — the preview surfaces that as a warning).
    if (current.length) flush();
    current.push(u);
    used += m.height;
  }

  flush();
  if (!pages.length) pages.push([]);
  return pages;
}

/**
 * Build a slicer for a line-based unit. Verse text is parsed once here, then the
 * returned function cheaply produces each page slice covering `count` lines from
 * `offset`.
 */
function lineSlicer(u: RenderUnit): (offset: number, count: number) => RenderUnit {
  if (u.kind === "notes-lines") {
    return (_offset, count) => ({ ...u, lines: count });
  }
  if (u.kind === "verse-group") {
    const allLines = parseVerseLines(u.group.text);
    return (offset, count) => {
      const first = offset === 0;
      const taken = allLines.slice(offset, offset + count);
      return {
        kind: "verse-group",
        blockId: u.blockId,
        group: { ref: first ? u.group.ref : "", text: taken.map(serializeLine).join("\n") },
        showRef: first && !!u.group.ref,
      };
    };
  }
  return () => u;
}

function serializeLine(l: { num: string | null; text: string }): string {
  return l.num ? `${l.num} ${l.text}` : l.text;
}
