import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crumbs } from "@/components/Crumbs";
import { Icon } from "@/components/Icon";
import { initialsOf } from "@/lib/age";
import { APPARATUS_KEYS, APPARATUS_LABELS, EXERCISE_LABELS, REGION_LABELS, countFields, leaves } from "@/lib/apparatus";
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
  const { data: evo } = await supabase.from("evolutions").select("id, date, booking_id, apparatus").eq("id", evoId).eq("client_id", id).maybeSingle();
  if (!evo) notFound();

  let session: { date: string; time: string; status: AttendanceStatus | null } | null = null;
  if (evo.booking_id) {
    const { data: b } = await supabase.from("bookings").select("date, start_time, status").eq("id", evo.booking_id as string).maybeSingle();
    if (b) session = { date: b.date as string, time: hhmm(b.start_time as string), status: b.status as AttendanceStatus | null };
  }

  const all = leaves(evo.apparatus);
  const total = countFields(evo.apparatus);
  const shown = APPARATUS_KEYS.filter((a) => all.some((l) => l.apparatus === a));
  const date = formatBR(evo.date as string);

  return (
    <>
      <Crumbs items={[{ label: "Clientes", href: "/clientes" }, { label: client.name, href: `/clientes/${id}` }, { label: "Evoluções", href: `/clientes/${id}?aba=evolucoes` }, { label: date }]} />
      <header className="pagehead" style={{ marginBottom: 20 }}>
        <div className="row" style={{ gap: 16 }}>
          <span className="avatar" style={{ width: 48, height: 48 }}>{initialsOf(client.name)}</span>
          <div>
            <h1 className="t-h1">Evolução de {date}</h1>
            <p className="t-small muted">{client.name}{session ? ` · sessão de ${formatWeekdayDate(session.date).toLowerCase()}, ${session.time}` : ""}</p>
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

        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 0, padding: "8px 28px" }}>
          {shown.map((a, i) => (
            <div key={a} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 180px) minmax(0, 1fr)", gap: 24, padding: "22px 0", borderBottom: i < shown.length - 1 ? "1px solid var(--line)" : undefined }}>
              <h2 className="t-h2">{APPARATUS_LABELS[a]}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {all.filter((l) => l.apparatus === a).map((l) => (
                  <div key={l.exercise}>
                    <span className="pill acc">{EXERCISE_LABELS[l.exercise]}</span>
                    {l.regions.length > 0 && (
                      <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                        {l.regions.map((r) => (
                          <span key={r} className="tag" style={{ paddingRight: 12 }}>{REGION_LABELS[r]}</span>
                        ))}
                      </div>
                    )}
                    {l.note && <p className="t-body" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{l.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {shown.length === 0 && <p className="t-body muted" style={{ padding: "22px 0" }}>Nenhum campo preenchido.</p>}
        </section>
        <p className="t-small muted row" style={{ gap: 8 }}>
          <Icon name="info" size={16} />
          Mostrando só os {total} {total === 1 ? "campo preenchido" : "campos preenchidos"}. Os demais aparelhos não foram usados nesta sessão.
        </p>
      </div>
    </>
  );
}
