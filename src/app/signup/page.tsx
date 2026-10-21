import type { Metadata } from "next";
import Link from "next/link";
import { MODALITY_KEYS, MODALITY_LABELS } from "@fluxo/forms";
import { Icon } from "@/components/Icon";
import { PasswordField } from "@/components/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";
import { signUp } from "./actions";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ erro?: string; confirme?: string }> }) {
  const { erro, confirme } = await searchParams;

  return (
    <div className="fx" data-theme="light" style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, minHeight: "100vh" }}>
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.13 }} aria-hidden="true">
        <path d="M-20 640c180-120 360-120 540 0s360 120 540 0 300-100 420-40" />
        <path d="M-20 700c180-120 360-120 540 0s360 120 540 0 300-100 420-40" />
        <path d="M-20 760c180-120 360-120 540 0s360 120 540 0 300-100 420-40" />
      </svg>

      <main style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 32, width: 432, maxWidth: "100%" }}>
        <div className="brand" style={{ gap: 12 }}>
          <div className="lm" style={{ width: 44, height: 44, borderRadius: 14 }}>
            <Icon name="wave" size={24} />
          </div>
          <span className="wordmark" style={{ fontSize: 32 }}>Fluxo</span>
        </div>

        {confirme === "1" ? (
          <div className="card" style={{ width: "100%", padding: 36, display: "flex", flexDirection: "column", gap: 16, alignItems: "center", textAlign: "center" }}>
            <Icon name="mail" size={24} />
            <p className="t-body">Enviamos um e-mail de confirmação. Confirme sua conta e depois entre normalmente.</p>
            <Link className="btn" href="/login">Ir para o login</Link>
          </div>
        ) : (
          <>
            <form action={signUp} className="card" style={{ width: "100%", padding: 36, display: "flex", flexDirection: "column", gap: 22 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <h1 className="t-h1">Criar estúdio</h1>
                <p className="t-body muted">Crie sua conta e comece seu próprio estúdio no Fluxo.</p>
              </div>

              {erro && (
                <div className="errmsg" role="alert">
                  <Icon name="alert" size={20} />
                  {erro}
                </div>
              )}

              <div className="field">
                <label className="label" htmlFor="name">Nome</label>
                <input id="name" name="name" className="input" placeholder="Seu nome completo" autoComplete="name" required />
              </div>

              <div className="field">
                <label className="label" htmlFor="email">E-mail</label>
                <div className="inwrap">
                  <span className="ic i-mail lead" aria-hidden="true" />
                  <input id="email" name="email" type="email" className="input with-ic" placeholder="voce@estudio.com.br" autoComplete="username" required />
                </div>
              </div>

              <div className="field">
                <label className="label" htmlFor="password">Senha</label>
                <PasswordField />
                <span className="help">Pelo menos 8 caracteres.</span>
              </div>

              <fieldset className="regions">
                <legend className="label">O que seu estúdio oferece?</legend>
                <div className="rchips">
                  {MODALITY_KEYS.map((key) => (
                    <label key={key} className="rchip">
                      <input type="checkbox" name="modalities" value={key} defaultChecked={key === "pilates"} />
                      {MODALITY_LABELS[key]}
                    </label>
                  ))}
                </div>
                <span className="help">Você pode mudar isso depois, em Configurações.</span>
              </fieldset>

              <SubmitButton pendingLabel="Criando…">Criar conta</SubmitButton>
            </form>

            <p className="t-small muted">
              Já tem uma conta? <Link href="/login">Entrar</Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
