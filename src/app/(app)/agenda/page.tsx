import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { AgendaBoard } from "@/components/AgendaBoard";
import { Icon } from "@/components/Icon";
import { Seg } from "@/components/Seg";
import { dayNumber, minuteOfDayNow, todayISO } from "@/lib/dates";
import {
  FIRST_HOUR, LAST_HOUR, getAgendaBookings, getDialogClients, monthCellLabel, parseView, rangeFor,
  type AgendaBooking, type View,
} from "@/lib/queries/agenda";
import { statusMeta, type AttendanceStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

type Search = { vista?: string; data?: string; novo?: string; cliente?: string; reposicao?: string };

const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
const HEADS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const ROW_PX = 88;

function href(p: { vista: View; data?: string; novo?: string; cliente?: string; reposicao?: string }): string {
  const sp = new URLSearchParams({ vista: p.vista });
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
  const bookings = await getAgendaBookings(range.from, range.to);

  const byDate = new Map<string, AgendaBooking[]>();
  for (const b of bookings) {
    const list = byDate.get(b.date) ?? [];
    list.push(b);
    byDate.set(b.date, list);
  }

  // "Adicionar cliente" dialog, opened by ?novo=2026-10-06_08 (a slot) or ?novo=1 (from Home).
  let initialAdd: { date: string; hour: number; clientId?: string; missId?: string; slotCount?: number } | null = null;
  let initialClients: Awaited<ReturnType<typeof getDialogClients>> | null = null;
  if (sp.novo) {
    const m = /^(\d{4}-\d{2}-\d{2})_(\d{2})$/.exec(sp.novo);
    const date = m ? m[1] : today;
    const hour = m ? Math.min(LAST_HOUR, Math.max(FIRST_HOUR, Number(m[2]))) : 7;
    initialClients = await getDialogClients();
    const slotCount = m ? (byDate.get(date) ?? []).filter((b) => b.hour === hour).length : undefined;
    initialAdd = { date, hour, clientId: sp.cliente, missId: sp.reposicao, slotCount };
  }

  const colsCls = view === "dia" ? "cols1" : view === "3dias" ? "cols3" : "cols7";
  const nowTop = ((minuteOfDayNow() / 60) - FIRST_HOUR) * ROW_PX;

  return (
    <>
      <header className="pagehead">
        <h1 className="t-display">Agenda</h1>
      </header>

      <section className="card" style={{ padding: 0, overflow: view === "mes" ? "hidden" : "visible" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", flexWrap: "wrap", borderBottom: "1px solid var(--line)" }}>
          <div className="row" style={{ gap: 4 }}>
            <Link className="btn sm icon" href={href({ vista: view, data: range.prev })} aria-label="Anterior"><Icon name="chevl" /></Link>
            <Link className="btn sm icon" href={href({ vista: view, data: range.next })} aria-label="Próximo"><Icon name="chevr" /></Link>
          </div>
          <Link className="btn sm" href={href({ vista: view })}>Hoje</Link>
          <h2 className="t-h2" style={{ marginLeft: 8 }}>{range.title}</h2>
          <Seg
            label="Visualização"
            style={{ marginLeft: "auto" }}
            items={[
              { href: href({ vista: "dia", data: view === "mes" ? undefined : range.anchor }), label: "Dia", on: view === "dia" },
              { href: href({ vista: "3dias", data: view === "mes" ? undefined : range.anchor }), label: "3 dias", on: view === "3dias" },
              { href: href({ vista: "semana", data: view === "mes" ? undefined : range.anchor }), label: "Semana", on: view === "semana" },
              { href: href({ vista: "mes", data: range.anchor }), label: "Mês", on: view === "mes" },
            ]}
          />
        </div>

        {view === "mes" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", borderBottom: "1px solid var(--line)" }}>
              {HEADS.map((h) => (
                <div key={h} className="t-tiny faint" style={{ padding: "12px 14px" }}>{h}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
              {range.days.map((day) => {
                const list = byDate.get(day) ?? [];
                const inMonth = day.slice(0, 7) === range.anchor.slice(0, 7);
                const isToday = day === today;
                const kinds = ORDER.filter((s) => list.some((b) => b.status === s));
                return (
                  <Link key={day} href={href({ vista: "dia", data: day })} prefetch={false} className={`mcell${isToday ? " today" : ""}${inMonth ? "" : " dim"}`} aria-label={`${day.slice(8)} — ${monthCellLabel(list.length)}`}>
                    <span style={{ minWidth: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 15, width: "fit-content" }} className={isToday ? "tdy" : ""}>
                      {dayNumber(day)}
                    </span>
                    <span className={`t-small ${inMonth ? "muted" : "faint"}`} style={{ fontWeight: 600 }}>{monthCellLabel(list.length)}</span>
                    <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {kinds.map((s) => (
                        <span key={s ?? "none"} className={`sdot ${statusMeta(s).dot}`} style={{ width: 14, height: 14 }} title={statusMeta(s).label} />
                      ))}
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        ) : (
          <div className="cal-scroll">
            <div className={`cal-inner${view === "semana" ? " wide" : ""}`}>
              <AgendaBoard
                colsCls={colsCls}
                days={range.days}
                byDate={byDate}
                today={today}
                nowTop={nowTop}
                hours={HOURS}
                rowPx={ROW_PX}
                compact={view === "semana"}
                initialAdd={initialAdd}
                initialClients={initialClients}
              />
            </div>
          </div>
        )}
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
