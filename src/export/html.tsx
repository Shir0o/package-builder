import { renderToStaticMarkup } from "react-dom/server";
import type { Package } from "../types";
import { DocumentPreview } from "../components/DocumentPreview";
import { downloadBlob, escapeHtml, safeName } from "./util";

const CSS = `
body { margin: 0; font-family: 'Source Serif 4', 'Charter', Georgia, serif; background: #f4f1ec; padding: 24px; }
.paper { background: white; width: 8.5in; min-height: 11in; padding: 0.85in 0.85in 1in; margin: 0 auto 24px;
         box-shadow: 0 0 0 1px #d9d3c8, 0 12px 30px -16px rgba(0,0,0,0.18); color: #1a1815; font-size: 12.5pt; line-height: 1.45; position: relative; }
.paper .pg-number { position: absolute; bottom: 0.55in; left: 0; right: 0; text-align: center; font-size: 10pt; color: #777; }
.page-break-marker { display: none; }
.doc-h1 { font-size: 22pt; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 6pt; text-align: center; line-height: 1.2; }
.doc-h2 { font-size: 15pt; font-weight: 600; margin: 18pt 0 6pt; }
.doc-h3 { font-size: 12pt; font-weight: 600; margin: 14pt 0 4pt; text-transform: uppercase; letter-spacing: 0.06em; color: #555; }
.doc-p { margin: 0 0 9pt; }
.doc-center { text-align: center; }
.doc-rule { border: none; border-top: 0.75pt solid #c8c2b6; margin: 16pt auto; width: 80%; }
.doc-cover { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 9.3in; text-align: center; gap: 14pt; }
.doc-cover .eyebrow { font-family: 'Geist Mono', monospace; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.16em; color: #777; }
.doc-cover .title { font-size: 32pt; font-weight: 600; letter-spacing: -0.02em; line-height: 1.05; max-width: 6in; }
.doc-cover .subtitle { font-size: 14pt; color: #555; font-style: italic; max-width: 5.5in; }
.doc-cover .dateline { margin-top: 28pt; font-family: 'Geist Mono', monospace; font-size: 10pt; letter-spacing: 0.06em; color: #555; }
.doc-cover .ornament { width: 0.6in; border-top: 0.75pt solid #999; margin: 6pt 0; }
.doc-schedule { width: 100%; border-collapse: collapse; margin: 8pt 0 12pt; font-size: 11pt; }
.doc-schedule th, .doc-schedule td { text-align: left; padding: 7pt 8pt; vertical-align: top; border-bottom: 0.5pt solid #d6d0c4; }
.doc-schedule th { font-weight: 600; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.06em; color: #555; border-bottom: 1pt solid #1a1815; }
.doc-schedule td.num { font-family: 'Geist Mono', monospace; font-size: 10pt; color: #777; width: 0.4in; padding-top: 9pt; }
.doc-schedule td.when { text-align: right; white-space: nowrap; font-family: 'Geist Mono', monospace; font-size: 10pt; color: #444; }
.doc-verse-group { margin: 10pt 0 14pt; }
.doc-verse-ref { font-weight: 600; font-size: 11.5pt; margin: 8pt 0 2pt; }
.doc-verse { display: grid; grid-template-columns: 16pt 1fr; gap: 4pt; margin: 1pt 0; }
.doc-verse .vnum { text-align: right; font-size: 9pt; color: #777; padding-top: 3pt; }
.doc-notes-title { font-weight: 600; font-size: 12pt; margin: 14pt 0 8pt; }
.doc-notes-line { border-bottom: 0.5pt solid #c8c2b6; height: 22pt; }
.doc-song-title { font-weight: 600; font-size: 13pt; margin: 14pt 0 8pt; }
.doc-song { margin: 4pt 0 14pt; }
.doc-song-stanza { display: grid; grid-template-columns: 18pt 1fr; column-gap: 4pt; margin: 0 0 10pt; page-break-inside: avoid; }
.doc-song-stanza .vnum { font-size: 11pt; padding-top: 0; }
.doc-song-stanza .lines { white-space: pre-wrap; font-size: 11.5pt; line-height: 1.42; }
.doc-song-stanza.chorus { grid-template-columns: 44pt 1fr; }
.doc-song-stanza.chorus .lines { font-style: italic; }
@media print {
  body { background: white; padding: 0; }
  .paper { box-shadow: none; margin: 0; width: 100%; min-height: auto; page-break-after: always; }
  .paper:last-child { page-break-after: auto; }
}
@page { size: letter; margin: 0; }
`;

export function exportHTML(pkg: Package) {
  const inner = renderToStaticMarkup(<DocumentPreview pkg={pkg} interactive={false} />);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(pkg.title || "Package")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&display=swap" rel="stylesheet" />
<style>${CSS}</style>
</head>
<body>
${inner}
</body>
</html>`;
  downloadBlob(safeName(pkg.title) + ".html", "text/html;charset=utf-8", html);
}
