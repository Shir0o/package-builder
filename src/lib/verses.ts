import type { VerseGroup } from "../types";

export type VerseLine = { num: string | null; text: string };

export function parseVerseLines(text: string): VerseLine[] {
  if (!text) return [];
  return text
    .split(/\n/)
    .map((raw): VerseLine | null => {
      const line = raw.trim();
      if (!line) return null;
      const m = line.match(/^(\d+)\s+(.*)$/);
      if (m) return { num: m[1], text: m[2] };
      return { num: null, text: line };
    })
    .filter((v): v is VerseLine => v !== null);
}

export function parseVerses(text: string): VerseGroup[] {
  const groups: VerseGroup[] = [];
  const lines = text.split(/\r?\n/);

  // Regex to match a reference at the start of a line.
  // Handles optional leading numbers (1, 2, 3) followed by letters/spaces/dots (e.g. 1 Tim, Rom., John).
  // Then a space, followed by Chapter:Verse.
  // The Chapter:Verse can have range/list punctuation, including cross-chapter references (e.g. 3:16-17 or 3:16-4:5 or 3:16, 17).
  const refRegex = /^([1-3]?\s*[A-Za-z\.]+(?:\s+[A-Za-z\.]+)*\s+\d+:\d+(?:[-–,]\s*\d+(?::\d+)?)*[a-zA-Z]?)(?:\s+(.*))?$/;

  let afterEmptyLine = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      afterEmptyLine = true;
      continue;
    }

    const match = line.match(refRegex);
    if (match) {
      const ref = match[1].trim();
      const textContent = (match[2] || "").trim();
      groups.push({ ref, text: textContent });
      afterEmptyLine = false;
    } else {
      if (groups.length > 0 && !afterEmptyLine) {
        const lastGroup = groups[groups.length - 1];
        lastGroup.text = lastGroup.text ? `${lastGroup.text}\n${line}` : line;
      } else {
        // If no group exists yet, or we had an empty line, create a new group with empty reference
        groups.push({ ref: "", text: line });
      }
      afterEmptyLine = false;
    }
  }
  return groups;
}

export function stringifyVerses(groups: VerseGroup[]): string {
  return groups
    .map((g) => {
      if (g.ref) {
        return `${g.ref} ${g.text}`;
      }
      return g.text;
    })
    .join("\n\n");
}
