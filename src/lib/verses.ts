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
