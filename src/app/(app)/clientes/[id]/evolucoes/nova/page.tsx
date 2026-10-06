import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Crumbs } from "@/components/Crumbs";
import { EvolutionForm } from "@/components/EvolutionForm";
import { initialsOf } from "@/lib/age";
import { todayISO } from "@/lib/dates";
import { getClientHead, getSessionOptions } from "@/lib/queries/evolution";
import { saveEvolution } from "../../../actions";

export const metadata: Metadata = { title: "Nova evolução" };
export const dynamic = "force-dynamic";

export default async function NewEvolutionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sessao?: string }> }) {
  const { id } = await params;
  const { sessao } = await searchParams;
  const client = await getClientHead(id);
  if (!client) notFound();

  const sessions = await getSessionOptions(id, sessao);
  const chosen = sessions.find((s) => s.id === sessao);

  return (
    <>
      <Crumbs items={[{ label: "Clientes", href: "/clientes" }, { label: client.name, href: `/clientes/${id}` }, { label: "Evoluções", href: `/clientes/${id}?aba=evolucoes` }, { label: "Nova evolução" }]} />
      <header className="pagehead" style={{ marginBottom: 20 }}>
        <div className="row" style={{ gap: 16 }}>
          <span className="avatar" style={{ width: 48, height: 48 }}>{initialsOf(client.name)}</span>
          <div>
            <h1 className="t-h1">Nova evolução</h1>
            <p className="t-small muted">{client.name}{client.routine ? ` · ${client.routine}` : ""}</p>
          </div>
        </div>
      </header>
      <EvolutionForm
        action={saveEvolution.bind(null, id, null)}
        cancelHref={`/clientes/${id}?aba=evolucoes`}
        initialDate={chosen?.date ?? todayISO()}
        initialBookingId={chosen?.id ?? null}
        initialTree={{}}
        sessions={sessions}
      />
    </>
  );
}
