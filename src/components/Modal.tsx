"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "./Icon";

/** Dialog over a scrim. Escape, the X and a click outside all go to closeHref. */
export function Modal({ title, closeHref, width = 780, children }: { title: string; closeHref: string; width?: number; children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && router.push(closeHref);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, closeHref]);

  return (
    <div className="scrim modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && router.push(closeHref)}>
      <div className="pop" role="dialog" aria-modal="true" aria-label={title} style={{ width, maxWidth: "100%", display: "flex", flexDirection: "column" }}>
        <div className="row" style={{ padding: "22px 28px", borderBottom: "1px solid var(--line)" }}>
          <h2 className="t-h2 grow">{title}</h2>
          <button type="button" className="ibtn" aria-label="Fechar" onClick={() => router.push(closeHref)}>
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
