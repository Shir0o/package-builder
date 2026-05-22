import type { Package } from "../types";
import { parseVerseLines } from "../lib/verses";
import { downloadBlob, safeName } from "./util";

export function exportMarkdown(pkg: Package) {
  const lines: string[] = [];
  lines.push(`# ${pkg.title || "Package"}`);
  lines.push("");

  pkg.blocks.forEach((b) => {
    switch (b.type) {
      case "cover": {
        const d = b.data;
        lines.push(`# ${d.title}`);
        if (d.subtitle) lines.push(`### *${d.subtitle}*`);
        if (d.eyebrow) lines.push(`*${d.eyebrow}*`);
        if (d.dateline) lines.push(`*${d.dateline}*`);
        lines.push("\n---\n");
        break;
      }
      case "heading": {
        const d = b.data;
        lines.push(`${"#".repeat(d.level || 2)} ${d.text}`);
        lines.push("");
        break;
      }
      case "paragraph":
        lines.push(b.data.text || "");
        lines.push("");
        break;
      case "schedule": {
        lines.push("| # | Topic | When |");
        lines.push("|---|---|---|");
        b.data.rows.forEach((r) => {
          lines.push(`| ${r.num} | ${(r.topic || "").replace(/\n/g, "<br/>")} | ${r.when} |`);
        });
        lines.push("");
        break;
      }
      case "verses": {
        const d = b.data;
        if (d.title) lines.push(`### ${d.title}\n`);
        d.groups.forEach((g) => {
          if (g.ref) lines.push(`**${g.ref}**`);
          parseVerseLines(g.text).forEach((vl) => {
            lines.push(`> ${vl.num ? vl.num + " " : ""}${vl.text}`);
          });
          lines.push("");
        });
        break;
      }
      case "song": {
        const d = b.data;
        if (d.title) lines.push(`### ${d.title}\n`);
        let vc = 0;
        d.stanzas.forEach((s) => {
          if (s.type === "verse") {
            vc += 1;
            lines.push(`**${vc}.**`);
            s.text.split("\n").forEach((l) => lines.push(`  ${l}`));
          } else {
            lines.push("*Chorus*");
            s.text.split("\n").forEach((l) => lines.push(`  > ${l}`));
          }
          lines.push("");
        });
        break;
      }
      case "notes": {
        const d = b.data;
        lines.push(`### ${d.title}\n`);
        const noteLines = d.autoLines !== false ? (d.lines || 28) : d.lines;
        for (let i = 0; i < noteLines; i++)
          lines.push("_________________________________________________");
        lines.push("");
        break;
      }
      case "rule":
        lines.push("\n---\n");
        break;
      case "pagebreak":
        lines.push('\n<div style="page-break-after:always"></div>\n');
        break;
    }
  });
  downloadBlob(safeName(pkg.title) + ".md", "text/markdown;charset=utf-8", lines.join("\n"));
}
