import type { Package } from "../types";
import { SEED_PACKAGE } from "../seed";

const STORAGE_KEY = "package_builder_v1";

export function loadPackage(): Package {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Package;
  } catch (e) {
    console.warn("load failed", e);
  }
  return JSON.parse(JSON.stringify(SEED_PACKAGE)) as Package;
}

export function savePackage(pkg: Package): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pkg));
  } catch (e) {
    console.warn("save failed", e);
  }
}
