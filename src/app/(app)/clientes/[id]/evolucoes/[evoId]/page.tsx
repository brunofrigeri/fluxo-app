import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getForm, isModalityKey } from "@fluxo/forms";
import { Crumbs } from "@/components/Crumbs";
import { FormReadView } from "@/components/forms/FormReadView";
import { Icon } from "@/components/Icon";
import { ModalityTag } from "@/components/ModalityTag";
import { initialsOf } from "@/lib/age";
import { formatBR, formatWeekdayDate, hhmm } from "@/lib/dates";
import { getClientHead } from "@/lib/queries/evolution";
import { statusMeta, type AttendanceStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Evolução" };
export const dynamic = "force-dynamic";

export default async function EvolutionPage({ params, searchParams }: { params: Promise<{ id: string; evoId: string }>; searchParams: Promise<{ salvo?: string }> }) {
  const { id, evoId } = await params;
  const { salvo } = await searchParams;
  const client = await getClientHead(id);
  if (!client) notFound();

  const supabase = await createClient();
  const { data: evo } = await supabase
    .from("evolutions")
    .select("id, date, booking_id, session_number, data, modalities(key)")
    .eq("id", evoId)
    .eq("client_id", id)
    .maybeSingle();
  if (!evo) notFound();
  const m = evo.modalities as { key: string } | { key: string }[] | null;
  const key = Array.isArray(m) ? m[0]?.key : m?.key;
  if (!isModalityKey(key)) notFound();

  let session: { date: string; time: string; status: AttendanceStatus | null } | null = null;
  if (evo.booking_id) {
    const { data: b } = await supabase.from("bookings").select("date, start_time, status").eq("id", evo.booking_id as string).maybeSingle();
    if (b) session = { date: b.date as string, time: hhmm(b.start_time as string), status: b.status as AttendanceStatus | null };
  }

  const date = formatBR(evo.date as string);

  return (
    <>
      <Crumbs items={[{ label: "Clientes", href: "/clientes" }, { label: client.name, href: `/clientes/${id}` }, { label: "Evoluções", href: `/clientes/${id}?aba=evolucoes` }, { label: date }]} />
      <header className="pagehead" style={{ marginBottom: 20 }}>
        <div className="row" style={{ gap: 16 }}>
          <span className="avatar" style={{ width: 48, height: 48 }}>{initialsOf(client.name)}</span>
          <div>
            <h1 className="t-h1 row" style={{ gap: 12, flexWrap: "wrap" }}>Evolução de {date} <ModalityTag modality={key} /></h1>
            <p className="t-small muted">Sessão nº {evo.session_number as number} · {client.name}{session ? ` · sessão de ${formatWeekdayDate(session.date).toLowerCase()}, ${session.time}` : ""}</p>
          </div>
        </div>
        <Link className="btn" href={`/clientes/${id}/evolucoes/${evoId}/editar`}><Icon name="edit" size={16} />Editar</Link>
      </header>

      <div style={{ maxWidth: 880, display: "flex", flexDirection: "column", gap: 20 }}>
        {salvo === "1" && (
          <div className="errmsg" role="status" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
            <Icon name="check" size={16} />
            Evolução salva
          </div>
        )}

        {session && (
          <section className="card" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "16px 24px" }}>
            <span className="t-small muted">Sessão vinculada</span>
            <span style={{ fontWeight: 600 }}>{formatWeekdayDate(session.date)}, {session.time}</span>
            <span className={`st ${statusMeta(session.status).cls}`}><span className={`sdot ${statusMeta(session.status).dot}`} />{statusMeta(session.status).label}</span>
          </section>
        )}

        <FormReadView def={getForm(key, "evolution")} data={evo.data as Record<string, unknown>} />
      </div>
    </>
  );
}
