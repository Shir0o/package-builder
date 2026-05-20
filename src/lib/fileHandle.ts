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

export async function readPackageFromHandle(
  handle: FileSystemFileHandle,
): Promise<Package> {
  const file = await handle.getFile();
  const text = await file.text();
  const parsed = JSON.parse(text) as Package;
  if (!parsed || !Array.isArray((parsed as Package).blocks)) {
    throw new Error("Invalid package file");
  }
  return parsed;
}
