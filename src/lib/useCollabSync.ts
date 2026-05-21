import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";
import type { Package } from "../types";
import {
  LOCAL_ORIGIN,
  PKG_KEY,
  SEED_ORIGIN,
  applyPackageToYDoc,
  snapshotPackage,
  type YPackageRoot,
} from "./collab";

const JOIN_SEED_DELAY_MS = 1500;

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
 * Excluded from coverage: depends on WebRTC + window state that isn't
 * straightforwardly testable in jsdom.
 */
export function useCollabSync(
  roomId: string | null,
  pkg: Package,
  onRemote: (pkg: Package) => void,
) {
  const onRemoteRef = useRef(onRemote);
  const pkgRef = useRef(pkg);
  onRemoteRef.current = onRemote;
  pkgRef.current = pkg;

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!roomId) {
      seededRef.current = false;
      return;
    }
    const doc = new Y.Doc();
    const provider = new WebrtcProvider(roomId, doc);
    const persistence = new IndexeddbPersistence(roomId, doc);
    docRef.current = doc;
    providerRef.current = provider;
    seededRef.current = false;

    const root = doc.getMap(PKG_KEY) as YPackageRoot;

    const onEvents = (
      _events: Y.YEvent<Y.AbstractType<unknown>>[],
      txn: Y.Transaction,
    ) => {
      if (txn.origin === LOCAL_ORIGIN || txn.origin === SEED_ORIGIN) return;
      seededRef.current = true;
      onRemoteRef.current(snapshotPackage(root));
    };
    root.observeDeep(onEvents);

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
      provider.destroy();
      persistence.destroy();
      doc.destroy();
      docRef.current = null;
      providerRef.current = null;
      seededRef.current = false;
    };
  }, [roomId]);

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
}
