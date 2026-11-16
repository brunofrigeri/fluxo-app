"use client";

import { useRef, useState, useTransition } from "react";
import { setStudioModality } from "@/app/(app)/configuracoes/actions";

/** Optimistic: the switch flips at once, the server call runs in the background and flips it back on failure. */
export function ModalityToggle({ modalityId, name, enabled }: { modalityId: string; name: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const latest = useRef(0);

  function flip() {
    const next = !on;
    const call = ++latest.current;
    setError(null);
    setOn(next);
    start(async () => {
      const r = await setStudioModality(modalityId, next);
      if (!r.error || call !== latest.current) return; // a newer click supersedes this answer
      setOn(!next);
      setError(r.error);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <label className="label" htmlFor={`mod-${modalityId}`}>{name}</label>
        <button id={`mod-${modalityId}`} type="button" className={`toggle${on ? " on" : ""}`} role="switch" aria-checked={on} onClick={flip} />
      </div>
      {error && <div className="errmsg" role="alert">{error}</div>}
    </div>
  );
}
