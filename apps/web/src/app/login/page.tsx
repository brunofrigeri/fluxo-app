import { auth } from "@fluxo/copy";
import type { Metadata } from "next";
import Link from "next/link";
import { Icon, Logo } from "@fluxo/ui-web";
import { PasswordField } from "@/components/PasswordField";
import { SubmitButton } from "@/components/SubmitButton";
import { signIn } from "./actions";

export const metadata: Metadata = { title: auth.signIn };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const hasError = Boolean(erro);

  return (
    <div className="fx" data-theme="light" style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.13 }} aria-hidden="true">
        <path d="M-20 640c180-120 360-120 540 0s360 120 540 0 300-100 420-40" />
        <path d="M-20 700c180-120 360-120 540 0s360 120 540 0 300-100 420-40" />
        <path d="M-20 760c180-120 360-120 540 0s360 120 540 0 300-100 420-40" />
      </svg>

      <main style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 32, width: 432, maxWidth: "100%" }}>
        <Logo size="lg" />

        <form action={signIn} className="card" style={{ width: "100%", padding: 36, display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h1 className="t-h1">{auth.signIn}</h1>
            <p className="t-body muted">{auth.signInHint}</p>
          </div>

          {hasError && (
            <div className="errmsg" role="alert">
              <Icon name="alert" size={20} />
              {auth.wrongCredentials}
            </div>
          )}

          <div className="field">
            <label className="label" htmlFor="email">{auth.email}</label>
            <div className="inwrap">
              <span className="ic i-mail lead" aria-hidden="true" />
              <input id="email" name="email" type="email" className={`input with-ic${hasError ? " err" : ""}`} placeholder="voce@estudio.com.br" autoComplete="username" required />
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="password">{auth.password}</label>
            <PasswordField invalid={hasError} />
          </div>

          <SubmitButton pendingLabel={auth.signingIn}>{auth.signIn}</SubmitButton>
        </form>

        <p className="t-small muted">
          Ainda não tem um estúdio? <Link href="/signup">Criar conta</Link>
        </p>

        <p className="t-small faint" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="lock" size={14} />
          Acesso restrito e protegido
        </p>
      </main>
    </div>
  );
}
