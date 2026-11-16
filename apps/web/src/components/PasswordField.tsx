"use client";

import { useState } from "react";
import { Icon } from "@fluxo/ui-web";

export function PasswordField({ invalid }: { invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="inwrap">
      <span className="ic i-lock lead" aria-hidden="true" />
      <input
        id="password"
        name="password"
        className={`input with-ic${invalid ? " err" : ""}`}
        type={show ? "text" : "password"}
        placeholder="Sua senha"
        autoComplete="current-password"
        required
        style={{ paddingRight: 52 }}
      />
      <button
        type="button"
        className="ibtn trail"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        onClick={() => setShow((v) => !v)}
      >
        <Icon name={show ? "eyeoff" : "eye"} />
      </button>
    </div>
  );
}
