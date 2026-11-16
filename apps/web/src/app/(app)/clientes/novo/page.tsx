import type { Metadata } from "next";
import Link from "next/link";
import { ClientForm, EMPTY_CLIENT } from "@/components/ClientForm";
import { Icon } from "@/components/Icon";
import { getAdmin } from "@/lib/admin";
import { getInstructorsByModality, getTeachableModalities } from "@/lib/modalities";
import { createClientAction } from "../actions";

export const metadata: Metadata = { title: "Novo cliente" };
export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const me = await getAdmin();
  if (!me) return null;
  const [teachable, byModality] = await Promise.all([getTeachableModalities(me), getInstructorsByModality()]);
  const canReassign = me.role === "admin";

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
        <ClientForm
          formId="client-form"
          values={EMPTY_CLIENT}
          action={createClientAction}
          cancelHref="/clientes"
          modalities={teachable.map((m) => ({ key: m.key, name: m.name, instructors: byModality.get(m.id) ?? [] }))}
          enrollment={{}}
          canEditModalities
          canReassign={canReassign}
        />
        <p className="t-small muted" style={{ marginTop: 14 }}>Doenças, cirurgias, tratamentos e horários semanais são adicionados na página do cliente, depois de salvar.</p>
      </div>
    </>
  );
}
