"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid";

/**
 * Where a Supabase invite/recovery email lands. The link carries the session as an
 * access_token/refresh_token pair in the URL fragment — never sent to the server, only
 * readable here in the browser — so this page turns it into a real session, then lets the
 * person set their first password.
 */
export default function ConvitePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    async function init() {
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        window.history.replaceState(null, "", window.location.pathname);
        setStatus(sessionError ? "invalid" : "ready");
        return;
      }
      const { data } = await supabase.auth.getSession();
      setStatus(data.session ? "ready" : "invalid");
    }
    init();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updateError) return setError(updateError.message);
    router.push("/");
  }

  return (
    <div className="fx" data-theme="light" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24, minHeight: "100vh" }}>
      <main style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, width: 432, maxWidth: "100%" }}>
        <div className="brand" style={{ gap: 12 }}>
          <div className="lm" style={{ width: 44, height: 44, borderRadius: 14 }}>
            <Icon name="wave" size={24} />
          </div>
          <span className="wordmark" style={{ fontSize: 32 }}>Fluxo</span>
        </div>

        {status === "checking" && <p className="t-body muted">Verificando convite…</p>}

        {status === "invalid" && (
          <div className="card" style={{ width: "100%", padding: 36, display: "flex", flexDirection: "column", gap: 16, alignItems: "center", textAlign: "center" }}>
            <Icon name="alert" size={24} />
            <p className="t-body">Este link de convite é inválido ou expirou. Peça para um administrador enviar um novo convite.</p>
            <a className="btn" href="/login">Ir para o login</a>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={submit} className="card" style={{ width: "100%", padding: 36, display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h1 className="t-h1">Defina sua senha</h1>
              <p className="t-body muted">Isso conclui sua conta no Fluxo.</p>
            </div>

            <div className="field">
              <label className="label" htmlFor="password">Senha</label>
              <div className="inwrap">
                <span className="ic i-lock lead" aria-hidden="true" />
                <input
                  id="password"
                  className="input with-ic"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Pelo menos 8 caracteres"
                  autoComplete="new-password"
                  required
                  style={{ paddingRight: 52 }}
                />
                <button type="button" className="ibtn trail" aria-label={show ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShow((v) => !v)}>
                  <Icon name={show ? "eyeoff" : "eye"} />
                </button>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="confirm">Confirmar senha</label>
              <input
                id="confirm"
                className="input"
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {error && <div className="errmsg" role="alert">{error}</div>}

            <SubmitButton pendingLabel="Salvando…" pending={pending}>Entrar no Fluxo</SubmitButton>
          </form>
        )}
      </main>
    </div>
  );
}
