import type { Metadata } from "next";
import Link from "next/link";
import { ClientForm, EMPTY_CLIENT } from "@/components/ClientForm";
import { Icon } from "@/components/Icon";
import { createClientAction } from "../actions";

export const metadata: Metadata = { title: "Novo cliente" };

export default function NewClientPage() {
  return (
    <>
      <nav className="t-small muted row" style={{ gap: 6, marginBottom: 14 }} aria-label="Você está em">
        <Link href="/clientes">Clientes</Link>
        <Icon name="chevr" size={14} />
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>Novo cliente</span>
      </nav>
      <header className="pagehead">
        <h1 className="t-display">Novo cliente</h1>
      </header>
      <div style={{ maxWidth: 880 }}>
        <ClientForm formId="client-form" values={EMPTY_CLIENT} action={createClientAction} cancelHref="/clientes" />
        <p className="t-small muted" style={{ marginTop: 14 }}>Doenças, cirurgias e horários semanais são adicionados na página do cliente, depois de salvar.</p>
      </div>
    </>
  );
}
