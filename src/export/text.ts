import type { Package } from "../types";
import { parseVerseLines } from "../lib/verses";
import { downloadBlob, safeName } from "./util";

export function exportText(pkg: Package) {
  const lines: string[] = [];
  const sep = "═".repeat(60);
  lines.push(sep);
  lines.push("  " + (pkg.title || "Package"));
  lines.push(sep);
  lines.push("");
  pkg.blocks.forEach((b) => {
    switch (b.type) {
      case "cover": {
        const d = b.data;
        lines.push("");
        lines.push(d.title);
        if (d.subtitle) lines.push(d.subtitle);
        if (d.eyebrow) lines.push(d.eyebrow);
        if (d.dateline) lines.push(d.dateline);
        lines.push("");
        break;
      }
      case "heading": {
        const d = b.data;
        lines.push("");
        lines.push(d.text);
        lines.push("-".repeat((d.text || "").length));
        lines.push("");
        break;
      }
      case "paragraph":
        lines.push(b.data.text || "");
        lines.push("");
        break;
      case "schedule":
        b.data.rows.forEach((r) => {
          lines.push(
            `  ${r.num.padEnd(3)} ${(r.topic || "").replace(/\n/g, " — ")}   [${r.when}]`,
          );
        });
        lines.push("");
        break;
      case "verses": {
        const d = b.data;
        if (d.title) {
          lines.push(d.title);
          lines.push("");
        }
        d.groups.forEach((g) => {
          if (g.ref) lines.push(g.ref);
          parseVerseLines(g.text).forEach((vl) => {
            lines.push(`  ${(vl.num || " ").padStart(3)}  ${vl.text}`);
          });
          lines.push("");
        });
        break;
      }
      case "song": {
        const d = b.data;
        if (d.title) {
          lines.push(d.title);
          lines.push("");
        }
        let vc = 0;
        d.stanzas.forEach((s) => {
          if (s.type === "verse") {
            vc += 1;
            const num = String(vc);
            s.text.split("\n").forEach((l, i) => {
              lines.push(`  ${i === 0 ? num.padEnd(3) : "   "} ${l}`);
            });
          } else {
            s.text.split("\n").forEach((l) => lines.push(`        ${l}`));
          }
          lines.push("");
        });
        break;
      }
      case "notes": {
        const d = b.data;
        lines.push(d.title);
        const noteLines = d.autoLines !== false ? (d.lines || 28) : d.lines;
        for (let i = 0; i < noteLines; i++)
          lines.push("  __________________________________________________");
        lines.push("");
        break;
      }
      case "rule":
        lines.push("  - - - - - - - - - - - - - - - - - - - - - - - - - - -");
        lines.push("");
        break;
      case "pagebreak":
        lines.push("");
        lines.push("\f");
        lines.push("");
        break;
    }
  });
  downloadBlob(safeName(pkg.title) + ".txt", "text/plain;charset=utf-8", lines.join("\n"));
}
