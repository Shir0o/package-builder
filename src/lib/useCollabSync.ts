import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// ─── Deep Package Equal Helper ────────────────────────────────────────────────
/**
 * Compares two Package objects (or their plain-JSON components) deeply.
 * Scoped to plain JSON structures; does not support Dates, Maps, Sets, or functions.
 */
function deepPackageEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!keysB.includes(k)) return false;
    if (!deepPackageEqual((a as any)[k], (b as any)[k])) return false;
  }
  return true;
}

// How long to wait after joining for peer awareness packets before
// concluding we're alone and should seed from local pkg. Awareness
// packets are tiny and travel ahead of full doc state, but a too-short
// window risks racing against WebRTC signaling on slower / public
// signaling servers — so we keep a 1s margin. Still strictly better
// than the old fixed 1.5s timer because we now *gate on awareness*
// rather than seeding unconditionally at the deadline.
const PEER_DISCOVERY_MS = 1000;
const UNDO_CAPTURE_TIMEOUT_MS = 500;

function getSignalingServers(): string[] {
  if (typeof window !== "undefined") {
    // 1. Query parameter override (hash-based or search-based)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    let queryServers = hashParams.get("signaling");
    if (!queryServers) {
      const searchParams = new URLSearchParams(window.location.search);
      queryServers = searchParams.get("signaling");
    }
    if (queryServers) {
      return queryServers.split(",").map((s) => s.trim()).filter(Boolean);
    }

    // 2. localStorage override
    try {
      const localServers = localStorage.getItem("collab-signaling-servers");
      if (localServers) {
        return localServers.split(",").map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      // Ignore localStorage access errors
    }
  }

  // 3. Build-time environment variable override
  const envServers = (import.meta as any).env?.VITE_SIGNALING_SERVERS;
  if (envServers) {
    return envServers.split(",").map((s: string) => s.trim()).filter(Boolean);
  }

  // 4. Default fallbacks
  return [
    "ws://localhost:4444",
    "wss://signaling.yjs.dev",
    "wss://y-webrtc-signaling-us.herokuapp.com",
    "wss://y-webrtc-signaling-eu.herokuapp.com",
  ];
}

type AwarenessState = {
  user?: LocalUser;
  selectedBlockId?: string | null;
};

export type CollabPresence = {
  doc: Y.Doc | null;
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

  const initialPkgRef = useRef<Package>(pkg);
  const recentRemoteSnapshotsRef = useRef<Package[]>([]);

  // One identity per tab, generated lazily on the first render.
  const localUserRef = useRef<LocalUser | null>(null);
  if (localUserRef.current === null) {
    localUserRef.current = getOrCreateLocalUser();
  }
  const localUser = localUserRef.current;

  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [undoState, setUndoState] = useState<{ canUndo: boolean; canRedo: boolean }>(
    { canUndo: false, canRedo: false },
  );

  useEffect(() => {
    if (!roomId) {
      seededRef.current = false;
      setDoc(null);
      setPeers([]);
      setStatus("disconnected");
      setUndoState({ canUndo: false, canRedo: false });
      return;
    }
    initialPkgRef.current = pkgRef.current;
    recentRemoteSnapshotsRef.current = [];
    const doc = new Y.Doc();
    const provider = new WebrtcProvider(roomId, doc, {
      signaling: getSignalingServers()
    });
    const persistence = new IndexeddbPersistence(roomId, doc);
    docRef.current = doc;
    providerRef.current = provider;
    seededRef.current = false;
    setDoc(doc);

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
      const snapshot = snapshotPackage(root);
      recentRemoteSnapshotsRef.current.push(snapshot);
      if (recentRemoteSnapshotsRef.current.length > 10) {
        recentRemoteSnapshotsRef.current.shift();
      }
      onRemoteRef.current(snapshot);
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
        // If any peer has announced presence by now, defer to them — they
        // will broadcast the existing doc state and our observer will pick
        // it up. Awareness packets are small and arrive ahead of state, so
        // their absence after the window is a reliable "I'm alone" signal.
        const peerCount = awareness.getStates().size - 1;
        if (peerCount > 0) return;

        // LIMITATION (Two-Peer Seeding Fork):
        // In a serverless WebRTC room, if two peers join an empty room simultaneously,
        // both might see peerCount === 0 during this discovery window due to signaling
        // latency. Consequently, both peers might independently seed the document from
        // their own local package state. Since there is no central coordinating authority
        // to serialize these initial writes, they will fork.
        // Reconcilation: When they eventually connect, Yjs's CRDT merge semantics will
        // combine their seeding transactions. However, if their packages had different
        // contents, this merge can result in duplicate blocks or interleaved/merged text
        // states. This is a known limitation of the serverless signaling architecture, but
        // it is acceptable because standard workflows typically have one user create a
        // room and share the link, meaning the second peer joins after the room is already
        // seeded and active.
        seededRef.current = true;
        doc.transact(() => {
          applyPackageToYDoc(root, pkgRef.current);
        }, SEED_ORIGIN);
      }, PEER_DISCOVERY_MS);
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
      setDoc(null);
      setPeers([]);
      setStatus("disconnected");
      setUndoState({ canUndo: false, canRedo: false });
    };
  }, [roomId, localUser]);

  useEffect(() => {
    if (!roomId) return;
    const doc = docRef.current;
    if (!doc) return;
    const root = doc.getMap(PKG_KEY) as YPackageRoot;

    if (!seededRef.current) {
      // If the current package is different from the initial package,
      // it means the local user has made edits during the peer discovery window.
      // We should immediately mark the doc as seeded and sync the local edits to the YDoc.
      if (!deepPackageEqual(pkg, initialPkgRef.current)) {
        seededRef.current = true;
      } else {
        // Otherwise, wait for peer discovery/IndexedDB restore to finish seeding.
        return;
      }
    }

    // Skip writing to the YDoc if the current package is one of the recent remote snapshots.
    // We check reference equality (O(1)) because React updates state using the exact snapshot reference.
    // This completely avoids the expensive deepEqual traversal on every local keystroke.
    if (recentRemoteSnapshotsRef.current.includes(pkg)) {
      return;
    }

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

  // Memoize so the returned object identity is stable when none of the
  // underlying values changed. Callers that pass this object into a
  // useEffect dep would otherwise re-fire on every render and (in the
  // lazy-load bridge in App.tsx) loop forever.
  return useMemo<CollabPresence>(
    () => ({
      doc,
      peers,
      localUser,
      status,
      undo,
      redo,
      canUndo: undoState.canUndo,
      canRedo: undoState.canRedo,
    }),
    [doc, peers, localUser, status, undo, redo, undoState.canUndo, undoState.canRedo],
  );
}
