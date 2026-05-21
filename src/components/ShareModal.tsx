import { useEffect, useRef } from "react";
import type { ConnectionStatus } from "../lib/collab";

type Props = {
  url: string;
  peerCount: number;
  status: ConnectionStatus;
  onCopy: () => void;
  onStop: () => void;
  onClose: () => void;
};

function statusLabel(status: ConnectionStatus, peerCount: number): string {
  if (status === "disconnected") return "Connecting…";
  if (peerCount === 0) return "Waiting for someone to join…";
  if (peerCount === 1) return "1 other person connected";
  return `${peerCount} other people connected`;
}

/**
 * Modal shown for the live share session. Renders the shareable URL in a
 * read-only input the user can copy, plus Copy and Stop-sharing actions.
 * Pressing Esc or clicking the backdrop closes it; the URL is auto-selected
 * so ⌘C just works.
 */
export function ShareModal({
  url,
  peerCount,
  status,
  onCopy,
  onStop,
  onClose,
}: Props) {
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
    const input = inputRef.current;
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
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
          Anyone with this link can edit live. Edits sync peer-to-peer (no server copy is saved, though connection metadata like Room IDs are visible to the public WebRTC signaling server).
        </p>
        <div className="modal-warning">
          <strong>Tip:</strong> If starting with an empty room, let the first person open the link and wait a brief moment for it to load before others join to avoid document forking or duplicate blocks.
        </div>
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
            {statusLabel(status, peerCount)}
          </span>
          <button type="button" className="btn ghost" onClick={onStop}>
            Stop sharing
          </button>
        </div>
      </div>
    </div>
  );
}
