import type { Package } from "../types";

type PermissionMode = "read" | "readwrite";

type HandleWithPermissions = FileSystemFileHandle & {
  queryPermission?: (opts: { mode: PermissionMode }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: PermissionMode }) => Promise<PermissionState>;
};

export function isFsaSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { showSaveFilePicker?: unknown })
      .showSaveFilePicker === "function"
  );
}

export async function verifyPermission(
  handle: FileSystemFileHandle,
  mode: PermissionMode = "readwrite",
): Promise<boolean> {
  const h = handle as HandleWithPermissions;
  if (!h.queryPermission || !h.requestPermission) return true;
  if ((await h.queryPermission({ mode })) === "granted") return true;
  return (await h.requestPermission({ mode })) === "granted";
}

export async function writePackageToHandle(
  handle: FileSystemFileHandle,
  pkg: Package,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(pkg, null, 2));
  await writable.close();
}

function isPackage(value: unknown): value is Package {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.title !== "string") return false;
  if (typeof v.pageNumbers !== "boolean") return false;
  if (v.fontSize !== undefined && typeof v.fontSize !== "number") return false;
  if (!Array.isArray(v.blocks)) return false;
  return v.blocks.every(
    (b) =>
      b &&
      typeof b === "object" &&
      typeof (b as { id?: unknown }).id === "string" &&
      typeof (b as { type?: unknown }).type === "string" &&
      "data" in (b as object),
  );
}

export async function readPackageFromHandle(
  handle: FileSystemFileHandle,
): Promise<Package> {
  const file = await handle.getFile();
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);
  if (!isPackage(parsed)) {
    throw new Error("Invalid package file");
  }
  return parsed;
}
