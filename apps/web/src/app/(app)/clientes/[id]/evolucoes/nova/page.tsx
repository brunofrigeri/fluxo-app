import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crumbs } from "@/components/Crumbs";
import { EvolutionForm } from "@/components/EvolutionForm";
import { ModalityTag } from "@/components/ModalityTag";
import { initialsOf } from "@fluxo/domain";
import { todayISO } from "@fluxo/domain";
import { pickModality } from "@/lib/modalities";
import { countEvolutions, getClientHead, getClientModalities, getSessionOptions } from "@/lib/queries/evolution";
import { createClient } from "@/lib/supabase/server";
import { saveEvolution } from "../../../actions";

export const metadata: Metadata = { title: "Nova evolução" };
export const dynamic = "force-dynamic";

export default async function NewEvolutionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sessao?: string; modalidade?: string }> }) {
  const { id } = await params;
  const { sessao, modalidade } = await searchParams;
  const client = await getClientHead(id);
  if (!client) notFound();

  const modalities = await getClientModalities(id);
  const crumbs = [{ label: "Clientes", href: "/clientes" }, { label: client.name, href: `/clientes/${id}` }, { label: "Evoluções", href: `/clientes/${id}?aba=evolucoes` }, { label: "Nova evolução" }];

  // Which modality: the one of the linked session, else the one asked for, else the only one.
  let modality = pickModality(modalidade, modalities);
  if (sessao) {
    const supabase = await createClient();
    const { data: b } = await supabase.from("bookings").select("modality_id").eq("id", sessao).eq("client_id", id).maybeSingle();
    modality = modalities.find((m) => m.id === b?.modality_id) ?? modality;
  }
  if (!modality && modalities.length === 1) modality = modalities[0];

  if (!modality) {
    return (
      <>
        <Crumbs items={crumbs} />
        <header className="pagehead"><h1 className="t-h1">Nova evolução</h1></header>
        <section className="card" style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 className="t-h3">{modalities.length === 0 ? "Você não tem acesso a nenhuma modalidade deste cliente." : "De qual modalidade é a evolução?"}</h2>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            {modalities.map((m) => (
              <Link key={m.id} className="btn pri" href={`/clientes/${id}/evolucoes/nova?modalidade=${m.key}`}>{m.name}</Link>
            ))}
          </div>
        </section>
      </>
    );
  }

  const [sessions, existing] = await Promise.all([getSessionOptions(id, modality.id, sessao), countEvolutions(id, modality.id)]);
  const chosen = sessions.find((s) => s.id === sessao);

  return (
    <>
      <Crumbs items={crumbs} />
      <header className="pagehead" style={{ marginBottom: 20 }}>
        <div className="row" style={{ gap: 16 }}>
          <span className="avatar" style={{ width: 48, height: 48 }}>{initialsOf(client.name)}</span>
          <div>
            <h1 className="t-h1 row" style={{ gap: 12, flexWrap: "wrap" }}>Nova evolução <ModalityTag modality={modality.key} /></h1>
            <p className="t-small muted">{client.name}{client.routine ? ` · ${client.routine}` : ""}</p>
          </div>
        </div>
      </header>
      <EvolutionForm
        modality={modality.key}
        action={saveEvolution.bind(null, id, modality.key, null)}
        cancelHref={`/clientes/${id}?aba=evolucoes`}
        initialDate={chosen?.date ?? todayISO()}
        initialBookingId={chosen?.id ?? null}
        initialSessionNumber={existing + 1}
        initialData={{}}
        sessions={sessions}
      />
    </>
  );
}
