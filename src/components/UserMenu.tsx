"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/login/actions";
import { Icon } from "./Icon";

export function UserMenu({ name, email, initials }: { name: string; email: string; initials: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="me-wrap" ref={ref}>
      {open && (
        <div className="pop menu-pop" role="menu">
          <div>
            <div className="t-h3" style={{ overflowWrap: "anywhere" }}>{name}</div>
            <div className="t-small muted" style={{ overflowWrap: "anywhere" }}>{email}</div>
          </div>
          <hr className="hair" />
          <form action={signOut}>
            <button type="submit" className="btn quiet" role="menuitem" style={{ width: "100%", justifyContent: "flex-start" }}>
              <Icon name="logout" size={18} />
              Sair
            </button>
          </form>
        </div>
      )}
      <button type="button" className="me" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} title={name}>
        <span className="avatar">{initials}</span>
        <span className="me-text">
          <span>{name}</span>
          <span className="t-small faint">Administração</span>
        </span>
      </button>
    </div>
  );
}
