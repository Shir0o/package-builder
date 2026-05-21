import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";
import type { Package } from "../types";
import {
  LOCAL_ORIGIN,
  PKG_KEY,
  SEED_ORIGIN,
  applyPackageToYDoc,
  getOrCreateLocalUser,
  snapshotPackage,
  type ConnectionStatus,
  type LocalUser,
  type Peer,
  type YPackageRoot,
} from "./collab";

const JOIN_SEED_DELAY_MS = 1500;
const UNDO_CAPTURE_TIMEOUT_MS = 500;

type AwarenessState = {
  user?: LocalUser;
  selectedBlockId?: string | null;
};

export type CollabPresence = {
  peers: Peer[];
  localUser: LocalUser;
  status: ConnectionStatus;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

/**
 * Bind a React-held `Package` to a Yjs room over y-webrtc, with
 * IndexedDB local persistence layered underneath so a returning user
 * sees their last state immediately — before any peer connects.
 *
 * Local edits flow into the Y.Doc via `applyPackageToYDoc` (idempotent,
 * so echoes are no-ops). Remote edits stream back through `onRemote`.
 * Local transactions are tagged with origin "local" so the observer
 * ignores self-echoes.
 *
 * Seeding is gated on `persistence.whenSynced` so we never overwrite
 * state that IndexedDB is about to restore. If IndexedDB fails to open,
 * we fall back to the original seed-after-window behavior.
 *
 * Presence: the local user's identity (random name + color, persisted
 * in sessionStorage for the tab) and current `selectedBlockId` are
 * published via the provider's awareness channel. The hook returns the
 * list of remote peers, the local identity, and a coarse connection
 * status ("disconnected" | "alone" | "connected").
 *
 * Excluded from coverage: depends on WebRTC + window state that isn't
 * straightforwardly testable in jsdom.
 */
export function useCollabSync(
  roomId: string | null,
  pkg: Package,
  onRemote: (pkg: Package) => void,
  selectedBlockId: string | null = null,
): CollabPresence {
  const onRemoteRef = useRef(onRemote);
  const pkgRef = useRef(pkg);
  const selectedBlockIdRef = useRef(selectedBlockId);
  onRemoteRef.current = onRemote;
  pkgRef.current = pkg;
  selectedBlockIdRef.current = selectedBlockId;

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const seededRef = useRef(false);

  // One identity per tab, generated lazily on the first render.
  const localUserRef = useRef<LocalUser | null>(null);
  if (localUserRef.current === null) {
    localUserRef.current = getOrCreateLocalUser();
  }
  const localUser = localUserRef.current;

  const [peers, setPeers] = useState<Peer[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [undoState, setUndoState] = useState<{ canUndo: boolean; canRedo: boolean }>(
    { canUndo: false, canRedo: false },
  );

  useEffect(() => {
    if (!roomId) {
      seededRef.current = false;
      setPeers([]);
      setStatus("disconnected");
      setUndoState({ canUndo: false, canRedo: false });
      return;
    }
    const doc = new Y.Doc();
    const provider = new WebrtcProvider(roomId, doc);
    const persistence = new IndexeddbPersistence(roomId, doc);
    docRef.current = doc;
    providerRef.current = provider;
    seededRef.current = false;

    const root = doc.getMap(PKG_KEY) as YPackageRoot;

    // Track only this client's local writes; remote ops and seed ops are
    // excluded so undo reverts your own edits without clobbering peers'.
    // The root Y.Map scope cascades to nested Y.Texts and Y.Arrays.
    // captureTimeout coalesces per-character keystrokes (each is its own
    // Y.transact) into one undo step.
    const undoManager = new Y.UndoManager(root, {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: UNDO_CAPTURE_TIMEOUT_MS,
    });
    undoManagerRef.current = undoManager;
    const refreshUndoState = () => {
      setUndoState({
        canUndo: undoManager.canUndo(),
        canRedo: undoManager.canRedo(),
      });
    };
    undoManager.on("stack-item-added", refreshUndoState);
    undoManager.on("stack-item-popped", refreshUndoState);
    undoManager.on("stack-cleared", refreshUndoState);

    const onEvents = (
      _events: Y.YEvent<Y.AbstractType<unknown>>[],
      txn: Y.Transaction,
    ) => {
      if (txn.origin === LOCAL_ORIGIN || txn.origin === SEED_ORIGIN) return;
      seededRef.current = true;
      onRemoteRef.current(snapshotPackage(root));
    };
    root.observeDeep(onEvents);

    // Awareness: publish identity + selection in a single state so peers
    // see our current selection on first announce (no null → id flicker).
    const awareness = provider.awareness;
    awareness.setLocalState({
      user: localUser,
      selectedBlockId: selectedBlockIdRef.current,
    });

    const recomputePeers = () => {
      const states = awareness.getStates() as Map<number, AwarenessState>;
      const next: Peer[] = [];
      states.forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;
        if (!state.user) return;
        next.push({
          clientId,
          user: state.user,
          selectedBlockId: state.selectedBlockId ?? null,
        });
      });
      setPeers(next);
      setStatus(
        !provider.connected
          ? "disconnected"
          : next.length > 0
            ? "connected"
            : "alone",
      );
    };
    const onAwarenessChange = () => recomputePeers();
    const onStatus = () => recomputePeers();
    awareness.on("change", onAwarenessChange);
    provider.on("status", onStatus);
    provider.on("peers", onAwarenessChange);
    recomputePeers();

    let cancelled = false;
    let seedTimer: ReturnType<typeof setTimeout> | undefined;

    // After IndexedDB finishes restoring (or fails to), decide whether to
    // seed: if the doc already has state, adopt it; otherwise give peers a
    // window to send theirs before falling back to the local pkg.
    const startSeedFlow = () => {
      if (cancelled) return;
      if (root.has("blocks") || root.has("title")) {
        seededRef.current = true;
        onRemoteRef.current(snapshotPackage(root));
        return;
      }
      seedTimer = setTimeout(() => {
        if (seededRef.current) return;
        seededRef.current = true;
        doc.transact(() => {
          applyPackageToYDoc(root, pkgRef.current);
        }, SEED_ORIGIN);
      }, JOIN_SEED_DELAY_MS);
    };

    persistence.whenSynced.then(startSeedFlow).catch((err) => {
      // IndexedDB unavailable (private mode, quota, etc.) — fall back to
      // the original seed-from-local behavior so the room is still usable.
      console.warn("[collab] IndexedDB persistence failed:", err);
      startSeedFlow();
    });

    return () => {
      cancelled = true;
      if (seedTimer !== undefined) clearTimeout(seedTimer);
      root.unobserveDeep(onEvents);
      awareness.off("change", onAwarenessChange);
      provider.off("status", onStatus);
      provider.off("peers", onAwarenessChange);
      undoManager.off("stack-item-added", refreshUndoState);
      undoManager.off("stack-item-popped", refreshUndoState);
      undoManager.off("stack-cleared", refreshUndoState);
      undoManager.destroy();
      provider.destroy();
      persistence.destroy();
      doc.destroy();
      docRef.current = null;
      providerRef.current = null;
      undoManagerRef.current = null;
      seededRef.current = false;
      setPeers([]);
      setStatus("disconnected");
      setUndoState({ canUndo: false, canRedo: false });
    };
  }, [roomId, localUser]);

  useEffect(() => {
    if (!roomId) return;
    if (!seededRef.current) return;
    const doc = docRef.current;
    if (!doc) return;
    const root = doc.getMap(PKG_KEY) as YPackageRoot;
    doc.transact(() => {
      applyPackageToYDoc(root, pkg);
    }, LOCAL_ORIGIN);
  }, [roomId, pkg]);

  // Broadcast our current selection so peers can highlight the block
  // we're editing.
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) return;
    provider.awareness.setLocalStateField("selectedBlockId", selectedBlockId);
  }, [selectedBlockId, roomId]);

  const undo = useCallback(() => {
    undoManagerRef.current?.undo();
  }, []);
  const redo = useCallback(() => {
    undoManagerRef.current?.redo();
  }, []);

  return {
    peers,
    localUser,
    status,
    undo,
    redo,
    canUndo: undoState.canUndo,
    canRedo: undoState.canRedo,
  };
}
