import { useCallback, useLayoutEffect, useRef } from "react";
import type { ChangeEvent, RefCallback } from "react";
import * as Y from "yjs";
import { LOCAL_ORIGIN } from "./collab";

type TextEl = HTMLInputElement | HTMLTextAreaElement;

export type YTextInputBinding = {
  ref: RefCallback<TextEl>;
  onChange: (e: ChangeEvent<TextEl>) => void;
};

/**
 * Bind a text `<input>` / `<textarea>` to a Y.Text so the local caret stays
 * put while remote peers edit the same field. The element is treated as
 * uncontrolled — the hook drives its `.value` imperatively, either from the
 * Y.Text observer (collab mode) or from the React fallback (solo mode).
 *
 * - In collab mode (`yText` non-null), local edits are applied as
 *   Y.Text.insert/delete using a prefix/suffix diff. Remote edits arrive via
 *   the Y.Text observer, which transforms the caret through the delta so it
 *   stays anchored to the user's intended position.
 * - In solo mode (`yText` null), the hook behaves like a normal controlled
 *   input: user keystrokes call `setFallback`, and external `fallback`
 *   changes (e.g. undo/redo) are synced back into the element imperatively.
 *
 * Callers should NOT pass a `value` prop on the element — only `ref` and
 * `onChange` from the returned binding.
 */
export function useYTextInput(
  yText: Y.Text | null,
  fallback: string,
  setFallback: (s: string) => void,
): YTextInputBinding {
  const elRef = useRef<TextEl | null>(null);
  const setRef = useCallback<RefCallback<TextEl>>((el) => {
    elRef.current = el;
  }, []);

  // Sync the DOM element with the source of truth. In collab mode the Y.Text
  // observer also adjusts the caret through the event delta so concurrent
  // remote edits don't yank the cursor to the end of the field.
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;

    if (yText) {
      const truth = yText.toString();
      if (el.value !== truth) el.value = truth;

      const onYChange = (event: Y.YTextEvent) => {
        const node = elRef.current;
        if (!node) return;
        const next = yText.toString();
        if (node.value === next) return;

        const start = node.selectionStart ?? next.length;
        const end = node.selectionEnd ?? next.length;
        let s = start;
        let f = end;
        let pos = 0;
        for (const op of event.delta) {
          if (op.retain != null) {
            pos += op.retain;
          } else if (typeof op.insert === "string") {
            const len = op.insert.length;
            if (pos <= s) s += len;
            if (pos <= f) f += len;
            pos += len;
          } else if (op.delete != null) {
            const d = op.delete;
            if (pos < s) s -= Math.min(d, s - pos);
            if (pos < f) f -= Math.min(d, f - pos);
          }
        }
        const focused =
          typeof document !== "undefined" && document.activeElement === node;
        node.value = next;
        if (focused) {
          try {
            node.setSelectionRange(Math.max(0, s), Math.max(0, f));
          } catch {
            // Some input types (e.g. number) reject setSelectionRange — ignore.
          }
        }
      };
      yText.observe(onYChange);
      return () => yText.unobserve(onYChange);
    }

    // Solo mode: keep the uncontrolled element synced with React state.
    if (el.value !== fallback) el.value = fallback;
    return;
  }, [yText, fallback]);

  const onChange = useCallback(
    (e: ChangeEvent<TextEl>) => {
      const next = e.target.value;
      if (!yText) {
        setFallback(next);
        return;
      }
      const cur = yText.toString();
      if (cur === next) return;

      // Common-prefix / common-suffix diff. Mirrors collab.ts:syncYText so
      // local edits translate to minimal Y.Text ops.
      let s = 0;
      const minLen = Math.min(cur.length, next.length);
      while (s < minLen && cur.charCodeAt(s) === next.charCodeAt(s)) s++;
      let ec = cur.length;
      let en = next.length;
      while (ec > s && en > s && cur.charCodeAt(ec - 1) === next.charCodeAt(en - 1)) {
        ec--;
        en--;
      }
      // LOCAL_ORIGIN matches the bulk-apply effect's origin so the
      // useCollabSync observer treats this as a self-echo (no snapshot
      // re-render). UndoManager in useCollabSync tracks LOCAL_ORIGIN so
      // undo of these edits keeps working. yText.doc is always non-null
      // here because the only way to obtain a Y.Text is via getYText, which
      // walks down from an attached doc.
      yText.doc!.transact(() => {
        if (ec > s) yText.delete(s, ec - s);
        if (en > s) yText.insert(s, next.slice(s, en));
      }, LOCAL_ORIGIN);
      // Also mirror into React state so the document preview re-renders
      // immediately. The follow-up [roomId, pkg] effect that syncs pkg into
      // the Y.Doc is idempotent (syncYText sees no diff and no-ops).
      setFallback(next);
    },
    [yText, setFallback],
  );

  return { ref: setRef, onChange };
}
