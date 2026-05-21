import { createContext, useContext } from "react";
import type * as Y from "yjs";
import { getYText } from "./collab";

/**
 * Provides the live Y.Doc (or null in solo mode) so deeply-nested editors
 * can subscribe to specific Y.Text fields without prop-drilling through
 * every block component. The value is null when there's no active room.
 *
 * Lives in its own file (separate from useCollabSync.ts) so editors can
 * statically import `useYText` / `CollabContext` without pulling the
 * connection layer (y-webrtc, y-indexeddb, UndoManager) into the main
 * bundle. The connection layer is loaded lazily on share.
 */
export const CollabContext = createContext<Y.Doc | null>(null);

/**
 * Look up the Y.Text at (blockId, path) from the CollabContext. Returns
 * null when there's no doc (solo mode) or when the path doesn't resolve —
 * the caller should treat null as "use the controlled fallback."
 */
export function useYText(
  blockId: string | null,
  path: ReadonlyArray<string | number>,
): Y.Text | null {
  const doc = useContext(CollabContext);
  if (!doc) return null;
  return getYText(doc, blockId, path);
}
