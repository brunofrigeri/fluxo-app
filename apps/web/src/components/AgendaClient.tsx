"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AgendaBooking, DialogClient } from "@/lib/queries/agenda";
import type { Modality } from "@/lib/modalities";
import { dayNumber } from "@/lib/dates";
import { statusMeta, type AttendanceStatus } from "@/lib/status";
import { AgendaBoard } from "./AgendaBoard";

type Add = { date: string; hour: number; clientId?: string; missId?: string; slotCount?: number; modalityId?: string };
type Who = "all" | "mine" | "none" | string;

const HEADS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const ORDER: (AttendanceStatus | null)[] = ["PRESENCE_CONFIRMED", "REPLACEMENT", "JUSTIFIED_MISS", "UNJUSTIFIED_MISS", null];

const monthCellLabel = (n: number) => (n === 0 ? "Sem sessões" : n === 1 ? "1 sessão" : `${n} sessões`);

/**
 * The agenda body: the "who" filter, then the month grid or the day/week board.
 * Filtering is client state over bookings the page already loaded, so it is instant.
 * Admins can see everyone, only their own classes, or one instructor; an instructor gets no filter
 * (the database only returns their own classes anyway).
 */
export function AgendaClient({
  bookings, view, days, anchor, today, nowTop, hours, rowPx, initialAdd, initialClients, modalities, filterModalityId,
  isAdmin, meId, instructors, dayHrefs,
}: {
  bookings: AgendaBooking[];
  view: "dia" | "3dias" | "semana" | "mes";
  days: string[];
  anchor: string;
  today: string;
  nowTop: number;
  hours: number[];
  rowPx: number;
  initialAdd: Add | null;
  initialClients: DialogClient[] | null;
  modalities: Modality[];
  filterModalityId?: string;
  isAdmin: boolean;
  meId: string;
  /** Everyone who is responsible for someone, for the filter (admins only). */
  instructors: { id: string; name: string }[];
  /** Month view: day -> link to that day. */
  dayHrefs: Record<string, string>;
}) {
  const [who, setWho] = useState<Who>("all");

  const byDate = useMemo(() => {
    const map = new Map<string, AgendaBooking[]>();
    for (const b of bookings) {
      if (who === "mine" && b.instructorId !== meId) continue;
      if (who === "none" && !(b.modalityKey && b.instructorId === null)) continue;
      if (who !== "all" && who !== "mine" && who !== "none" && b.instructorId !== who) continue;
      const list = map.get(b.date) ?? [];
      list.push(b);
      map.set(b.date, list);
    }
    return map;
  }, [bookings, who, meId]);

  const colsCls = view === "dia" ? "cols1" : view === "3dias" ? "cols3" : "cols7";
  const others = instructors.filter((i) => i.id !== meId);

  return (
    <>
      {isAdmin && (
        <div className="row" style={{ padding: "12px 20px", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--line)" }}>
          <span className="t-small muted">Instrutor</span>
          <div className="seg" role="group" aria-label="Instrutor" style={{ flexWrap: "wrap" }}>
            <button type="button" className={who === "all" ? "on" : ""} aria-pressed={who === "all"} onClick={() => setWho("all")}>Todos</button>
            <button type="button" className={who === "mine" ? "on" : ""} aria-pressed={who === "mine"} onClick={() => setWho("mine")}>Só minhas</button>
            {others.map((i) => (
              <button key={i.id} type="button" className={who === i.id ? "on" : ""} aria-pressed={who === i.id} onClick={() => setWho(i.id)}>{i.name.split(" ")[0]}</button>
            ))}
            <button type="button" className={who === "none" ? "on" : ""} aria-pressed={who === "none"} onClick={() => setWho("none")}>Sem instrutor</button>
          </div>
        </div>
      )}

      {view === "mes" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", borderBottom: "1px solid var(--line)" }}>
            {HEADS.map((h) => (
              <div key={h} className="t-tiny faint" style={{ padding: "12px 14px" }}>{h}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
            {days.map((day) => {
              const list = byDate.get(day) ?? [];
              const inMonth = day.slice(0, 7) === anchor.slice(0, 7);
              const isToday = day === today;
              const kinds = ORDER.filter((s) => list.some((b) => b.status === s));
              return (
                <Link key={day} href={dayHrefs[day]} prefetch={false} className={`mcell${isToday ? " today" : ""}${inMonth ? "" : " dim"}`} aria-label={`${day.slice(8)} — ${monthCellLabel(list.length)}`}>
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
              days={days}
              byDate={byDate}
              today={today}
              nowTop={nowTop}
              hours={hours}
              rowPx={rowPx}
              compact={view === "semana"}
              initialAdd={initialAdd}
              initialClients={initialClients}
              modalities={modalities}
              filterModalityId={filterModalityId}
              isAdmin={isAdmin}
              chipInstructor={isAdmin && who === "all"}
            />
          </div>
        </div>
      )}
    </>
  );
}
