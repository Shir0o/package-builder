import type { Package } from "../types";
import { downloadBlob, PACKAGE_EXTENSION, PACKAGE_MIME, safeName } from "./util";

export function exportJSON(pkg: Package) {
  downloadBlob(
    safeName(pkg.title) + PACKAGE_EXTENSION,
    PACKAGE_MIME,
    JSON.stringify(pkg, null, 2),
  );
}
