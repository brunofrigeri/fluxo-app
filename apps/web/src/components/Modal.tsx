"use client";

import { useEffect } from "react";
import { Icon } from "./Icon";

/**
 * Dialog over a scrim. Escape, the X and a click outside all call `onClose`.
 * It is plain client state: opening and closing never wait on the server (see CLAUDE.md).
 */
export function Modal({ title, onClose, width = 780, children }: { title: string; onClose: () => void; width?: number; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="scrim modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pop" role="dialog" aria-modal="true" aria-label={title} style={{ width, maxWidth: "100%", display: "flex", flexDirection: "column" }}>
        <div className="row" style={{ padding: "22px 28px", borderBottom: "1px solid var(--line)" }}>
          <h2 className="t-h2 grow">{title}</h2>
          <button type="button" className="ibtn" aria-label="Fechar" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
