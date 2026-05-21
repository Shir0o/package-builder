export const PACKAGE_EXTENSION = ".pkg.json";
export const PACKAGE_MIME = "application/json";

export function downloadBlob(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeName(s: string | undefined) {
  return (
    (s || "package")
      .replace(/[^a-z0-9-_ ]+/gi, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 60) || "package"
  );
}

export function escapeHtml(s: string) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] || c,
  );
}
