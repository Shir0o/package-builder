import type { Package } from "../types";
import { downloadBlob, safeName } from "./util";

export function exportJSON(pkg: Package) {
  downloadBlob(
    safeName(pkg.title) + ".pkg.json",
    "application/json",
    JSON.stringify(pkg, null, 2),
  );
}
