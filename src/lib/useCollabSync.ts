import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
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
 * Bind a React-held `Package` to a Yjs room over y-webrtc.
 *
 * Local edits flow into the Y.Doc via `applyPackageToYDoc` (idempotent,
 * so echoes are no-ops). Remote edits stream back through `onRemote`.
 * Local transactions are tagged with origin "local" so the observer
 * ignores self-echoes.
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

    if (root.has("blocks") || root.has("title")) {
      seededRef.current = true;
      onRemoteRef.current(snapshotPackage(root));
    }

    const seedTimer = setTimeout(() => {
      if (seededRef.current) return;
      seededRef.current = true;
      doc.transact(() => {
        applyPackageToYDoc(root, pkgRef.current);
      }, SEED_ORIGIN);
    }, JOIN_SEED_DELAY_MS);

    return () => {
      clearTimeout(seedTimer);
      root.unobserveDeep(onEvents);
      provider.destroy();
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
