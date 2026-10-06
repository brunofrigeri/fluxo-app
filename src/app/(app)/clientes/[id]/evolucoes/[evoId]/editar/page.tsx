import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Crumbs } from "@/components/Crumbs";
import { EvolutionForm } from "@/components/EvolutionForm";
import { initialsOf } from "@/lib/age";
import { normalizeTree } from "@/lib/apparatus";
import { formatBR } from "@/lib/dates";
import { getClientHead, getSessionOptions } from "@/lib/queries/evolution";
import { createClient } from "@/lib/supabase/server";
import { deleteEvolution, saveEvolution } from "../../../../actions";

export const metadata: Metadata = { title: "Editar evolução" };
export const dynamic = "force-dynamic";

export default async function EditEvolutionPage({ params }: { params: Promise<{ id: string; evoId: string }> }) {
  const { id, evoId } = await params;
  const client = await getClientHead(id);
  if (!client) notFound();

  const supabase = await createClient();
  const { data: evo } = await supabase.from("evolutions").select("id, date, booking_id, apparatus").eq("id", evoId).eq("client_id", id).maybeSingle();
  if (!evo) notFound();

  const sessions = await getSessionOptions(id, evo.booking_id as string | null);
  const readHref = `/clientes/${id}/evolucoes/${evoId}`;

  return (
    <>
      <Crumbs items={[{ label: "Clientes", href: "/clientes" }, { label: client.name, href: `/clientes/${id}` }, { label: "Evoluções", href: `/clientes/${id}?aba=evolucoes` }, { label: formatBR(evo.date as string), href: readHref }, { label: "Editar" }]} />
      <header className="pagehead" style={{ marginBottom: 20 }}>
        <div className="row" style={{ gap: 16 }}>
          <span className="avatar" style={{ width: 48, height: 48 }}>{initialsOf(client.name)}</span>
          <div>
            <h1 className="t-h1">Editar evolução</h1>
            <p className="t-small muted">{client.name} · {formatBR(evo.date as string)}</p>
          </div>
        </div>
      </header>
      <EvolutionForm
        action={saveEvolution.bind(null, id, evoId)}
        cancelHref={readHref}
        initialDate={evo.date as string}
        initialBookingId={(evo.booking_id as string | null) ?? null}
        initialTree={normalizeTree(evo.apparatus)}
        sessions={sessions}
        extra={
          <ConfirmButton form="delete-evolution" className="btn quiet" message="Excluir esta evolução? Isso não pode ser desfeito.">
            Excluir evolução
          </ConfirmButton>
        }
      />
      <form id="delete-evolution" action={deleteEvolution.bind(null, id, evoId)} />
    </>
  );
}
