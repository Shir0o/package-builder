import type { AnyBlock } from "../types";

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
