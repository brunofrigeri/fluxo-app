import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { AgendaClient } from "@/components/AgendaClient";
import { Icon } from "@fluxo/ui-web";
import { Seg } from "@/components/Seg";
import { getAdmin } from "@/lib/admin";
import { getInstructorsByModality, getStudioModalities, getTeachableModalities, pickModality } from "@/lib/modalities";
import { dayNumber, minuteOfDayNow, todayISO } from "@fluxo/domain";
import {
  FIRST_HOUR, LAST_HOUR, getAgendaBookings, getDialogClients, monthCellLabel, parseView, rangeFor,
  type AgendaBooking, type View,
} from "@/lib/queries/agenda";
import { statusMeta, type AttendanceStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

type Search = { vista?: string; data?: string; novo?: string; cliente?: string; reposicao?: string; mod?: string };

const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
const HEADS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const ROW_PX = 88;

function href(p: { vista: View; data?: string; novo?: string; cliente?: string; reposicao?: string; mod?: string }): string {
  const sp = new URLSearchParams({ vista: p.vista });
  if (p.mod) sp.set("mod", p.mod);
  if (p.data) sp.set("data", p.data);
  if (p.novo) sp.set("novo", p.novo);
  if (p.cliente) sp.set("cliente", p.cliente);
  if (p.reposicao) sp.set("reposicao", p.reposicao);
  return `/agenda?${sp.toString()}`;
}

const ORDER: (AttendanceStatus | null)[] = ["PRESENCE_CONFIRMED", "REPLACEMENT", "JUSTIFIED_MISS", "UNJUSTIFIED_MISS", null];

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const ua = (await headers()).get("user-agent") ?? "";
  const view = parseView(sp.vista, /Mobi|Android|iPhone/i.test(ua) ? "dia" : "semana");
  const range = rangeFor(view, sp.data);
  const today = todayISO();
  const me = await getAdmin();
  const [studioModalities, teachable] = await Promise.all([getStudioModalities(), me ? getTeachableModalities(me) : Promise.resolve([])]);
  const filter = pickModality(sp.mod, studioModalities);
  const mod = filter?.key;
  const bookings = await getAgendaBookings(range.from, range.to, filter?.id);
  // For the admin's "Instrutor" filter: everyone who teaches something in this studio.
  const instructors = me?.role === "admin" ? [...new Map([...(await getInstructorsByModality()).values()].flat().map((i) => [i.id, i])).values()].sort((a, b) => a.name.localeCompare(b.name)) : [];

  const byDate = new Map<string, AgendaBooking[]>();
  for (const b of bookings) {
    const list = byDate.get(b.date) ?? [];
    list.push(b);
    byDate.set(b.date, list);
  }

  // "Adicionar cliente" dialog, opened by ?novo=2026-10-06_08 (a slot) or ?novo=1 (from Home).
  let initialAdd: { date: string; hour: number; clientId?: string; missId?: string; slotCount?: number; modalityId?: string } | null = null;
  let initialClients: Awaited<ReturnType<typeof getDialogClients>> | null = null;
  if (sp.novo) {
    const m = /^(\d{4}-\d{2}-\d{2})_(\d{2})$/.exec(sp.novo);
    const date = m ? m[1] : today;
    const hour = m ? Math.min(LAST_HOUR, Math.max(FIRST_HOUR, Number(m[2]))) : 7;
    initialClients = await getDialogClients();
    const slotCount = m ? (byDate.get(date) ?? []).filter((b) => b.hour === hour).length : undefined;
    // A replacement starts in the modality of the miss it makes up; otherwise in the filter.
    const missModality = initialClients.find((c) => c.id === sp.cliente)?.misses.find((x) => x.id === sp.reposicao)?.modalityId ?? undefined;
    initialAdd = { date, hour, clientId: sp.cliente, missId: sp.reposicao, slotCount, modalityId: missModality ?? filter?.id };
  }

  const colsCls = view === "dia" ? "cols1" : view === "3dias" ? "cols3" : "cols7";
  const nowTop = ((minuteOfDayNow() / 60) - FIRST_HOUR) * ROW_PX;

  return (
    <>
      <header className="pagehead">
        <h1 className="t-display">Agenda</h1>
      </header>

      {studioModalities.length > 1 && (
        <Seg
          label="Modalidade"
          style={{ marginBottom: 16 }}
          items={[
            { href: href({ vista: view, data: range.anchor }), label: "Todas", on: !filter },
            ...studioModalities.map((m) => ({ href: href({ vista: view, data: range.anchor, mod: m.key }), label: m.name, on: filter?.id === m.id })),
          ]}
        />
      )}

      <section className="card" style={{ padding: 0, overflow: view === "mes" ? "hidden" : "visible" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", flexWrap: "wrap", borderBottom: "1px solid var(--line)" }}>
          <div className="row" style={{ gap: 4 }}>
            <Link className="btn sm icon" href={href({ vista: view, data: range.prev, mod })} aria-label="Anterior"><Icon name="chevl" /></Link>
            <Link className="btn sm icon" href={href({ vista: view, data: range.next, mod })} aria-label="Próximo"><Icon name="chevr" /></Link>
          </div>
          <Link className="btn sm" href={href({ vista: view, mod })}>Hoje</Link>
          <h2 className="t-h2" style={{ marginLeft: 8 }}>{range.title}</h2>
          <Seg
            label="Visualização"
            style={{ marginLeft: "auto" }}
            items={[
              { href: href({ vista: "dia", data: view === "mes" ? undefined : range.anchor, mod }), label: "Dia", on: view === "dia" },
              { href: href({ vista: "3dias", data: view === "mes" ? undefined : range.anchor, mod }), label: "3 dias", on: view === "3dias" },
              { href: href({ vista: "semana", data: view === "mes" ? undefined : range.anchor, mod }), label: "Semana", on: view === "semana" },
              { href: href({ vista: "mes", data: range.anchor, mod }), label: "Mês", on: view === "mes" },
            ]}
          />
        </div>

        <AgendaClient
          bookings={bookings}
          view={view}
          days={range.days}
          anchor={range.anchor}
          today={today}
          nowTop={nowTop}
          hours={HOURS}
          rowPx={ROW_PX}
          initialAdd={initialAdd}
          initialClients={initialClients}
          modalities={teachable}
          filterModalityId={filter?.id}
          isAdmin={me?.role === "admin"}
          meId={me?.id ?? ""}
          instructors={instructors}
          dayHrefs={Object.fromEntries(range.days.map((d) => [d, href({ vista: "dia", data: d, mod })]))}
        />
      </section>

      <div className="row" style={{ gap: 20, marginTop: 16, flexWrap: "wrap" }}>
        {(["PRESENCE_CONFIRMED", "JUSTIFIED_MISS", "UNJUSTIFIED_MISS", "REPLACEMENT", null] as (AttendanceStatus | null)[]).map((s) => (
          <span key={s ?? "none"} className="t-small muted row" style={{ gap: 6 }}>
            <span className={`sdot ${statusMeta(s).dot}`} />
            {statusMeta(s).label}
          </span>
        ))}
      </div>
      {view === "mes" && <p className="t-small muted" style={{ marginTop: 10 }}>Clicar em um dia abre a visualização Dia. Os pontos resumem os status do dia.</p>}
    </>
  );
}
