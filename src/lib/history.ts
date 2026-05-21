import { useState, useRef, useCallback } from "react";
import type { Package } from "../types";

export type AppState = {
  pkg: Package;
  selectedId: string | null;
};

export function usePackageState(initialPkg: Package | (() => Package)) {
  const [state, setState] = useState<AppState>(() => {
    const pkg = typeof initialPkg === "function" ? initialPkg() : initialPkg;
    return {
      pkg,
      selectedId: null,
    };
  });

  const pastRef = useRef<AppState[]>([]);
  const futureRef = useRef<AppState[]>([]);
  const lastCommitTimeRef = useRef<number>(0);
  const lastActionTypeRef = useRef<string | null>(null);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const replacePkg = useCallback((newPkg: Package) => {
    setState((s) => (s.pkg === newPkg ? s : { ...s, pkg: newPkg }));
  }, []);

  const resetHistory = useCallback((newPkg: Package) => {
    setState({
      pkg: newPkg,
      selectedId: null,
    });
    pastRef.current = [];
    futureRef.current = [];
    lastCommitTimeRef.current = 0;
    lastActionTypeRef.current = null;
  }, []);

  const pushState = useCallback(
    (
      nextStateOrUpdater: AppState | ((prev: AppState) => AppState),
      actionType: string,
      isContinuous = false
    ) => {
      setState((currentState) => {
        const resolvedState =
          typeof nextStateOrUpdater === "function"
            ? nextStateOrUpdater(currentState)
            : nextStateOrUpdater;

        const now = Date.now();
        const shouldCoalesce =
          isContinuous &&
          lastActionTypeRef.current === actionType &&
          now - lastCommitTimeRef.current < 1200;

        if (shouldCoalesce) {
          // Coalesce continuous edits by not pushing a new history state.
          // Keep lastCommitTimeRef as is, so checkpoints are formed periodically (every 1.2s).
        } else {
          // Commit current state to past
          pastRef.current = [...pastRef.current, currentState];
          futureRef.current = [];
          lastCommitTimeRef.current = now;
          lastActionTypeRef.current = actionType;
        }

        return resolvedState;
      });
    },
    []
  );

  const setSelectedId = useCallback((id: string | null) => {
    setState((s) => {
      if (s.selectedId !== id) {
        lastCommitTimeRef.current = 0;
        lastActionTypeRef.current = null;
      }
      return { ...s, selectedId: id };
    });
  }, []);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;

    const previousState = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);

    setState((currentState) => {
      futureRef.current = [...futureRef.current, currentState];
      return previousState;
    });

    lastCommitTimeRef.current = 0;
    lastActionTypeRef.current = null;
  }, []);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;

    const nextState = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);

    setState((currentState) => {
      pastRef.current = [...pastRef.current, currentState];
      return nextState;
    });

    lastCommitTimeRef.current = 0;
    lastActionTypeRef.current = null;
  }, []);

  return {
    pkg: state.pkg,
    selectedId: state.selectedId,
    setSelectedId,
    pushState,
    resetHistory,
    replacePkg,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
