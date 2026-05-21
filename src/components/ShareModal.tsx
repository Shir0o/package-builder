import { useEffect, useRef } from "react";

type Props = {
  url: string;
  peerCount: number;
  onCopy: () => void;
  onStop: () => void;
  onClose: () => void;
};

/**
 * Modal shown for the live share session. Renders the shareable URL in a
 * read-only input the user can copy, plus Copy and Stop-sharing actions.
 */
export function ShareModal({ url, peerCount, onCopy, onStop, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    // Auto-select the URL so ⌘C just works.
    const input = inputRef.current;
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  const peerLabel =
    peerCount === 0
      ? "Waiting for someone to join…"
      : peerCount === 1
        ? "1 other person connected"
        : `${peerCount} other people connected`;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="share-modal-title">Share this package</h2>
          <button
            type="button"
            className="btn ghost tiny icon"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="modal-help">
          Anyone with this link can edit live. Edits sync peer-to-peer — there
          is no server copy.
        </p>
        <div className="modal-url-row">
          <input
            ref={inputRef}
            className="modal-url"
            value={url}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Share URL"
          />
          <button type="button" className="btn" onClick={onCopy}>
            Copy link
          </button>
        </div>
        <div className="modal-foot">
          <span className="modal-peers" aria-live="polite">
            {peerLabel}
          </span>
          <button type="button" className="btn ghost" onClick={onStop}>
            Stop sharing
          </button>
        </div>
      </div>
    </div>
  );
}
